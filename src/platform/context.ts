import { platform } from "node:os";
import type { DevProxyContext } from "../core/types.js";
import { createElevationChecker } from "./elevation.js";
import { openDefaultBrowser } from "./browser.js";
import { defaultPaths } from "./paths.js";
import { probeHttpsUrl, probeTcpPort, probeUrl } from "./probes.js";
import { runCommand } from "./runner.js";

/**
 * Create a default {@link DevProxyContext} backed by real platform integrations.
 */
export function createDefaultContext(): DevProxyContext {
  const runtimePlatform = platform();

  return {
    paths: defaultPaths(process.env, runtimePlatform),
    run: runCommand,
    now: () => new Date(),
    platform: runtimePlatform,
    probeTcp: probeTcpPort,
    probeUrl: probeUrl,
    probeHttps: probeHttpsUrl,
    openUrl: openDefaultBrowser,
    isElevated: createElevationChecker(runtimePlatform, runCommand),
  };
}
