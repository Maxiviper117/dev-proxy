import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { RegistryService } from "../src/commands/services.js";
import { DevProxyError } from "../src/core/errors.js";
import { readRegistry } from "../src/core/registry.js";
import { buildProgram } from "../src/cli.js";
import { captureCommandOutput, createContext } from "./helpers/test-helpers.js";

describe("updateRegisteredService", () => {
  it("updates the port of an existing service", async () => {
    const context = await createContext();
    const svc = new RegistryService(context);
    await svc.addService({ name: "api.myapp", port: "8000" });

    const result = await svc.updateRegisteredService("api.myapp", { port: "9000" });
    expect(result).toContain("api.myapp.local");
    expect(result).toContain("port 8000 -> 9000");

    const registry = await readRegistry(context.paths.registryFile);
    expect(registry.services[0]!.port).toBe(9000);

    const caddyfile = await readFile(context.paths.caddyFile, "utf8");
    expect(caddyfile).toContain("reverse_proxy 127.0.0.1:9000");
    expect(caddyfile).not.toContain("reverse_proxy 127.0.0.1:8000");
  });

  it("renames a service and re-derives the domain", async () => {
    const context = await createContext();
    const svc = new RegistryService(context);
    await svc.addService({ name: "api", port: "8000" });

    const result = await svc.updateRegisteredService("api", { newName: "backend" });
    expect(result).toContain("backend.local");
    expect(result).toContain("renamed 'api' to 'backend'");

    const registry = await readRegistry(context.paths.registryFile);
    expect(registry.services).toHaveLength(1);
    expect(registry.services[0]!.name).toBe("backend");
    expect(registry.services[0]!.domain).toBe("backend.local");

    const hosts = await readFile(context.paths.hostsFile, "utf8");
    expect(hosts).toContain("127.0.0.1 backend.local");
    expect(hosts).not.toContain("api.local");
  });

  it("renames and changes port in a single update", async () => {
    const context = await createContext();
    const svc = new RegistryService(context);
    await svc.addService({ name: "api", port: "8000" });

    const result = await svc.updateRegisteredService("api", { newName: "backend", port: "9000" });
    expect(result).toContain("backend.local");
    expect(result).toContain("renamed 'api' to 'backend'");
    expect(result).toContain("port 8000 -> 9000");
  });

  it("reports no changes when the same values are provided", async () => {
    const context = await createContext();
    const svc = new RegistryService(context);
    await svc.addService({ name: "api", port: "8000" });

    const result = await svc.updateRegisteredService("api", {
      newName: "api",
      port: "8000",
    });
    expect(result).toContain("no changes applied");
  });

  it("throws when the service is not registered", async () => {
    const context = await createContext();
    await expect(
      new RegistryService(context).updateRegisteredService("missing", { port: "9000" }),
    ).rejects.toThrow(DevProxyError);
  });

  it("throws when neither --port nor --name is provided", async () => {
    const context = await createContext();
    const svc = new RegistryService(context);
    await svc.addService({ name: "api", port: "8000" });

    await expect(svc.updateRegisteredService("api", {})).rejects.toThrow(DevProxyError);
  });

  it("throws when the new name conflicts with an existing service", async () => {
    const context = await createContext();
    const svc = new RegistryService(context);
    await svc.addService({ name: "api", port: "8000" });
    await svc.addService({ name: "web", port: "5173" });

    await expect(svc.updateRegisteredService("api", { newName: "web" })).rejects.toThrow(
      DevProxyError,
    );
  });

  it("removes the old domain from the hosts file after rename", async () => {
    const context = await createContext();
    const svc = new RegistryService(context);
    await svc.addService({ name: "api", port: "8000" });

    await svc.updateRegisteredService("api", { newName: "gateway" });

    const hosts = await readFile(context.paths.hostsFile, "utf8");
    expect(hosts).toContain("gateway.local");
    expect(hosts).not.toContain("api.local");
  });
});

describe("update CLI command", () => {
  it("updates service port via CLI", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api", port: "8000" });

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "update",
      "api",
      "--port",
      "9000",
    ]);

    expect(output).toContain("api.local");
    expect(output).toContain("port 8000 -> 9000");
  });

  it("renames service via CLI --name option", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api", port: "8000" });

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "update",
      "api",
      "--name",
      "backend",
    ]);

    expect(output).toContain("backend.local");
    expect(output).toContain("renamed 'api' to 'backend'");
  });

  it("exits with error when the service does not exist", async () => {
    const context = await createContext();

    await expect(
      buildProgram(context).parseAsync(["node", "devproxy", "update", "missing", "--port", "9000"]),
    ).rejects.toThrow(DevProxyError);
  });
});
