export {
  addService,
  createDefaultContext,
  doctor,
  listServices,
  removeRegisteredService,
  startCaddyServer,
  stopCaddyServer,
} from "./commands/services.js";
export { generateCaddyfile } from "./integrations/caddy.js";
export { domainFromName, parsePort, validateName } from "./core/domain.js";
export { updateHostsContent } from "./integrations/hosts.js";
export type { DevProxyContext, Registry, RuntimePaths, Service } from "./core/types.js";
