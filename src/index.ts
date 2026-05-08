export {
  CaddyService,
  DiagnosticsService,
  ProjectService,
  RegistryService,
  type DoctorData,
  type StatusData,
  type StatusServiceData,
} from "./commands/services.js";
export { createDefaultContext } from "./platform/context.js";
export { generateCaddyfile, type CaddyfileOptions } from "./integrations/caddy.js";
export { domainFromName, parsePort, validateName } from "./core/domain.js";
export { updateHostsContent } from "./integrations/hosts.js";
export type { DevProxyContext, Registry, RuntimePaths, Service } from "./core/types.js";
