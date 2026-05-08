import { mkdir, rm, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import type { CommandRunner, DevProxyContext, RuntimePaths } from "../../src/core/types.js";

export type TempContext = {
  ctx: DevProxyContext;
  paths: RuntimePaths;
  tmpDir: string;
  cleanup: () => Promise<void>;
};

export function stubCaddyRun(): CommandRunner {
  return async (command, args) => {
    if (command === "caddy" && args[0] === "version") {
      return { code: 0, stdout: "v2.8.4", stderr: "" };
    }
    if (command === "caddy" && args[0] === "validate") {
      return { code: 0, stdout: "", stderr: "" };
    }
    if (command === "caddy" && args[0] === "reload") {
      return { code: 0, stdout: "", stderr: "" };
    }
    if (command === "caddy" && args[0] === "start") {
      return { code: 0, stdout: "", stderr: "" };
    }
    if (command === "caddy" && args[0] === "stop") {
      return { code: 0, stdout: "", stderr: "" };
    }
    if (command === "caddy" && args[0] === "trust") {
      return { code: 0, stdout: "", stderr: "" };
    }
    return { code: 0, stdout: "", stderr: "" };
  };
}

export async function createTempContext(options?: {
  run?: CommandRunner;
  platform?: NodeJS.Platform;
}): Promise<TempContext> {
  const tmpDir = await mkdtemp(join(tmpdir(), "devproxy-test-"));
  const caddyDataDir = join(tmpDir, "caddy-data");
  const appDir = join(tmpDir, "devproxy");

  const paths: RuntimePaths = {
    appDir,
    registryFile: join(appDir, "registry.json"),
    caddyFile: join(appDir, "Caddyfile"),
    hostsFile: join(tmpDir, "hosts"),
    caddyRootCAPath: join(caddyDataDir, "pki", "authorities", "local", "root.crt"),
  };

  await mkdir(dirname(paths.registryFile), { recursive: true });
  await mkdir(dirname(paths.caddyRootCAPath), { recursive: true });
  await writeFile(paths.hostsFile, "", "utf8");

  const ctx: DevProxyContext = {
    paths,
    run: options?.run ?? stubCaddyRun(),
    now: () => new Date("2026-01-15T12:00:00.000Z"),
    platform: options?.platform ?? ("linux" as NodeJS.Platform),
    isElevated: async () => true,
  };

  return {
    ctx,
    paths,
    tmpDir,
    cleanup: async () => {
      await rm(tmpDir, { recursive: true, force: true });
    },
  };
}
