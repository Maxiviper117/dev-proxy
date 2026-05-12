import { platform } from "node:os";
import type { DevProxyContext } from "../core/types.js";
import { confirm } from "../cli/prompt.js";
import { createElevationChecker, createWindowsElevationInvoker } from "./elevation.js";
import { openDefaultBrowser } from "./browser.js";
import { defaultPaths } from "./paths.js";
import { probeHttpsUrl, probeTcpPort, probeUrl } from "./probes.js";
import { runCommand } from "./runner.js";

/**
 * Create a default {@link DevProxyContext} backed by real platform integrations.
 */
export function createDefaultContext(cliPath = process.argv[1] ?? ""): DevProxyContext {
  const runtimePlatform = platform();
  const elevate = createWindowsElevationInvoker(
    runtimePlatform,
    runCommand,
    process.execPath,
    cliPath,
  );

  return {
    paths: defaultPaths(process.env, runtimePlatform),
    run: runCommand,
    now: () => new Date(),
    platform: runtimePlatform,
    probeTcp: probeTcpPort,
    probeUrl: probeUrl,
    probeHttps: probeHttpsUrl,
    openUrl: openDefaultBrowser,
    confirm,
    isElevated: createElevationChecker(runtimePlatform, runCommand),
    ...(elevate ? { elevate } : {}),
  };
}
