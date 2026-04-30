import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addService,
  doctor,
  listServices,
  removeRegisteredService,
  startCaddyServer,
  stopCaddyServer,
} from "../src/commands/services.js";
import type { CommandRunner, DevProxyContext } from "../src/core/types.js";

async function createContext(): Promise<DevProxyContext> {
  const dir = await mkdtemp(join(tmpdir(), "devproxy-test-"));
  const hostsFile = join(dir, "hosts");
  await writeFile(hostsFile, "127.0.0.1 localhost\n", "utf8");
  const run: CommandRunner = async () => ({ code: 0, stdout: "ok", stderr: "" });

  return {
    paths: {
      appDir: dir,
      registryFile: join(dir, "registry.json"),
      caddyFile: join(dir, "Caddyfile"),
      hostsFile,
    },
    run,
    now: () => new Date("2026-04-29T00:00:00.000Z"),
    platform: "win32",
  };
}

async function createContextWithRunner(run: CommandRunner): Promise<DevProxyContext> {
  const context = await createContext();
  return { ...context, run };
}

describe("app commands", () => {
  it("adds and lists a service", async () => {
    const context = await createContext();

    await expect(addService(context, { name: "api.myapp", port: "8000" })).resolves.toContain(
      "api.myapp.local",
    );
    await expect(listServices(context)).resolves.toContain("localhost:8000, 127.0.0.1:8000");

    const caddyfile = await readFile(context.paths.caddyFile, "utf8");
    expect(caddyfile).toContain("api.myapp.local");
  });

  it("allows the same service registration to be reapplied", async () => {
    const context = await createContext();

    await addService(context, { name: "api.myapp", port: "8000" });
    await expect(addService(context, { name: "api.myapp", port: "8000" })).resolves.toContain(
      "api.myapp.local",
    );
  });

  it("removes a service", async () => {
    const context = await createContext();
    await addService(context, { name: "api.myapp", port: "8000" });

    await expect(removeRegisteredService(context, "api.myapp")).resolves.toBe(
      "Removed api.myapp.local",
    );
    await expect(listServices(context)).resolves.toBe("No services registered.");
  });

  it("starts and stops Caddy using the current registry", async () => {
    const context = await createContext();
    await addService(context, { name: "api.myapp", port: "8000" });

    await expect(startCaddyServer(context)).resolves.toBe(
      "Caddy is running with 1 registered service(s).",
    );
    await expect(stopCaddyServer(context)).resolves.toBe("Caddy stopped.");
  });

  it("doctor warns when Caddy is not installed", async () => {
    const context = await createContextWithRunner(async () => ({
      code: 127,
      stdout: "",
      stderr: "caddy not found",
    }));

    const output = await doctor(context);

    expect(output).toContain("fail Caddy on PATH");
    expect(output).toContain("winget install CaddyServer.Caddy");
  });
});
