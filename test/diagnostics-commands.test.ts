import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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

    const data = await new DiagnosticsService(context).getDoctorData();

    expect(data.caddyOnPath).toBe(false);
    expect(data.hints.length).toBeGreaterThan(0);
    expect(data.hints[0]).toContain("winget install CaddyServer.Caddy");
    expect(data.hints[0]).toContain("brew install caddy");
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

  it("doctor --fix syncs hosts drift", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
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

    const result = await new DiagnosticsService(context).doctor({
      fix: true,
      autoConfirm: true,
    });

    expect(result.fixResult).toBeDefined();
    expect(
      result.fixResult!.items.some((i) => i.action === "Hosts drift" && i.status === "fixed"),
    ).toBe(true);

    const hosts = await readFile(context.paths.hostsFile, "utf8");
    expect(hosts).toContain("127.0.0.1 api.myapp.local");
    expect(hosts).not.toContain("stale.local");
  });

  it("doctor --fix prompts before fixing", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
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

    context.confirm = async () => false;

    const result = await new DiagnosticsService(context).doctor({ fix: true });

    expect(result.fixResult).toBeDefined();
    expect(
      result.fixResult!.items.some((i) => i.action === "Hosts drift" && i.status === "skipped"),
    ).toBe(true);
  });

  it("doctor --fix calls confirm when available on context", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
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

    const confirmCalls: { message: string; default: boolean | undefined }[] = [];
    context.confirm = async (opts) => {
      confirmCalls.push({ message: opts.message, default: opts.default });
      return true;
    };

    const result = await new DiagnosticsService(context).doctor({ fix: true });

    expect(confirmCalls.length).toBeGreaterThanOrEqual(1);
    expect(confirmCalls.some((c) => c.message.includes("Hosts entries"))).toBe(true);
    expect(
      result.fixResult!.items.some((i) => i.action === "Hosts drift" && i.status === "fixed"),
    ).toBe(true);
  });

  it("doctor --fix confirm prompt has correct default value", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
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

    let capturedDefault: boolean | undefined;
    context.confirm = async (opts) => {
      capturedDefault = opts.default;
      return true;
    };

    await new DiagnosticsService(context).doctor({ fix: true });

    expect(capturedDefault).toBe(true);
  });

  it("doctor --fix --non-interactive skips prompts", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });
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

    const result = await new DiagnosticsService(context).doctor({
      fix: true,
      autoConfirm: true,
    });

    expect(result.fixResult!.fixed).toBeGreaterThanOrEqual(1);
    expect(
      result.fixResult!.items.some((i) => i.action === "Hosts drift" && i.status === "fixed"),
    ).toBe(true);
  });

  it("doctor --fix trusts cert when elevated", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "trust") {
        await mkdir(dirname(context.paths.caddyRootCAPath), { recursive: true });
        await writeFile(context.paths.caddyRootCAPath, "mock-cert", "utf8");
        return { code: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "version") {
        return { code: 0, stdout: "v2.8.4", stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    });
    context.isElevated = async () => true;

    const result = await new DiagnosticsService(context).doctor({
      fix: true,
      autoConfirm: true,
    });

    expect(result.fixResult).toBeDefined();
    expect(
      result.fixResult!.items.some((i) => i.action === "Root CA trust" && i.status === "fixed"),
    ).toBe(true);
  });

  it("doctor --fix shows cert manual when not elevated", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "v2.8.4", stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    });
    context.isElevated = async () => false;

    const result = await new DiagnosticsService(context).doctor({
      fix: true,
      autoConfirm: true,
    });

    expect(
      result.fixResult!.items.some((i) => i.action === "Root CA trust" && i.status === "manual"),
    ).toBe(true);
  });

  it("doctor --fix starts caddy when services exist", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "v2.8.4", stderr: "" };
      }
      if (args[0] === "validate") {
        return { code: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "reload") {
        return {
          code: 1,
          stdout: "",
          stderr: "connect: connection refused localhost:2019",
        };
      }
      if (args[0] === "start") {
        return { code: 0, stdout: "", stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    });
    context.probeUrl = async () => false;

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    const result = await new DiagnosticsService(context).doctor({
      fix: true,
      autoConfirm: true,
    });

    expect(
      result.fixResult!.items.some((i) => i.action === "Caddy start" && i.status === "fixed"),
    ).toBe(true);
  });

  it("doctor --fix --json returns structured fix result", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "doctor",
      "--fix",
      "--non-interactive",
      "--json",
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.fixResult).toBeDefined();
    expect(parsed.fixResult.fixed).toBeGreaterThanOrEqual(0);
    expect(parsed.fixResult.skipped).toBeGreaterThanOrEqual(0);
    expect(parsed.fixResult.manual).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(parsed.fixResult.items)).toBe(true);
  });

  it("doctor --fix marks missing Caddy as manual", async () => {
    const context = await createContextWithRunner(async () => ({
      code: 127,
      stdout: "",
      stderr: "caddy not found",
    }));

    const result = await new DiagnosticsService(context).doctor({
      fix: true,
      autoConfirm: true,
    });

    expect(
      result.fixResult!.items.some(
        (i) => i.action === "Caddy installation" && i.status === "manual",
      ),
    ).toBe(true);
  });
});
