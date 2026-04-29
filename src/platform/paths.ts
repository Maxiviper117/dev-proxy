import { join } from "node:path";
import type { RuntimePaths } from "../core/types.js";

export function defaultPaths(env: NodeJS.ProcessEnv = process.env): RuntimePaths {
  const appData = env.APPDATA ?? join(env.USERPROFILE ?? process.cwd(), "AppData", "Roaming");
  const appDir = join(appData, "devproxy");

  return {
    appDir,
    registryFile: join(appDir, "registry.json"),
    caddyFile: join(appDir, "Caddyfile"),
    hostsFile: join(env.SystemRoot ?? "C:\\Windows", "System32", "drivers", "etc", "hosts"),
  };
}
