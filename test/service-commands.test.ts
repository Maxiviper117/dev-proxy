import { chmod, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { RegistryService } from "../src/commands/services.js";
import { createContext } from "./helpers/test-helpers.js";

describe("service registration and removal", () => {
  it("adds and lists a service", async () => {
    const context = await createContext();

    await expect(
      new RegistryService(context).addService({ name: "api.myapp", port: "8000" }),
    ).resolves.toContain("api.myapp.local");
    await expect(
      new RegistryService(context).addService({ name: "web.myapp", port: "5173" }),
    ).resolves.toContain("(reloaded)");
    await expect(new RegistryService(context).listServices()).resolves.toContain(
      "127.0.0.1:8000, localhost:8000",
    );

    const caddyfile = await readFile(context.paths.caddyFile, "utf8");
    expect(caddyfile).toContain("api.myapp.local");
  });

  it("uses the elevation helper when the hosts file is not writable", async () => {
    const context = await createContext();
    await chmod(context.paths.hostsFile, 0o444);
    context.isElevated = async () => false;

    let hostsElevated = false;
    context.elevate = async (request) => {
      if (request.kind === "trust") {
        return {
          code: 0,
          stdout: "Caddy root CA certificate trusted successfully.",
          stderr: "",
        };
      }

      if (request.kind !== "hosts-sync") {
        throw new Error("Unexpected elevation request");
      }

      hostsElevated = true;
      const registry = JSON.parse(await readFile(request.registryFile, "utf8")) as {
        services: { domain: string }[];
      };
      await chmod(request.hostsFile, 0o644);
      const content = [
        "127.0.0.1 localhost",
        "# BEGIN DEVPROXY",
        ...registry.services.map((service) => `127.0.0.1 ${service.domain}`),
        "# END DEVPROXY",
        "",
      ].join("\n");
      await writeFile(request.hostsFile, content, "utf8");
      return {
        code: 0,
        stdout: `Hosts file aligned with ${registry.services.length} registered service(s).`,
        stderr: "",
      };
    };

    await expect(
      new RegistryService(context).addService({ name: "api.myapp", port: "8000" }),
    ).resolves.toContain("api.myapp.local");
    expect(hostsElevated).toBe(true);

    const hosts = await readFile(context.paths.hostsFile, "utf8");
    expect(hosts).toContain("api.myapp.local");
  });

  it("notifies when registering a service already on the same port", async () => {
    const context = await createContext();

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
    await expect(
      new RegistryService(context).addService({ name: "api.myapp", port: "8000" }),
    ).resolves.toBe(
      "Service 'api.myapp' is already registered on port 8000 for api.myapp.local (reloaded).",
    );
  });

  it("overwrites existing service when port differs and user confirms", async () => {
    const context = await createContext();
    let prompted = false;
    context.confirm = async () => {
      prompted = true;
      return true;
    };

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
    await expect(
      new RegistryService(context).addService({ name: "api.myapp", port: "9000" }),
    ).resolves.toContain("api.myapp.local");
    expect(prompted).toBe(true);

    const caddyfile = await readFile(context.paths.caddyFile, "utf8");
    expect(caddyfile).toContain("api.myapp.local");
    expect(caddyfile).toContain("reverse_proxy 127.0.0.1:9000");
  });

  it("aborts registration when overwrite prompt is declined", async () => {
    const context = await createContext();
    context.confirm = async () => false;

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
    await expect(
      new RegistryService(context).addService({ name: "api.myapp", port: "9000" }),
    ).resolves.toBe("Registration aborted.");
  });

  it("removes a service", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    await expect(new RegistryService(context).removeRegisteredService("api.myapp")).resolves.toBe(
      "Removed api.myapp.local",
    );
    await expect(new RegistryService(context).listServices()).resolves.toBe(
      "No services registered.",
    );
  });

  it("keeps the registry unchanged when elevated hosts sync is cancelled during remove", async () => {
    const context = await createContext();
    const registry = new RegistryService(context);
    await registry.addService({ name: "api.myapp", port: "8000" });
    context.isElevated = async () => false;
    context.elevate = async () => ({
      code: 1,
      stdout: "",
      stderr: "The operation was canceled by the user.",
    });

    await expect(registry.removeRegisteredService("api.myapp")).rejects.toThrow(
      "The operation was canceled by the user.",
    );
    await expect(registry.listServices()).resolves.toContain("api.myapp");
  });

  it("removes all services with --all", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
    await new RegistryService(context).addService({ name: "web.frontend", port: "5173" });

    context.confirm = async () => true;

    await expect(new RegistryService(context).removeAllServices()).resolves.toBe(
      "Removed all 2 registered service(s).",
    );
    await expect(new RegistryService(context).listServices()).resolves.toBe(
      "No services registered.",
    );
  });

  it("removes all services when no services are registered", async () => {
    const context = await createContext();

    await expect(new RegistryService(context).removeAllServices()).resolves.toBe(
      "No services registered.",
    );
  });

  it("cancels --all on first confirmation decline", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    context.confirm = async () => false;

    await expect(new RegistryService(context).removeAllServices()).resolves.toBe(
      "Removal cancelled.",
    );
  });

  it("cancels --all on second confirmation decline", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    let calls = 0;
    context.confirm = async () => {
      calls++;
      return calls < 2;
    };

    await expect(new RegistryService(context).removeAllServices()).resolves.toBe(
      "Removal cancelled.",
    );
    expect(calls).toBe(2);
  });

  it("interactively removes selected services", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
    await new RegistryService(context).addService({ name: "web.frontend", port: "5173" });

    context.checkbox = async () => ["api.myapp", "web.frontend"];
    context.confirm = async () => true;

    await expect(new RegistryService(context).interactiveRemove()).resolves.toBe(
      "Removed api.myapp.local, web.frontend.local",
    );
  });

  it("interactively removes a single selected service", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
    await new RegistryService(context).addService({ name: "web.frontend", port: "5173" });

    context.checkbox = async () => ["api.myapp"];
    context.confirm = async () => true;

    await expect(new RegistryService(context).interactiveRemove()).resolves.toBe(
      "Removed api.myapp.local",
    );
    await expect(new RegistryService(context).listServices()).resolves.toContain("web.frontend");
  });

  it("cancels interactive remove when confirm is declined", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    context.checkbox = async () => ["api.myapp"];
    context.confirm = async () => false;

    await expect(new RegistryService(context).interactiveRemove()).resolves.toBe(
      "Removal cancelled.",
    );
  });

  it("shows message when interactive remove has no registered services", async () => {
    const context = await createContext();

    await expect(new RegistryService(context).interactiveRemove()).resolves.toBe(
      "No services registered.",
    );
  });
});
