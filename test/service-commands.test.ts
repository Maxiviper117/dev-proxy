import { readFile } from "node:fs/promises";
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
