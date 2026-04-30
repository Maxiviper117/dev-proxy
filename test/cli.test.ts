import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addService,
  doctor,
  listServices,
  removeRegisteredService,
  status,
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
    await expect(addService(context, { name: "web.myapp", port: "5173" })).resolves.toContain(
      "(reloaded)",
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
      "Caddy reloaded with 1 registered service(s).",
    );
    await expect(stopCaddyServer(context)).resolves.toBe("Caddy stopped.");
  });

  it("reports when Caddy has to start instead of reload", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "reload") {
        return {
          code: 1,
          stdout: "",
          stderr:
            'Error: sending configuration to instance: performing request: Post "http://localhost:2019/load": dial tcp [::1]:2019: connectex: No connection could be made because the target machine actively refused it.',
        };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    await addService(context, { name: "api.myapp", port: "8000" });

    await expect(startCaddyServer(context)).resolves.toBe(
      "Caddy started with 1 registered service(s).",
    );
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

  it("reports Caddy and upstream status", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "caddy version 2.8.0", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    context.probeUrl = async (url) => url === "http://localhost:2019/config/";
    context.probeTcp = async (host, port) => host === "localhost" && port === 8000;
    context.probeHttps = async (url) => url === "https://api.myapp.local/";

    await addService(context, { name: "api.myapp", port: "8000" });

    const output = await status(context);

    expect(output).toContain("ok Caddy on PATH");
    expect(output).toContain("ok Caddy admin endpoint on localhost:2019 is reachable");
    expect(output).toContain("info Registered services: 1");
    expect(output).toContain("ok https://api.myapp.local/ is reachable through Caddy");
    expect(output).toContain(
      "ok upstream api.myapp.local -> localhost:8000 reachable, 127.0.0.1:8000 unreachable",
    );
  });

  it("reports when no services are registered", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "caddy version 2.8.0", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    context.probeUrl = async () => true;
    context.probeHttps = async () => true;

    const output = await status(context);

    expect(output).toContain("info Registered services: 0");
    expect(output).toContain("info No services registered.");
  });
});
