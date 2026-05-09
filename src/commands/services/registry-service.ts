import type { DevProxyContext, Service } from "../../core/types.js";
import { ensureHostsWritable, writeHostsFile } from "../../integrations/hosts.js";
import { validateAndReloadCaddy } from "../../integrations/caddy.js";
import { ensureSupportedPlatform } from "../../platform/support.js";
import { projectConfigPath, readProjectConfig, writeProjectConfig } from "../../core/config.js";
import { readRegistry, removeService } from "../../core/registry.js";
import { AttachServiceRegistrar, writeProxyArtifacts, type ServiceInput } from "./shared.js";
import { confirm } from "../../cli/prompt.js";

export class RegistryService {
  constructor(private readonly context: DevProxyContext) {}

  async initProjectConfig(cwd: string, input?: ServiceInput): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const configPath = projectConfigPath(cwd);
    const existingConfig = await readProjectConfig(configPath);

    let effectiveInput: ServiceInput;

    if (existingConfig) {
      const prompt = this.context.confirm ?? confirm;
      const detailLine = `  name: ${existingConfig.name}\n  port: ${existingConfig.port}`;

      if (!input || (input.name === undefined && input.port === undefined)) {
        const accepted = await prompt({
          message: `Found existing .devproxy/config.json:\n${detailLine}\n\nUse this config?`,
          default: false,
        });
        if (!accepted) {
          return "Initialization aborted. Provide --name and --port to create a new config.";
        }
      } else {
        const accepted = await prompt({
          message: `Found existing .devproxy/config.json:\n${detailLine}\n\nUse this config?`,
          default: false,
        });
        if (!accepted) {
          effectiveInput = input;
          const result = await new AttachServiceRegistrar(this.context).register(effectiveInput, {
            writeProjectConfig: async (service: Service) => {
              await writeProjectConfig(configPath, {
                name: service.name,
                port: service.port,
              });
            },
          });
          if (result.message === "Registration aborted.") {
            return result.message;
          }
          return `${result.message} Config saved to ${configPath}.`;
        }
      }

      effectiveInput = { name: existingConfig.name, port: existingConfig.port };
    } else {
      if (!input || input.name === undefined || input.port === undefined) {
        return "No .devproxy/config.json found. Provide --name and --port to create one.";
      }
      effectiveInput = input;
    }

    const result = await new AttachServiceRegistrar(this.context).register(effectiveInput, {
      writeProjectConfig: async (service: Service) => {
        await writeProjectConfig(configPath, {
          name: service.name,
          port: service.port,
          ...(existingConfig?.open ? { open: existingConfig.open } : {}),
        });
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

  async syncHosts(): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const registry = await readRegistry(this.context.paths.registryFile);

    await ensureHostsWritable(this.context.paths.hostsFile, this.context.platform);
    await writeHostsFile(this.context.paths.hostsFile, registry.services, this.context.platform);

    return `Hosts file aligned with ${registry.services.length} registered service(s).`;
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
