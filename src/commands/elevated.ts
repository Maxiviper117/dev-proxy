import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DevProxyError } from "../core/errors.js";
import { readRegistry } from "../core/registry.js";
import type { CommandRunner, ElevationRequest } from "../core/types.js";
import { createElevationChecker } from "../platform/elevation.js";
import { ensureCaddyAvailable, ensureCaddyTrusted } from "../integrations/caddy.js";
import { writeHostsFile } from "../integrations/hosts.js";

export async function runElevatedRequest(
  request: ElevationRequest & { platform: NodeJS.Platform; run: CommandRunner },
): Promise<{ code: number; stdout: string; stderr: string }> {
  const isElevated = createElevationChecker(request.platform, request.run);

  if (!(await isElevated())) {
    return {
      code: 1,
      stdout: "",
      stderr: "Elevated helper must run with administrator privileges.",
    };
  }

  if (request.kind === "hosts-sync") {
    const registry = await readRegistry(request.registryFile);
    await writeHostsFile(request.hostsFile, registry.services, request.platform);

    return {
      code: 0,
      stdout: `Hosts file aligned with ${registry.services.length} registered service(s).`,
      stderr: "",
    };
  }

  await ensureCaddyAvailable(request.run);
  const trust = await ensureCaddyTrusted(request.run, request.rootCAPath, async () => true);

  if (trust === "already-trusted") {
    return {
      code: 0,
      stdout: "Caddy root CA certificate is already trusted.",
      stderr: "",
    };
  }

  if (trust === "trusted") {
    return {
      code: 0,
      stdout: "Caddy root CA certificate trusted successfully.",
      stderr: "",
    };
  }

  throw new DevProxyError(
    "Caddy root CA certificate could not be trusted automatically from the elevated helper.",
  );
}

export async function writeElevatedResult(
  resultPath: string,
  result: { code: number; stdout: string; stderr: string },
): Promise<void> {
  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, JSON.stringify(result), "utf8");
}
