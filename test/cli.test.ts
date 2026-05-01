import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProgram } from "../src/cli.js";
import {
  addService,
  doctor,
  listServices,
  openServiceInBrowser,
  printCertificateInfo,
  removeRegisteredService,
  status,
  startCaddyServer,
  stopCaddyServer,
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
  };
}

async function createContextWithRunner(run: CommandRunner): Promise<DevProxyContext> {
  const context = await createContext();
  return { ...context, run };
}

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

    expect(buildProgram().version()).toBe(packageJson.version);
  });

  it("adds the branded banner to root help output only", () => {
    const program = buildProgram();
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
    const output = await captureCommandOutput(buildProgram(context), [
      "node",
      "devproxy",
      "doctor",
    ]);

    expect(output).toContain("DevProxy version:");
    expect(output).toContain(buildProgram().version());
  });

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

  it("opens a service domain in the default browser", async () => {
    const context = await createContext();
    let openedUrl = "";
    context.openUrl = async (url) => {
      openedUrl = url;
    };

    await expect(openServiceInBrowser(context, "api.myapp")).resolves.toBe(
      "Opened https://api.myapp.local/ in the default browser.",
    );
    expect(openedUrl).toBe("https://api.myapp.local/");
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

  it("reports when Caddy root CA certificate is missing", async () => {
    const context = await createContextWithRunner(async (_command, args) => {
      if (args[0] === "version") {
        return { code: 0, stdout: "caddy version 2.8.0", stderr: "" };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    });

    const output = await printCertificateInfo(context);

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

    const output = await printCertificateInfo(context);

    expect(output).toContain("ok Root CA certificate found");
    expect(output).toContain("Subject: CN=test.local");
    expect(output).toContain("Issuer: CN=test.local");
    expect(output).toContain("Fingerprint (SHA-1):");
    expect(output).toContain("Fingerprint (SHA-256):");
  });

  it("list --json returns registered services", async () => {
    const context = await createContext();
    await addService(context, { name: "api.myapp", port: "8000" });

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
    expect(parsed.version).toBe(buildProgram().version());
    expect(parsed.platform).toBe("win32");
    expect(parsed.caddyOnPath).toBe(true);
    expect(parsed.hostsFileWritable).toBe(true);
    expect(typeof parsed.registryPath).toBe("string");
    expect(typeof parsed.caddyfilePath).toBe("string");
    expect(typeof parsed.caddyfilePreview).toBe("string");
    expect(parsed.hints).toEqual([]);
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

    await addService(context, { name: "api.myapp", port: "8000" });

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
