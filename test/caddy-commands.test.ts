import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { CaddyService, RegistryService } from "../src/commands/services.js";
import {
  createContext,
  createContextWithRunner,
  testCertificatePem,
} from "./helpers/test-helpers.js";
import { captureCommandOutput } from "./helpers/test-helpers.js";
import { buildProgram } from "../src/cli.js";

describe("caddy lifecycle commands", () => {
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
    context.isElevated = async () => false;

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
    context.isElevated = async () => false;

    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    expect(trustCalled).toBe(false);
  });
});
