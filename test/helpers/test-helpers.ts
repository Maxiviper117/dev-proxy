import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProgram } from "../../src/cli.js";
import type { CommandRunner, DevProxyContext } from "../../src/core/types.js";

export const testCertificatePem = [
  "-----BEGIN CERTIFICATE-----",
  "MIIDGzCCAgOgAwIBAgIQIRIuSyG3BrJJQ7CZ2npYgzANBgkqhkiG9w0BAQsFADAV",
  "MRMwEQYDVQQDDAp0ZXN0LmxvY2FsMB4XDTI2MDUwMTA4NTEwOFoXDTI3MDUwMTA5",
  "MTEwOFowFTETMBEGA1UEAwwKdGVzdC5sb2NhbDCCASIwDQYJKoZIhvcNAQEBBQAD",
  "ggEPADCCAQoCggEBAMM5M/tT3L0X9sikwAS7YT8lVw/u6XWJGEC7emz5tYNfnDOy",
  "4VYbU8Pb/VpHL9Kct/EQRCVA9cVLA5PxrfVluEuMCACM9+QmsDlaioU/ZAOHnqT+",
  "+b9iKR7hzuzoWlktWz+jCNhSG8IUALYtaP0bxK0vat+pIdnPmiIq+jjDCQntiQ0w",
  "/OyhctBULn9wumguBakcuRXFz/cy9/QtTftJO70U2FDNiDjHPHcEklSrqdXzPDZO",
  "iQcGFSb+t1fcCNNC04D3/1XqLO8yinLt+WLb+Ioe4bhRANK3JPZujOgit7aYDME8",
  "pgRvjU5Hp/S/ysVP9PQOEAchdkxfttAD0m5o/GUCAwEAAaNnMGUwDgYDVR0PAQH/",
  "BAQDAgWgMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATAVBgNVHREEDjAM",
  "ggp0ZXN0LmxvY2FsMB0GA1UdDgQWBBQFzpkLp2cGswjRL0XJJmlvu50tazANBgkq",
  "hkiG9w0BAQsFAAOCAQEAPeqpcaz/nQXApt2c36DmnY2qFfJPMlcsmw5JwAAhbng7",
  "03OUBMzFfPCbOTm2dTfwaqXmkqChz15w69G9piGQ4xth8lhfJDOjeFXArn9Uhx88",
  "+n3HiW3OQUId4Uh1rtBG3Mgvrk+7OKmyJIVYLgfE3+Jnnk9xYa8MntFwKUzyfsNS",
  "bQUDgekzu/2gRwpAxviJaChhCxcLLJbjzT/JLHtq+P/9dcbajqF9RkMSxJLwH0gv",
  "R33HZa+CmowtyGXcNpUXGtHsiPln1KVEXUOFHQiYIGr9FZ5K4g36dteC2jUxbhgg",
  "SwodsemzJCcHHk/pqIZfZAKHS1lFFL87N2gJ0CjHuQ==",
  "-----END CERTIFICATE-----",
].join("\n");

/**
 * Create a temporary {@link DevProxyContext} isolated for a single test.
 *
 * Uses a temp directory for all paths and a no-op command runner so tests do
 * not touch the real filesystem or spawn real processes.
 */
export async function createContext(): Promise<DevProxyContext> {
  const dir = await mkdtemp(join(tmpdir(), "devproxy-test-"));
  const hostsFile = join(dir, "hosts");
  await writeFile(hostsFile, "127.0.0.1 localhost\n", "utf8");
  const run: CommandRunner = async () => ({ code: 0, stdout: "ok", stderr: "" });

  return {
    paths: {
      appDir: dir,
      registryFile: join(dir, "registry.json"),
      caddyFile: join(dir, "Caddyfile"),
      hostsFile,
      caddyRootCAPath: join(dir, "Caddy", "pki", "authorities", "local", "root.crt"),
    },
    run,
    now: () => new Date("2026-04-29T00:00:00.000Z"),
    platform: "win32",
    isElevated: async () => true,
  };
}

/**
 * Create a test context with a custom command runner.
 *
 * Delegates to {@link createContext} and replaces the runner so tests can
 * simulate Caddy presence, absence, or specific failure modes.
 */
export async function createContextWithRunner(run: CommandRunner): Promise<DevProxyContext> {
  const context = await createContext();
  return { ...context, run };
}

/**
 * Capture help output from a Commander program.
 *
 * Redirects `writeOut` and `writeErr` into a local string and triggers
 * `outputHelp()` so assertions can inspect the rendered text.
 */
export function captureHelp(command: ReturnType<typeof buildProgram>): string {
  let output = "";
  command.configureOutput({
    writeOut: (str) => {
      output += str;
    },
    writeErr: (str) => {
      output += str;
    },
  });
  command.outputHelp();
  return output;
}

/**
 * Capture `console.log` output during command execution.
 *
 * Temporarily overrides `console.log`, runs the command, restores the original
 * logger, and returns everything that was printed.
 */
export async function captureCommandOutput(
  command: ReturnType<typeof buildProgram>,
  argv: string[],
): Promise<string> {
  let output = "";
  const originalLog = console.log;

  console.log = (...values: unknown[]) => {
    output += `${values.join(" ")}\n`;
  };

  try {
    await command.parseAsync(argv);
  } finally {
    console.log = originalLog;
  }

  return output;
}
