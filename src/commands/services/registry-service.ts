import { ensureSupportedPlatform } from "../../platform/support.js";
import { projectConfigPath, writeProjectConfig } from "../../core/config.js";
import { readRegistry, removeService } from "../../core/registry.js";
import type { DevProxyContext, Service } from "../../core/types.js";
import { ensureHostsWritable } from "../../integrations/hosts.js";
import { validateAndReloadCaddy } from "../../integrations/caddy.js";
import { AttachServiceRegistrar, writeProxyArtifacts, type ServiceInput } from "./shared.js";

export class RegistryService {
  constructor(private readonly context: DevProxyContext) {}

  async initProjectConfig(cwd: string, input: ServiceInput): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const configPath = projectConfigPath(cwd);
    const result = await new AttachServiceRegistrar(this.context).register(input, {
      writeProjectConfig: async (service: Service) => {
        await writeProjectConfig(configPath, { name: service.name, port: service.port });
      },
    });

    if (result.message === "Registration aborted.") {
      return result.message;
    }

    return `${result.message} Config saved to ${configPath}.`;
  }

  async addService(input: ServiceInput): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const result = await new AttachServiceRegistrar(this.context).register(input);
    return result.message;
  }

  async removeRegisteredService(name: string): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const registry = await readRegistry(this.context.paths.registryFile);
    const { registry: next, removed } = removeService(registry, name.trim().toLowerCase());

    await ensureHostsWritable(this.context.paths.hostsFile, this.context.platform);
    await writeProxyArtifacts(this.context, next);
    await validateAndReloadCaddy(this.context.paths.caddyFile, this.context.run);

    return `Removed ${removed.domain}`;
  }

  async listServices(): Promise<string> {
    const registry = await readRegistry(this.context.paths.registryFile);
    if (registry.services.length === 0) {
      return "No services registered.";
    }

    const rows = registry.services.map((service) => {
      return `${service.name.padEnd(24)} https://${service.domain.padEnd(32)} -> 127.0.0.1:${service.port}, localhost:${service.port}`;
    });

    return ["Registered services:", ...rows].join("\n");
  }

  async getListData(): Promise<{ services: Service[] }> {
    const registry = await readRegistry(this.context.paths.registryFile);
    return { services: registry.services };
  }
}
