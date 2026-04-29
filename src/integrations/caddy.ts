import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DevProxyError } from "../core/errors.js";
import type { CommandRunner, Service } from "../core/types.js";

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
    throw new DevProxyError(
      "Caddy is required but was not found on PATH. Install Caddy, then run this command again.",
    );
  }
}

export async function validateAndReloadCaddy(caddyFile: string, run: CommandRunner): Promise<void> {
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
        return;
      }

      throw new DevProxyError(
        `Caddy start failed after reload found no running instance:\n${start.stderr || start.stdout}`,
      );
    }

    throw new DevProxyError(`Caddy reload failed:\n${output}`);
  }
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
