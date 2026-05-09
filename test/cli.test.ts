import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildProgram, isCliEntrypoint } from "../src/cli.js";
import {
  CaddyService,
  DiagnosticsService,
  ProjectService,
  RegistryService,
} from "../src/commands/services.js";
import type { CommandRunner, DevProxyContext } from "../src/core/types.js";

const testCertificatePem = [
  "-----BEGIN CERTIFICATE-----",
  "MIIDGzCCAgOgAwIBAgIQIRIuSyG3BrJJQ7CZ2npYgzANBgkqhkiG9w0BAQsFADAV",
  "MRMwEQYDVQQDDAp0ZXN0LmxvY2FsMB4XDTI2MDUwMTA4NTEwOFoXDTI3MDUwMTA5",
  "MTEwOFowFTETMBEGA1UEAwwKdGVzdC5sb2NhbDCCASIwDQYJKoZIhvcNAQEBBQAD",
  "ggEPADCCAQoCggEBAMM5M/tT3L0X9sikwAS7YT8lVw/u6XWJGEC7emz5tYNfnDOy",
  "4VYbU8Pb/VpHL9Kct/EQRCVA9cVLA5PxrfVluEuMCACM9+QmsDlaioU/ZAOHnqT+",
  "+b9iKR7hzuzoWlktWz+jCNhSG8IUALYtaP0bxK0vat+pIdnPmiIq+jjDCQntiQ0w",
  "/OyhctBULn9wumguBakcuRXFz/cy9/QtTftJO70U2FDNiDjHPHcEklSrqdXzPDZO",
  "iQcGFSb+t1fcCNNC04D3/1XqLO8yinLt+WLb+Ioe4bhRANK3JPZujOgit7aYDME8",
  "pgRvjU5Hp/S/ysVP9PQOEAchdkxfttAD0m5o/GUCAwEAAaNnMGUwDgYDVR0PAQH/",
  "BAQDAgWgMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATAVBgNVHREEDjAM",
  "ggp0ZXN0LmxvY2FsMB0GA1UdDgQWBBQFzpkLp2cGswjRL0XJJmlvu50tazANBgkq",
  "hkiG9w0BAQsFAAOCAQEAPeqpcaz/nQXApt2c36DmnY2qFfJPMlcsmw5JwAAhbng7",
  "03OUBMzFfPCbOTm2dTfwaqXmkqChz15w69G9piGQ4xth8lhfJDOjeFXArn9Uhx88",
  "+n3HiW3OQUId4Uh1rtBG3Mgvrk+7OKmyJIVYLgfE3+Jnnk9xYa8MntFwKUzyfsNS",
  "bQUDgekzu/2gRwpAxviJaChhCxcLLJbjzT/JLHtq+P/9dcbajqF9RkMSxJLwH0gv",
  "R33HZa+CmowtyGXcNpUXGtHsiPln1KVEXUOFHQiYIGr9FZ5K4g36dteC2jUxbhgg",
  "SwodsemzJCcHHk/pqIZfZAKHS1lFFL87N2gJ0CjHuQ==",
  "-----END CERTIFICATE-----",
].join("\n");

/**
 * Create a temporary {@link DevProxyContext} isolated for a single test.
 *
 * Uses a temp directory for all paths and a no-op command runner so tests do
 * not touch the real filesystem or spawn real processes.
 */
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
      caddyRootCAPath: join(dir, "Caddy", "pki", "authorities", "local", "root.crt"),
    },
    run,
    now: () => new Date("2026-04-29T00:00:00.000Z"),
    platform: "win32",
    isElevated: async () => false,
  };
}

/**
 * Create a test context with a custom command runner.
 *
 * Delegates to {@link createContext} and replaces the runner so tests can
 * simulate Caddy presence, absence, or specific failure modes.
 */
async function createContextWithRunner(run: CommandRunner): Promise<DevProxyContext> {
  const context = await createContext();
  return { ...context, run };
}

/**
 * Capture help output from a Commander program.
 *
 * Redirects `writeOut` and `writeErr` into a local string and triggers
 * `outputHelp()` so assertions can inspect the rendered text.
 */
function captureHelp(command: ReturnType<typeof buildProgram>): string {
  let output = "";
  command.configureOutput({
    writeOut: (str) => {
      output += str;
    },
    writeErr: (str) => {
      output += str;
    },
  });
  command.outputHelp();
  return output;
}

/**
 * Capture `console.log` output during command execution.
 *
 * Temporarily overrides `console.log`, runs the command, restores the original
 * logger, and returns everything that was printed.
 */
async function captureCommandOutput(
  command: ReturnType<typeof buildProgram>,
  argv: string[],
): Promise<string> {
  let output = "";
  const originalLog = console.log;

  console.log = (...values: unknown[]) => {
    output += `${values.join(" ")}\n`;
  };

  try {
    await command.parseAsync(argv);
  } finally {
    console.log = originalLog;
  }

  return output;
}

describe("app commands", () => {
  it("uses the package version for the CLI version flag", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    expect(buildProgram({} as DevProxyContext).version()).toBe(packageJson.version);
  });

  it("detects CLI entrypoint execution through direct and symlinked bin paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "devproxy-bin-"));
    const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    const binPath = join(dir, "devproxy");
    await symlink(cliPath, binPath);

    expect(isCliEntrypoint(cliPath, new URL("../src/cli.ts", import.meta.url).href)).toBe(true);
    expect(isCliEntrypoint(binPath, new URL("../src/cli.ts", import.meta.url).href)).toBe(true);
  });

  it("adds the branded banner to root help output only", () => {
    const program = buildProgram({} as DevProxyContext);
    const addCommand = program.commands.find((command) => command.name() === "add");
    const rootHelp = captureHelp(program);
    const addHelp = addCommand ? captureHelp(addCommand) : "";

    expect(rootHelp).toContain("██████╗ ███████╗██╗   ██╗");
    expect(rootHelp).toContain("Version ");
    expect(addHelp).not.toContain("██████╗ ███████╗██╗   ██╗");
    expect(addHelp).toContain("Version ");
  });

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

  it("opens a service domain in the default browser using project config", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "api.myapp",
      port: "8000",
    });

    let openedUrl = "";
    context.openUrl = async (url) => {
      openedUrl = url;
    };

    await expect(new ProjectService(context).openInBrowser(undefined, projectDir)).resolves.toBe(
      "Opened https://api.myapp.local/ in the default browser.",
    );
    expect(openedUrl).toBe("https://api.myapp.local/");
  });

  it("starts and stops Caddy using the current registry", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    await expect(new CaddyService(context).start()).resolves.toBe(
      "Caddy reloaded with 1 registered service(s).",
    );
    await expect(new CaddyService(context).stop()).resolves.toBe("Caddy stopped.");
  });

  it("warns before starting when the Caddy root CA is missing", async () => {
    const context = await createContext();

    await expect(new CaddyService(context).getStartWarnings()).resolves.toEqual([
      expect.stringContaining("Caddy local root CA certificate was not found"),
    ]);
  });

  it("does not warn before starting when the Caddy root CA exists", async () => {
    const context = await createContext();
    await mkdir(join(context.paths.appDir, "Caddy", "pki", "authorities", "local"), {
      recursive: true,
    });
    await writeFile(context.paths.caddyRootCAPath, testCertificatePem, "utf8");

    await expect(new CaddyService(context).getStartWarnings()).resolves.toEqual([]);
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

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    await expect(new CaddyService(context).start()).resolves.toBe(
      "Caddy started with 1 registered service(s).",
    );
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

  it("reports when Caddy root CA certificate is missing", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "caddy version 2.8.0", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    const output = await new CaddyService(context).printCertificateInfo();

    expect(output).toContain("warn Root CA certificate not found");
    expect(output).toContain("caddy trust");
  });

  it("prints Caddy root CA certificate details when present", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "caddy version 2.8.0", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    await mkdir(join(context.paths.appDir, "Caddy", "pki", "authorities", "local"), {
      recursive: true,
    });
    await writeFile(context.paths.caddyRootCAPath, testCertificatePem, "utf8");

    const output = await new CaddyService(context).printCertificateInfo();

    expect(output).toContain("ok Root CA certificate found");
    expect(output).toContain("Subject: CN=test.local");
    expect(output).toContain("Issuer: CN=test.local");
    expect(output).toContain("Fingerprint (SHA-1):");
    expect(output).toContain("Fingerprint (SHA-256):");
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

  it("init creates a config file and registers the service", async () => {
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

  it("init repairs hosts and Caddyfile when the service is already registered", async () => {
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

  it("init validates the service name and port", async () => {
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

  it("init without config or flags returns help message", async () => {
    const context = await createContext();

    await expect(
      new RegistryService(context).initProjectConfig(context.paths.appDir, undefined),
    ).resolves.toBe("No .devproxy/config.json found. Provide --name and --port to create one.");
  });

  it("init with existing config and no flags, when confirmed, uses existing config", async () => {
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

  it("init with existing config and no flags, when declined, aborts", async () => {
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

  it("init with existing config and flags, when confirmed, uses existing config", async () => {
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

  it("init with existing config and flags, when declined, overwrites with new values", async () => {
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

  it("init with existing config preserves open targets", async () => {
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

  it("open without target opens default URL when no open config", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    let openedUrl = "";
    context.openUrl = async (url) => {
      openedUrl = url;
    };

    await expect(new ProjectService(context).openInBrowser(undefined, projectDir)).resolves.toBe(
      "Opened https://my-app.local/ in the default browser.",
    );
    expect(openedUrl).toBe("https://my-app.local/");
  });

  it("open without target uses open.default path", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    const configPath = join(projectDir, ".devproxy", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    config.open = { default: "/dashboard", targets: { docs: "/docs", admin: "/admin" } };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    let openedUrl = "";
    context.openUrl = async (url) => {
      openedUrl = url;
    };

    await expect(new ProjectService(context).openInBrowser(undefined, projectDir)).resolves.toBe(
      "Opened https://my-app.local/dashboard in the default browser.",
    );
    expect(openedUrl).toBe("https://my-app.local/dashboard");
  });

  it("open with target opens the named target path", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    const configPath = join(projectDir, ".devproxy", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    config.open = { default: "/dashboard", targets: { docs: "/docs", admin: "/admin" } };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    let openedUrl = "";
    context.openUrl = async (url) => {
      openedUrl = url;
    };

    await expect(new ProjectService(context).openInBrowser("docs", projectDir)).resolves.toBe(
      "Opened https://my-app.local/docs in the default browser.",
    );
    expect(openedUrl).toBe("https://my-app.local/docs");
  });

  it("open with unknown target lists available targets", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    const configPath = join(projectDir, ".devproxy", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    config.open = { default: "/", targets: { docs: "/docs", admin: "/admin" } };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    context.openUrl = async () => {};

    await expect(new ProjectService(context).openInBrowser("graphql", projectDir)).rejects.toThrow(
      "Target 'graphql' not found. Available targets: docs, admin.",
    );
  });

  it("open with target errors when no targets defined", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    context.openUrl = async () => {};

    await expect(new ProjectService(context).openInBrowser("docs", projectDir)).rejects.toThrow(
      "Target 'docs' not found. No targets defined",
    );
  });

  it("open warns when Vite allowedHosts is missing", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });
    await writeFile(
      join(projectDir, "vite.config.ts"),
      [
        "import { defineConfig } from 'vite';",
        "export default defineConfig({",
        "  server: { port: 8080 },",
        "});",
      ].join("\n"),
      "utf8",
    );

    context.openUrl = async () => {};

    await expect(
      new ProjectService(context).openInBrowser(undefined, projectDir),
    ).resolves.toContain('server.allowedHosts is not set. Add "my-app.local"');
  });

  it("open ignores commented Vite allowedHosts", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });
    await writeFile(
      join(projectDir, "vite.config.ts"),
      [
        "import { defineConfig } from 'vite';",
        "export default defineConfig({",
        "  server: {",
        "    // host: '0.0.0.0',",
        "    // port: 8080,",
        "    // allowedHosts: ['my-app.local'],",
        "  },",
        "});",
      ].join("\n"),
      "utf8",
    );

    context.openUrl = async () => {};

    await expect(
      new ProjectService(context).openInBrowser(undefined, projectDir),
    ).resolves.toContain('server.allowedHosts is not set. Add "my-app.local"');
  });

  it("open warns when Vite allowedHosts omits the project domain", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });
    await writeFile(
      join(projectDir, "vite.config.js"),
      "export default { server: { allowedHosts: ['other.local'] } };\n",
      "utf8",
    );

    context.openUrl = async () => {};

    await expect(
      new ProjectService(context).openInBrowser(undefined, projectDir),
    ).resolves.toContain('server.allowedHosts does not include "my-app.local"');
  });

  it("open does not warn when Vite allowedHosts includes the project domain", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });
    await writeFile(
      join(projectDir, "vite.config.ts"),
      "export default { server: { allowedHosts: ['my-app.local'] } };\n",
      "utf8",
    );

    context.openUrl = async () => {};

    await expect(new ProjectService(context).openInBrowser(undefined, projectDir)).resolves.toBe(
      "Opened https://my-app.local/ in the default browser.",
    );
  });

  it("open errors when no config exists", async () => {
    const context = await createContext();

    await expect(
      new ProjectService(context).openInBrowser(undefined, context.paths.appDir),
    ).rejects.toThrow("No project config found");
  });

  it("trust command reports already trusted when certificate exists", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "caddy version 2.8.0", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });
    context.isElevated = async () => true;
    await mkdir(join(dirname(context.paths.caddyRootCAPath)), { recursive: true });
    await writeFile(context.paths.caddyRootCAPath, testCertificatePem, "utf8");

    const output = await captureCommandOutput(buildProgram(context), ["node", "devproxy", "trust"]);

    expect(output).toContain("already trusted");
  });

  it("trust command prints instructions when not elevated", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "caddy version 2.8.0", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    const output = await captureCommandOutput(buildProgram(context), ["node", "devproxy", "trust"]);

    expect(output).toContain("administrator rights");
    expect(output).toContain("devproxy trust");
  });

  it("runs caddy trust automatically during add when elevated and cert is missing", async () => {
    let trustCalled = false;
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "trust") {
        trustCalled = true;
        return { code: 0, stdout: "trusted", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });
    context.isElevated = async () => true;

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    expect(trustCalled).toBe(true);
  });

  it("skips caddy trust during add when not elevated", async () => {
    let trustCalled = false;
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "trust") {
        trustCalled = true;
        return { code: 0, stdout: "trusted", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    expect(trustCalled).toBe(false);
  });
});
