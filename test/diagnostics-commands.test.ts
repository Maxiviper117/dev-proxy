import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DiagnosticsService, RegistryService } from "../src/commands/services.js";
import { createContext, createContextWithRunner } from "./helpers/test-helpers.js";
import { captureCommandOutput } from "./helpers/test-helpers.js";
import { buildProgram } from "../src/cli.js";

describe("diagnostics commands", () => {
  it("shows the CLI version in doctor output", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "doctor",
    ]);

    expect(output).toContain("DevProxy version:");
    expect(output).toContain(buildProgram(context).version());
    expect(output).toContain("Registry:");
    expect(output).toContain("Caddyfile:");
    expect(output).not.toContain("Generated Caddyfile preview");
    expect(output).not.toContain("reverse_proxy 127.0.0.1:8000");
  });

  it("doctor warns when Caddy is not installed", async () => {
    const context = await createContextWithRunner(async () => ({
      code: 127,
      stdout: "",
      stderr: "caddy not found",
    }));

    const output = await new DiagnosticsService(context).doctor();

    expect(output).toContain("fail Caddy not on PATH");
    expect(output).toContain("winget install CaddyServer.Caddy");
    expect(output).toContain("brew install caddy");
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

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    const output = await new DiagnosticsService(context).status();

    expect(output).toContain("ok Caddy on PATH");
    expect(output).toContain("ok Caddy admin endpoint on localhost:2019 is reachable");
    expect(output).toContain("info Registered services: 1");
    expect(output).toContain("ok https://api.myapp.local/ is reachable through Caddy");
    expect(output).toContain(
      "ok upstream api.myapp.local -> 127.0.0.1:8000 unreachable, localhost:8000 reachable",
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

    const output = await new DiagnosticsService(context).status();

    expect(output).toContain("info Registered services: 0");
    expect(output).toContain("info No services registered.");
  });

  it("list --json returns registered services", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "list",
      "--json",
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.services).toHaveLength(1);
    expect(parsed.services[0]).toMatchObject({
      name: "api.myapp",
      domain: "api.myapp.local",
      port: 8000,
      mode: "attach",
    });
  });

  it("list --json returns empty array when no services are registered", async () => {
    const context = await createContext();

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "list",
      "--json",
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.services).toEqual([]);
  });

  it("doctor --json returns structured checks", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "caddy version 2.8.0", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "doctor",
      "--json",
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.version).toBe(buildProgram(context).version());
    expect(parsed.platform).toBe("win32");
    expect(parsed.caddyOnPath).toBe(true);
    expect(parsed.hostsFileWritable).toBe(true);
    expect(parsed.hostsDrift).toMatchObject({
      actual: [],
      expected: [],
      extra: [],
      inSync: true,
      missing: [],
    });
    expect(typeof parsed.registryPath).toBe("string");
    expect(typeof parsed.caddyfilePath).toBe("string");
    expect(typeof parsed.caddyfilePreview).toBe("string");
    expect(parsed.hints).toEqual([]);
  });

  it("doctor --json warns when hosts entries drift from the registry", async () => {
    const context = await createContext();
    const registry = new RegistryService(context);
    await registry.addService({ name: "api.myapp", port: "8000" });
    await writeFile(
      context.paths.hostsFile,
      [
        "127.0.0.1 localhost",
        "# BEGIN DEVPROXY",
        "127.0.0.1 stale.local",
        "# END DEVPROXY",
        "",
      ].join("\n"),
      "utf8",
    );

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "doctor",
      "--json",
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.hostsDrift).toMatchObject({
      extra: ["stale.local"],
      inSync: false,
      missing: ["api.myapp.local"],
    });
    expect(parsed.hints).toContain(
      "Run 'devproxy sync-hosts' from an elevated terminal to align hosts.",
    );
  });

  it("sync-hosts aligns hosts entries with the registry", async () => {
    const context = await createContext();
    const registry = new RegistryService(context);
    await registry.addService({ name: "api.myapp", port: "8000" });
    await writeFile(
      context.paths.hostsFile,
      [
        "127.0.0.1 localhost",
        "# BEGIN DEVPROXY",
        "127.0.0.1 stale.local",
        "# END DEVPROXY",
        "",
      ].join("\n"),
      "utf8",
    );

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "sync-hosts",
    ]);

    expect(output).toContain("Hosts file aligned with 1 registered service");
    const hosts = await readFile(context.paths.hostsFile, "utf8");
    expect(hosts).toContain("127.0.0.1 api.myapp.local");
    expect(hosts).not.toContain("stale.local");
  });

  it("status --json returns structured status", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "caddy version 2.8.0", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    context.probeUrl = async (url) => url === "http://localhost:2019/config/";
    context.probeTcp = async (host, port) => host === "localhost" && port === 8000;
    context.probeHttps = async (url) => url === "https://api.myapp.local/";

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "status",
      "--json",
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.caddyInstalled).toBe(true);
    expect(parsed.caddyRunning).toBe(true);
    expect(parsed.serviceCount).toBe(1);
    expect(parsed.services).toHaveLength(1);
    expect(parsed.services[0]).toMatchObject({
      name: "api.myapp",
      domain: "api.myapp.local",
      port: 8000,
      domainReachable: true,
      localhostReachable: true,
      loopbackReachable: false,
    });
    expect(parsed.hints).toEqual([]);
  });
});
