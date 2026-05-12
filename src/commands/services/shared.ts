import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { confirm } from "../../cli/prompt.js";
import { domainFromName, parsePort } from "../../core/domain.js";
import { findService, readRegistry, upsertService, writeRegistry } from "../../core/registry.js";
import { DevProxyError } from "../../core/errors.js";
import type { DevProxyContext, Registry, Service } from "../../core/types.js";
import {
  ensureCaddyTrusted,
  validateAndReloadCaddy,
  writeCaddyfile,
} from "../../integrations/caddy.js";
import { canWriteHosts, hostsPermissionMessage, writeHostsFile } from "../../integrations/hosts.js";

export type ServiceInput = { name: string; port: string | number };

export function formatCaddyLifecycle(lifecycle: "reloaded" | "started"): string {
  return lifecycle === "started" ? "started" : "reloaded";
}

export class AttachServiceRegistrar {
  constructor(private readonly context: DevProxyContext) {}

  async register(
    input: ServiceInput,
    options: { writeProjectConfig?: (service: Service) => Promise<void> } = {},
  ): Promise<{ service?: Service; message: string; changed: boolean }> {
    const domain = domainFromName(input.name);
    const port = parsePort(input.port);
    const registry = await readRegistry(this.context.paths.registryFile);
    const name = input.name.trim().toLowerCase();

    const existing = findService(registry, name, domain);
    if (existing) {
      if (existing.port === port) {
        await syncHostsBlock(this.context, registry.services);
        await options.writeProjectConfig?.(existing);
        await writeRegistryAndCaddy(this.context, registry);
        const caddyLifecycle = await validateAndReloadCaddy(
          this.context.paths.caddyFile,
          this.context.run,
        );
        return {
          changed: false,
          message: `Service '${existing.name}' is already registered on port ${port} for ${domain} (${formatCaddyLifecycle(caddyLifecycle)}).`,
          service: existing,
        };
      }

      const prompt = this.context.confirm ?? confirm;
      const confirmed = await prompt({
        message: `Service '${existing.name}' already exists for ${existing.domain} on port ${existing.port}. Overwrite with port ${port}?`,
        default: false,
      });
      if (!confirmed) {
        return { changed: false, message: "Registration aborted." };
      }
    }

    const timestamp = this.context.now().toISOString();
    const service: Service = {
      name,
      domain,
      port,
      mode: "attach",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const next = upsertService(registry, service);

    await syncHostsBlock(this.context, next.services);
    await options.writeProjectConfig?.(service);
    await writeRegistryAndCaddy(this.context, next);
    const trustResult = await ensureCaddyTrusted(
      this.context.run,
      this.context.paths.caddyRootCAPath,
      this.context.isElevated ?? (async () => false),
    );
    if (
      trustResult === "not-elevated" &&
      this.context.platform === "win32" &&
      this.context.elevate
    ) {
      const elevated = await this.context.elevate({
        kind: "trust",
        rootCAPath: this.context.paths.caddyRootCAPath,
      });

      if (elevated.code !== 0) {
        throw new DevProxyError(
          elevated.stderr ||
            elevated.stdout ||
            "Caddy root CA certificate could not be trusted automatically.",
        );
      }
    }
    const caddyLifecycle = await validateAndReloadCaddy(
      this.context.paths.caddyFile,
      this.context.run,
    );

    return {
      changed: true,
      message: `Registered ${domain} -> 127.0.0.1:${port}, localhost:${port} (${formatCaddyLifecycle(caddyLifecycle)}).`,
      service,
    };
  }
}

export async function writeRegistryAndCaddy(
  context: DevProxyContext,
  registry: Registry,
): Promise<void> {
  await writeRegistry(context.paths.registryFile, registry);
  await writeCaddyfile(context.paths.caddyFile, registry.services);
}

export async function applyRegistryHostsAndCaddy(
  context: DevProxyContext,
  registry: Registry,
): Promise<void> {
  await syncHostsBlock(context, registry.services);
  await writeRegistryAndCaddy(context, registry);
}

export async function syncHostsBlock(
  context: DevProxyContext,
  services: readonly Service[],
): Promise<void> {
  if (context.platform === "win32" && context.elevate) {
    const isElevated = context.isElevated ? await context.isElevated() : false;
    if (!isElevated) {
      await runElevatedHostsSync(context, services);
      return;
    }
  }

  try {
    if (await canWriteHosts(context.paths.hostsFile)) {
      await writeHostsFile(context.paths.hostsFile, services, context.platform);
      return;
    }
  } catch (error) {
    if (context.platform === "win32" && context.elevate && isPermissionError(error)) {
      await runElevatedHostsSync(context, services);
      return;
    }

    throw error;
  }

  if (context.platform === "win32" && context.elevate) {
    await runElevatedHostsSync(context, services);
    return;
  }

  throw new DevProxyError(hostsPermissionMessage(context.paths.hostsFile, context.platform));
}

async function runElevatedHostsSync(
  context: DevProxyContext,
  services: readonly Service[],
): Promise<void> {
  if (context.platform === "win32" && context.elevate) {
    const tempDir = await mkdtemp(join(tmpdir(), "devproxy-hosts-sync-"));
    const registryFile = join(tempDir, "registry.json");

    try {
      await writeRegistry(registryFile, {
        version: 1,
        services: [...services],
      });

      const result = await context.elevate({
        kind: "hosts-sync",
        registryFile,
        hostsFile: context.paths.hostsFile,
      });

      if (result.code === 0) {
        return;
      }

      throw new DevProxyError(
        result.stderr ||
          result.stdout ||
          hostsPermissionMessage(context.paths.hostsFile, context.platform),
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  throw new DevProxyError(hostsPermissionMessage(context.paths.hostsFile, context.platform));
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EACCES")
  );
}
