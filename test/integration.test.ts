import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createTempContext, type TempContext } from "./helpers/temp-context.js";
import {
  addService,
  removeRegisteredService,
  listServices,
  startCaddyServer,
  stopCaddyServer,
  doctor,
  getStatusData,
} from "../src/commands/services.js";
import { DevProxyError } from "../src/core/errors.js";
import { generateCaddyfile, writeCaddyfile } from "../src/integrations/caddy.js";
import { readRegistry, writeRegistry } from "../src/core/registry.js";
import { writeHostsFile } from "../src/integrations/hosts.js";

describe("integration: registry, hosts, and caddyfile", () => {
  let temp: TempContext;

  beforeAll(async () => {
    temp = await createTempContext();
  });

  afterAll(async () => {
    await temp.cleanup();
  });

  it("writes and reads the registry to a temp file", async () => {
    const registry = await readRegistry(temp.paths.registryFile);
    expect(registry.services).toEqual([]);

    await writeRegistry(temp.paths.registryFile, {
      version: 1,
      services: [
        {
          name: "api",
          domain: "api.local",
          port: 3000,
          mode: "attach",
          createdAt: "2026-01-15T12:00:00.000Z",
          updatedAt: "2026-01-15T12:00:00.000Z",
        },
      ],
    });

    const updated = await readRegistry(temp.paths.registryFile);
    expect(updated.services).toHaveLength(1);
    expect(updated.services[0]!.name).toBe("api");
  });

  it("updates hosts file content without touching the real system hosts", async () => {
    const services = [
      {
        name: "api",
        domain: "api.local",
        port: 3000,
        mode: "attach" as const,
        createdAt: "2026-01-15T12:00:00.000Z",
        updatedAt: "2026-01-15T12:00:00.000Z",
      },
    ];

    await writeHostsFile(temp.paths.hostsFile, services, "linux");

    const content = await readFile(temp.paths.hostsFile, "utf8");
    expect(content).toContain("# BEGIN DEVPROXY");
    expect(content).toContain("127.0.0.1 api.local");
    expect(content).toContain("# END DEVPROXY");
  });

  it("removes the DevProxy block when no services remain", async () => {
    await writeHostsFile(
      temp.paths.hostsFile,
      [
        {
          name: "api",
          domain: "api.local",
          port: 3000,
          mode: "attach" as const,
          createdAt: "2026-01-15T12:00:00.000Z",
          updatedAt: "2026-01-15T12:00:00.000Z",
        },
      ],
      "linux",
    );

    await writeHostsFile(temp.paths.hostsFile, [], "linux");

    const content = await readFile(temp.paths.hostsFile, "utf8");
    expect(content).not.toContain("# BEGIN DEVPROXY");
  });

  it("generates a Caddyfile with admin port for integration isolation", () => {
    const services = [
      {
        name: "api",
        domain: "api.local",
        port: 3000,
        mode: "attach" as const,
        createdAt: "2026-01-15T12:00:00.000Z",
        updatedAt: "2026-01-15T12:00:00.000Z",
      },
    ];

    const caddyfile = generateCaddyfile(services, { adminPort: 2020 });

    expect(caddyfile).toContain("admin localhost:2020");
    expect(caddyfile).toContain("api.local {");
    expect(caddyfile).toContain("tls internal");
  });

  it("writes Caddyfile to temp directory", async () => {
    const services = [
      {
        name: "web",
        domain: "web.local",
        port: 8080,
        mode: "attach" as const,
        createdAt: "2026-01-15T12:00:00.000Z",
        updatedAt: "2026-01-15T12:00:00.000Z",
      },
    ];

    await writeCaddyfile(temp.paths.caddyFile, services, { adminPort: 2020 });

    const content = await readFile(temp.paths.caddyFile, "utf8");
    expect(content).toContain("web.local {");
    expect(content).toContain("reverse_proxy 127.0.0.1:8080 localhost:8080");
    expect(content).toContain("admin localhost:2020");
  });
});

describe("integration: add and remove services through command stack", () => {
  let temp: TempContext;

  beforeAll(async () => {
    temp = await createTempContext();
  });

  afterAll(async () => {
    await temp.cleanup();
  });

  it("registers a service end-to-end", async () => {
    const result = await addService(temp.ctx, { name: "api", port: 3000 });

    expect(result).toContain("api.local");
    expect(result).toContain("3000");

    const registry = await readRegistry(temp.paths.registryFile);
    expect(registry.services).toHaveLength(1);
    expect(registry.services[0]!.name).toBe("api");

    const hosts = await readFile(temp.paths.hostsFile, "utf8");
    expect(hosts).toContain("127.0.0.1 api.local");

    const caddyfile = await readFile(temp.paths.caddyFile, "utf8");
    expect(caddyfile).toContain("api.local {");
  });

  it("prevents duplicate registration on the same port", async () => {
    const result = await addService(temp.ctx, { name: "api", port: 3000 });

    expect(result).toContain("already registered");

    const registry = await readRegistry(temp.paths.registryFile);
    expect(registry.services).toHaveLength(1);
  });

  it("removes a service end-to-end", async () => {
    const result = await removeRegisteredService(temp.ctx, "api");

    expect(result).toContain("Removed api.local");

    const registry = await readRegistry(temp.paths.registryFile);
    expect(registry.services).toHaveLength(0);

    const hosts = await readFile(temp.paths.hostsFile, "utf8");
    expect(hosts).not.toContain("api.local");
  });

  it("throws when removing a non-existent service", async () => {
    await expect(removeRegisteredService(temp.ctx, "missing")).rejects.toThrow(DevProxyError);
  });
});

describe("integration: list and status with stub Caddy", () => {
  let temp: TempContext;

  beforeAll(async () => {
    temp = await createTempContext();
  });

  afterAll(async () => {
    await temp.cleanup();
  });

  it("lists zero services when registry is empty", async () => {
    const result = await listServices(temp.ctx);

    expect(result).toContain("No services registered");
  });

  it("lists registered services", async () => {
    await addService(temp.ctx, { name: "myapp", port: 4000 });

    const result = await listServices(temp.ctx);

    expect(result).toContain("myapp");
    expect(result).toContain("myapp.local");

    await removeRegisteredService(temp.ctx, "myapp");
  });

  it("runs doctor with stub Caddy", async () => {
    const result = await doctor(temp.ctx);

    expect(result).toContain("ok Supported platform");
    expect(result).toContain("ok Caddy on PATH");
  });

  it("returns status data with stub probes", async () => {
    await addService(temp.ctx, { name: "status-app", port: 5000 });

    const data = await getStatusData({
      ...temp.ctx,
      probeTcp: async () => true,
      probeUrl: async () => true,
      probeHttps: async () => false,
    });

    expect(data.caddyInstalled).toBe(true);
    expect(data.caddyRunning).toBe(true);
    expect(data.services).toHaveLength(1);
    expect(data.services[0]!.domainReachable).toBe(false);
    expect(data.services[0]!.localhostReachable).toBe(true);

    await removeRegisteredService(temp.ctx, "status-app");
  });
});

describe("integration: Caddy lifecycle through command stack", () => {
  let temp: TempContext;

  beforeAll(async () => {
    temp = await createTempContext();
  });

  afterAll(async () => {
    await temp.cleanup();
  });

  it("starts Caddy with registered services", async () => {
    await addService(temp.ctx, { name: "starttest", port: 6000 });

    const result = await startCaddyServer(temp.ctx);

    expect(result).toContain("1 registered service(s).");

    await removeRegisteredService(temp.ctx, "starttest");
  });

  it("stops Caddy", async () => {
    const result = await stopCaddyServer(temp.ctx);

    expect(result).toContain("stopped");
  });

  it("reports Caddy not running when already stopped", async () => {
    const notRunningRun = temp.ctx.run;
    const ctx = {
      ...temp.ctx,
      run: async (command: string, args: readonly string[]) => {
        if (command === "caddy" && args[0] === "stop") {
          return {
            code: 1,
            stdout: "",
            stderr:
              'Error: performing request: Post "http://localhost:2019/stop": dial tcp [::1]:2019: connectex: No connection could be made because the target machine actively refused it.',
          };
        }
        return notRunningRun(command, args);
      },
    };
    const result = await stopCaddyServer(ctx);

    expect(result).toContain("not running");
  });
});
