import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CommandRunner, ElevationInvoker, ElevationRequest } from "../core/types.js";

export type ElevationChecker = () => Promise<boolean>;

/**
 * Build a cross-platform elevation checker.
 *
 * On Windows, runs `net session` which succeeds only for administrators.
 * On macOS/Linux, checks whether the effective UID is 0 (root).
 */
export function createElevationChecker(
  platform: NodeJS.Platform,
  run: CommandRunner,
): ElevationChecker {
  return async function isElevated(): Promise<boolean> {
    if (platform === "win32") {
      const result = await run("net", ["session"]);
      return result.code === 0;
    }

    return process.getuid?.() === 0;
  };
}

/**
 * Create a Windows elevation runner that relaunches the current CLI through
 * PowerShell's `Start-Process -Verb RunAs`.
 *
 * The elevated helper writes its result to a temp file because the parent
 * process cannot reliably capture stdout/stderr from the UAC-launched child.
 */
export function createWindowsElevationInvoker(
  platform: NodeJS.Platform,
  run: CommandRunner,
  nodePath: string,
  cliPath: string,
  launch: typeof spawnWindowsCommand = spawnWindowsCommand,
): ElevationInvoker | undefined {
  if (platform !== "win32") {
    return undefined;
  }

  return async function elevate(request: ElevationRequest): Promise<{
    code: number;
    stdout: string;
    stderr: string;
  }> {
    const tempDir = await mkdtemp(join(tmpdir(), "devproxy-elevated-"));
    const resultPath = join(tempDir, "result.json");

    try {
      const script = buildPowerShellElevationScript(nodePath, cliPath, request, resultPath);
      const encoded = encodePowerShellCommand(script);
      const runner = await launch("powershell.exe", ["-NoProfile", "-EncodedCommand", encoded]);

      if (runner.code !== 0) {
        return runner;
      }

      return await readElevationResult(resultPath, runner);
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  };
}

function buildPowerShellElevationScript(
  nodePath: string,
  cliPath: string,
  request: ElevationRequest,
  resultPath: string,
): string {
  const elevatedArgs = buildElevatedArgs(cliPath, request, resultPath);
  const psNodePath = singleQuote(nodePath);
  const psResultPath = singleQuote(resultPath);
  const psArgumentList = singleQuote(elevatedArgs.map(quoteProcessArgument).join(" "));
  const psWorkingDirectory = singleQuote(process.cwd());

  return [
    "$ErrorActionPreference = 'Stop'",
    `$resultPath = ${psResultPath}`,
    "$result = [ordered]@{ code = 1; stdout = ''; stderr = '' }",
    "try {",
    "  $process = Start-Process " +
      `-FilePath ${psNodePath} ` +
      `-ArgumentList ${psArgumentList} ` +
      `-WorkingDirectory ${psWorkingDirectory} ` +
      "-Verb RunAs -Wait -PassThru",
    "  $result.code = $process.ExitCode",
    "  if (-not [System.IO.File]::Exists($resultPath)) {",
    "    $result.stderr = 'Windows elevation did not complete. The UAC prompt may have been cancelled, blocked, or hidden by policy.'",
    "    [System.IO.File]::WriteAllText($resultPath, ($result | ConvertTo-Json -Compress), [System.Text.UTF8Encoding]::new($false))",
    "  }",
    "} catch {",
    "  $result.code = 1",
    "  $result.stderr = $_.Exception.Message",
    "  [System.IO.File]::WriteAllText($resultPath, ($result | ConvertTo-Json -Compress), [System.Text.UTF8Encoding]::new($false))",
    "}",
  ].join("\n");
}

async function spawnWindowsCommand(
  command: string,
  args: readonly string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: false,
    });
    let stdout = "";
    let stderr = "";
    let resolved = false;

    const finish = (code: number, errorOutput?: string): void => {
      if (resolved) {
        return;
      }

      resolved = true;
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolve({ code, stdout, stderr: errorOutput ?? stderr });
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      finish(127, error.message);
    });
    child.on("close", (code) => {
      finish(code ?? 1);
    });
  });
}

function buildElevatedArgs(
  cliPath: string,
  request: ElevationRequest,
  resultPath: string,
): string[] {
  const base = [cliPath, "__elevated"];

  if (request.kind === "hosts-sync") {
    return [
      ...base,
      "hosts-sync",
      "--registry",
      request.registryFile,
      "--hosts",
      request.hostsFile,
      "--result",
      resultPath,
    ];
  }

  return [...base, "trust", "--root-ca", request.rootCAPath, "--result", resultPath];
}

function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

async function readElevationResult(
  resultPath: string,
  fallback: { code: number; stdout: string; stderr: string },
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const raw = await readFile(resultPath, "utf8");
    const parsed = JSON.parse(raw) as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };

    return {
      code: parsed.code ?? fallback.code,
      stdout: parsed.stdout ?? fallback.stdout,
      stderr: parsed.stderr ?? fallback.stderr,
    };
  } catch {
    return {
      code: fallback.code === 0 ? 1 : fallback.code,
      stdout: fallback.stdout,
      stderr:
        fallback.stderr ||
        "Windows elevation did not produce a result. The UAC prompt may have been blocked or cancelled before DevProxy could run its helper.",
    };
  }
}

function singleQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteProcessArgument(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
