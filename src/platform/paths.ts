import { posix, win32 } from "node:path";
import { homedir, platform as currentPlatform } from "node:os";
import type { RuntimePaths } from "../core/types.js";
import type { SupportedPlatform } from "./support.js";
import { ensureSupportedPlatform } from "./support.js";

/**
 * Resolve default runtime paths from environment variables.
 *
 * Uses platform-native user data directories and hosts-file locations. Caddy's
 * root CA path follows its default storage conventions for each platform.
 */
export function defaultPaths(
  env: NodeJS.ProcessEnv = process.env,
  targetPlatform: NodeJS.Platform = currentPlatform(),
): RuntimePaths {
  ensureSupportedPlatform(targetPlatform);

  const supportedPlatform = targetPlatform;
  return pathsForPlatform(supportedPlatform, env);
}

function pathsForPlatform(targetPlatform: SupportedPlatform, env: NodeJS.ProcessEnv): RuntimePaths {
  if (targetPlatform === "win32") {
    return windowsPaths(env);
  }

  if (targetPlatform === "darwin") {
    return macosPaths(env);
  }

  return linuxPaths(env);
}

function windowsPaths(env: NodeJS.ProcessEnv): RuntimePaths {
  const appData = env.APPDATA ?? win32.join(env.USERPROFILE ?? process.cwd(), "AppData", "Roaming");
  const appDir = win32.join(appData, "devproxy");

  return {
    appDir,
    registryFile: win32.join(appDir, "registry.json"),
    caddyFile: win32.join(appDir, "Caddyfile"),
    hostsFile: win32.join(env.SystemRoot ?? "C:\\Windows", "System32", "drivers", "etc", "hosts"),
    caddyRootCAPath: win32.join(appData, "Caddy", "pki", "authorities", "local", "root.crt"),
  };
}

function macosPaths(env: NodeJS.ProcessEnv): RuntimePaths {
  const home = env.HOME ?? homedir();
  const appDir = posix.join(home, "Library", "Application Support", "devproxy");
  const caddyDataDir = posix.join(home, "Library", "Application Support", "Caddy");

  return {
    appDir,
    registryFile: posix.join(appDir, "registry.json"),
    caddyFile: posix.join(appDir, "Caddyfile"),
    hostsFile: "/etc/hosts",
    caddyRootCAPath: posix.join(caddyDataDir, "pki", "authorities", "local", "root.crt"),
  };
}

function linuxPaths(env: NodeJS.ProcessEnv): RuntimePaths {
  const home = env.HOME ?? homedir();
  const xdgDataHome = env.XDG_DATA_HOME ?? posix.join(home, ".local", "share");
  const appDir = posix.join(xdgDataHome, "devproxy");
  const caddyDataDir = posix.join(xdgDataHome, "caddy");

  return {
    appDir,
    registryFile: posix.join(appDir, "registry.json"),
    caddyFile: posix.join(appDir, "Caddyfile"),
    hostsFile: "/etc/hosts",
    caddyRootCAPath: posix.join(caddyDataDir, "pki", "authorities", "local", "root.crt"),
  };
}
