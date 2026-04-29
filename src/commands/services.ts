import { platform } from "node:os";
import { domainFromName, parsePort } from "../core/domain.js";
import { DevProxyError } from "../core/errors.js";
import { readRegistry, removeService, upsertService, writeRegistry } from "../core/registry.js";
import type { DevProxyContext, Service } from "../core/types.js";
import {
  generateCaddyfile,
  stopCaddy,
  validateAndReloadCaddy,
  writeCaddyfile,
} from "../integrations/caddy.js";
import { canWriteHosts, ensureHostsWritable, writeHostsFile } from "../integrations/hosts.js";
import { defaultPaths } from "../platform/paths.js";
import { runCommand } from "../platform/runner.js";

export function createDefaultContext(): DevProxyContext {
  return {
    paths: defaultPaths(),
    run: runCommand,
    now: () => new Date(),
    platform: platform(),
  };
}

export async function addService(
  context: DevProxyContext,
  input: { name: string; port: string | number },
): Promise<string> {
  ensureWindows(context);
  const domain = domainFromName(input.name);
  const port = parsePort(input.port);
  const registry = await readRegistry(context.paths.registryFile);
  const timestamp = context.now().toISOString();
  const service: Service = {
    name: input.name.trim().toLowerCase(),
    domain,
    port,
    mode: "attach",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const next = upsertService(registry, service);

  await ensureHostsWritable(context.paths.hostsFile);
  await writeRegistry(context.paths.registryFile, next);
  await writeHostsFile(context.paths.hostsFile, next.services);
  await writeCaddyfile(context.paths.caddyFile, next.services);
  await validateAndReloadCaddy(context.paths.caddyFile, context.run);

  return `Registered ${domain} -> localhost:${port}, 127.0.0.1:${port}`;
}

export async function removeRegisteredService(
  context: DevProxyContext,
  name: string,
): Promise<string> {
  ensureWindows(context);
  const registry = await readRegistry(context.paths.registryFile);
  const { registry: next, removed } = removeService(registry, name.trim().toLowerCase());

  await ensureHostsWritable(context.paths.hostsFile);
  await writeRegistry(context.paths.registryFile, next);
  await writeHostsFile(context.paths.hostsFile, next.services);
  await writeCaddyfile(context.paths.caddyFile, next.services);
  await validateAndReloadCaddy(context.paths.caddyFile, context.run);

  return `Removed ${removed.domain}`;
}

export async function listServices(context: DevProxyContext): Promise<string> {
  const registry = await readRegistry(context.paths.registryFile);
  if (registry.services.length === 0) {
    return "No services registered.";
  }

  const rows = registry.services.map((service) => {
    return `${service.name.padEnd(24)} https://${service.domain.padEnd(32)} -> localhost:${service.port}, 127.0.0.1:${service.port}`;
  });

  return ["Registered services:", ...rows].join("\n");
}

export async function doctor(context: DevProxyContext): Promise<string> {
  const checks: string[] = [];
  checks.push(
    `${context.platform === "win32" ? "ok" : "warn"} Windows platform: ${context.platform}`,
  );

  const caddy = await context.run("caddy", ["version"]);
  checks.push(`${caddy.code === 0 ? "ok" : "fail"} Caddy on PATH`);

  checks.push(
    `${(await canWriteHosts(context.paths.hostsFile)) ? "ok" : "warn"} Hosts file writable`,
  );
  checks.push(`info Registry: ${context.paths.registryFile}`);
  checks.push(`info Caddyfile: ${context.paths.caddyFile}`);
  checks.push(
    `info Generated Caddyfile preview:\n${generateCaddyfile((await readRegistry(context.paths.registryFile)).services)}`,
  );

  if (caddy.code !== 0) {
    checks.push("hint Install Caddy and run `caddy trust` from an elevated PowerShell session.");
  }

  return checks.join("\n");
}

export async function startCaddyServer(context: DevProxyContext): Promise<string> {
  ensureWindows(context);
  const registry = await readRegistry(context.paths.registryFile);
  if (registry.services.length === 0) {
    throw new DevProxyError("No services registered. Add a service before starting Caddy.");
  }

  await writeCaddyfile(context.paths.caddyFile, registry.services);
  await validateAndReloadCaddy(context.paths.caddyFile, context.run);

  return `Caddy is running with ${registry.services.length} registered service(s).`;
}

export async function stopCaddyServer(context: DevProxyContext): Promise<string> {
  ensureWindows(context);
  const result = await stopCaddy(context.paths.caddyFile, context.run);

  if (result === "not-running") {
    return "Caddy is not running.";
  }

  return "Caddy stopped.";
}

function ensureWindows(context: DevProxyContext): void {
  if (context.platform !== "win32") {
    throw new DevProxyError("DevProxy currently supports Windows only.");
  }
}
