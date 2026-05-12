import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RegistryService } from "../src/commands/services.js";
import { createContext } from "./helpers/test-helpers.js";

describe("init command", () => {
  it("creates a config file and registers the service", async () => {
    const context = await createContext();

    await expect(
      new RegistryService(context).initProjectConfig(context.paths.appDir, {
        name: "my-api",
        port: "9090",
      }),
    ).resolves.toContain("my-api.local");

    const configFile = join(context.paths.appDir, ".devproxy", "config.json");
    const raw = await readFile(configFile, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed).toMatchObject({ name: "my-api", port: 9090 });
    expect(parsed.$schema).toMatch(/config-schema\.json$/);

    const registry = await readFile(context.paths.registryFile, "utf8");
    const registryParsed = JSON.parse(registry);
    expect(registryParsed.services).toHaveLength(1);
    expect(registryParsed.services[0]).toMatchObject({
      name: "my-api",
      domain: "my-api.local",
      port: 9090,
      mode: "attach",
    });

    const caddyfile = await readFile(context.paths.caddyFile, "utf8");
    expect(caddyfile).toContain("my-api.local");
    expect(caddyfile).toContain("reverse_proxy 127.0.0.1:9090");
  });

  it("does not write config or registry when elevated hosts sync is cancelled", async () => {
    const context = await createContext();
    const configFile = join(context.paths.appDir, ".devproxy", "config.json");
    context.isElevated = async () => false;
    context.elevate = async () => ({
      code: 1,
      stdout: "",
      stderr: "The operation was canceled by the user.",
    });

    await expect(
      new RegistryService(context).initProjectConfig(context.paths.appDir, {
        name: "my-api",
        port: "9090",
      }),
    ).rejects.toThrow("The operation was canceled by the user.");

    await expect(readFile(configFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(new RegistryService(context).listServices()).resolves.toBe(
      "No services registered.",
    );
  });

  it("repairs hosts and Caddyfile when the service is already registered", async () => {
    const context = await createContext();
    const registry = new RegistryService(context);

    await registry.initProjectConfig(context.paths.appDir, {
      name: "my-api",
      port: "9090",
    });
    await writeFile(context.paths.hostsFile, "127.0.0.1 localhost\n", "utf8");
    await writeFile(context.paths.caddyFile, "", "utf8");

    context.confirm = async () => true;

    await expect(
      registry.initProjectConfig(context.paths.appDir, {
        name: "my-api",
        port: "9090",
      }),
    ).resolves.toContain("already registered");

    const hosts = await readFile(context.paths.hostsFile, "utf8");
    expect(hosts).toContain("127.0.0.1 my-api.local");

    const caddyfile = await readFile(context.paths.caddyFile, "utf8");
    expect(caddyfile).toContain("my-api.local");
    expect(caddyfile).toContain("reverse_proxy 127.0.0.1:9090");
  });

  it("validates the service name and port", async () => {
    const context = await createContext();

    await expect(
      new RegistryService(context).initProjectConfig(context.paths.appDir, {
        name: "",
        port: "8080",
      }),
    ).rejects.toThrow("Service name is required");
    await expect(
      new RegistryService(context).initProjectConfig(context.paths.appDir, {
        name: "api",
        port: "abc",
      }),
    ).rejects.toThrow("Port must be an integer");
  });

  it("without config or flags returns help message", async () => {
    const context = await createContext();

    await expect(
      new RegistryService(context).initProjectConfig(context.paths.appDir, undefined),
    ).resolves.toBe("No .devproxy/config.json found. Provide --name and --port to create one.");
  });

  it("with existing config and no flags, when confirmed, uses existing config", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;

    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "existing-app",
      port: "4000",
    });

    context.confirm = async () => true;

    await expect(
      new RegistryService(context).initProjectConfig(projectDir, undefined),
    ).resolves.toContain("already registered");

    const configFile = join(projectDir, ".devproxy", "config.json");
    const raw = await readFile(configFile, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed).toMatchObject({ name: "existing-app", port: 4000 });
    expect(parsed.$schema).toMatch(/config-schema\.json$/);
  });

  it("with existing config and no flags, when declined, aborts", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;

    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "existing-app",
      port: "4000",
    });

    context.confirm = async () => false;

    await expect(
      new RegistryService(context).initProjectConfig(projectDir, undefined),
    ).resolves.toBe("Initialization aborted. Provide --name and --port to create a new config.");
  });

  it("with existing config and flags, when confirmed, uses existing config", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;

    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "original",
      port: "3000",
    });

    context.confirm = async () => true;

    await expect(
      new RegistryService(context).initProjectConfig(projectDir, {
        name: "new-name",
        port: "5000",
      }),
    ).resolves.toContain("already registered");

    const configFile = join(projectDir, ".devproxy", "config.json");
    const raw = await readFile(configFile, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.name).toBe("original");
    expect(parsed.port).toBe(3000);
  });

  it("with existing config and flags, when declined, overwrites with new values", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;

    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "original",
      port: "3000",
    });

    context.confirm = async () => false;

    await expect(
      new RegistryService(context).initProjectConfig(projectDir, {
        name: "replacement",
        port: "5000",
      }),
    ).resolves.toContain("replacement.local");

    const configFile = join(projectDir, ".devproxy", "config.json");
    const raw = await readFile(configFile, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.name).toBe("replacement");
    expect(parsed.port).toBe(5000);
  });

  it("with existing config preserves open targets", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;

    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    const configFile = join(projectDir, ".devproxy", "config.json");
    const raw = await readFile(configFile, "utf8");
    const config = JSON.parse(raw) as Record<string, unknown>;
    config.open = { default: "/", targets: { docs: "/docs" } };
    await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    context.confirm = async () => true;

    await new RegistryService(context).initProjectConfig(projectDir, undefined);

    const updated = await readFile(configFile, "utf8");
    const updatedConfig = JSON.parse(updated);
    expect(updatedConfig.open).toEqual({ default: "/", targets: { docs: "/docs" } });
  });
});
