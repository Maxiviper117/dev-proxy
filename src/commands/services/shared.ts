import { confirm } from "../../cli/prompt.js";
import { domainFromName, parsePort } from "../../core/domain.js";
import { findService, readRegistry, upsertService, writeRegistry } from "../../core/registry.js";
import type { DevProxyContext, Registry, Service } from "../../core/types.js";
import {
  ensureCaddyTrusted,
  validateAndReloadCaddy,
  writeCaddyfile,
} from "../../integrations/caddy.js";
import { ensureHostsWritable, writeHostsFile } from "../../integrations/hosts.js";

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
        await options.writeProjectConfig?.(existing);
        await ensureHostsWritable(this.context.paths.hostsFile, this.context.platform);
        await writeProxyArtifacts(this.context, registry);
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

    await ensureHostsWritable(this.context.paths.hostsFile, this.context.platform);
    await options.writeProjectConfig?.(service);
    await writeProxyArtifacts(this.context, next);
    if (this.context.isElevated) {
      await ensureCaddyTrusted(
        this.context.run,
        this.context.paths.caddyRootCAPath,
        this.context.isElevated,
      );
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

export async function writeProxyArtifacts(
  context: DevProxyContext,
  registry: Registry,
): Promise<void> {
  await writeRegistry(context.paths.registryFile, registry);
  await writeHostsFile(context.paths.hostsFile, registry.services, context.platform);
  await writeCaddyfile(context.paths.caddyFile, registry.services);
}
