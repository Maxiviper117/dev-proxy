import { join } from "node:path";
import type { RuntimePaths } from "../core/types.js";

/**
 * Resolve default runtime paths from environment variables.
 *
 * Uses `APPDATA` for the application directory and Caddy root CA path, and
 * `SystemRoot` for the Windows hosts file location. Falls back to sensible
 * defaults when variables are missing.
 */
export function defaultPaths(env: NodeJS.ProcessEnv = process.env): RuntimePaths {
  const appData = env.APPDATA ?? join(env.USERPROFILE ?? process.cwd(), "AppData", "Roaming");
  const appDir = join(appData, "devproxy");

  return {
    appDir,
    registryFile: join(appDir, "registry.json"),
    caddyFile: join(appDir, "Caddyfile"),
    hostsFile: join(env.SystemRoot ?? "C:\\Windows", "System32", "drivers", "etc", "hosts"),
    caddyRootCAPath: join(appData, "Caddy", "pki", "authorities", "local", "root.crt"),
  };
}
