import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { X509Certificate } from "node:crypto";
import { DevProxyError } from "../core/errors.js";
import type { CommandRunner, Service } from "../core/types.js";

export type CaddyLifecycle = "reloaded" | "started";

export const caddyInstallHint = [
  "Caddy is required but was not found on PATH.",
  "Install Caddy, then open a new terminal and run `caddy version` to confirm it is available.",
  "Windows options:",
  "  winget install CaddyServer.Caddy",
  "  scoop install caddy",
  "After installing, run `caddy trust` from an elevated PowerShell session.",
].join("\n");

export function generateCaddyfile(services: readonly Service[]): string {
  const lines: string[] = [];

  for (const service of services) {
    lines.push(
      `${service.domain} {`,
      "\ttls internal",
      `\treverse_proxy localhost:${service.port} 127.0.0.1:${service.port} {`,
      "\t\theader_up Host {host}",
      "\t\theader_up X-Forwarded-Host {host}",
      "\t\theader_up X-Forwarded-Proto {scheme}",
      "\t\theader_up X-Forwarded-Port {server_port}",
      "\t\theader_up X-Forwarded-For {remote_host}",
      "\t}",
      "}",
      "",
    );
  }

  return lines.join("\n");
}

export async function writeCaddyfile(
  caddyFile: string,
  services: readonly Service[],
): Promise<void> {
  await mkdir(dirname(caddyFile), { recursive: true });
  await writeFile(caddyFile, generateCaddyfile(services), "utf8");
}

export async function ensureCaddyAvailable(run: CommandRunner): Promise<void> {
  const result = await run("caddy", ["version"]);
  if (result.code !== 0) {
    throw new DevProxyError(caddyInstallHint);
  }
}

export async function validateAndReloadCaddy(
  caddyFile: string,
  run: CommandRunner,
): Promise<CaddyLifecycle> {
  await ensureCaddyAvailable(run);

  const validate = await run("caddy", ["validate", "--config", caddyFile]);
  if (validate.code !== 0) {
    throw new DevProxyError(
      `Caddy config validation failed:\n${validate.stderr || validate.stdout}`,
    );
  }

  const reload = await run("caddy", ["reload", "--config", caddyFile]);
  if (reload.code !== 0) {
    const output = reload.stderr || reload.stdout;
    if (isCaddyAdminUnavailable(output)) {
      const start = await run("caddy", ["start", "--config", caddyFile]);
      if (start.code === 0) {
        return "started";
      }

      throw new DevProxyError(
        `Caddy start failed after reload found no running instance:\n${start.stderr || start.stdout}`,
      );
    }

    throw new DevProxyError(`Caddy reload failed:\n${output}`);
  }

  return "reloaded";
}

export async function stopCaddy(
  caddyFile: string,
  run: CommandRunner,
): Promise<"stopped" | "not-running"> {
  await ensureCaddyAvailable(run);

  const stop = await run("caddy", ["stop", "--config", caddyFile]);
  if (stop.code === 0) {
    return "stopped";
  }

  const output = stop.stderr || stop.stdout;
  if (isCaddyAdminUnavailable(output)) {
    return "not-running";
  }

  throw new DevProxyError(`Caddy stop failed:\n${output}`);
}

function isCaddyAdminUnavailable(output: string): boolean {
  return (
    output.includes("localhost:2019") &&
    (output.includes("No connection could be made") ||
      output.includes("actively refused") ||
      output.includes("connection refused"))
  );
}

export function getCaddyRootCAPath(): string {
  const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  return join(appData, "Caddy", "pki", "authorities", "local", "root.crt");
}

export type CaddyCertificateInfo = {
  path: string;
  exists: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  fingerprint?: string;
  fingerprint256?: string;
};

export async function getCaddyCertificateInfo(
  run: CommandRunner,
  rootCAPath: string = getCaddyRootCAPath(),
): Promise<CaddyCertificateInfo> {
  await ensureCaddyAvailable(run);

  try {
    const s = await stat(rootCAPath);
    if (!s.isFile()) {
      return { path: rootCAPath, exists: false };
    }

    const pem = await readFile(rootCAPath, "utf8");
    const cert = new X509Certificate(pem);

    return {
      path: rootCAPath,
      exists: true,
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      fingerprint: cert.fingerprint,
      fingerprint256: cert.fingerprint256,
    };
  } catch (error) {
    if (isFileMissing(error)) {
      return { path: rootCAPath, exists: false };
    }

    throw error;
  }
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
