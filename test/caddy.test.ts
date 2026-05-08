import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ensureCaddyAvailable,
  ensureCaddyTrusted,
  generateCaddyfile,
  stopCaddy,
  validateAndReloadCaddy,
} from "../src/integrations/caddy.js";
import type { CommandRunner, Service } from "../src/core/types.js";

const service = {
  name: "api.myapp",
  domain: "api.myapp.local",
  port: 8000,
  mode: "attach",
  createdAt: "2026-04-29T00:00:00.000Z",
  updatedAt: "2026-04-29T00:00:00.000Z",
} satisfies Service;

describe("generateCaddyfile", () => {
  it("generates tls internal reverse proxy routes", () => {
    const caddyfile = generateCaddyfile([service]);

    expect(caddyfile).not.toContain("admin off");
    expect(caddyfile).toContain("api.myapp.local {");
    expect(caddyfile).toContain("tls internal");
    expect(caddyfile).toContain("reverse_proxy 127.0.0.1:8000 localhost:8000");
    expect(caddyfile).toContain("lb_try_duration 2s");
    expect(caddyfile).toContain("lb_try_interval 100ms");
    expect(caddyfile).toContain("header_up X-Forwarded-Proto {scheme}");
  });

  it("includes admin block when adminPort is specified", () => {
    const caddyfile = generateCaddyfile([service], { adminPort: 2020 });

    expect(caddyfile).toContain("admin localhost:2020");
    expect(caddyfile).toContain("api.myapp.local {");
  });

  it("reports when reload succeeds without starting a new instance", async () => {
    const calls: string[] = [];
    const run: CommandRunner = async (command, args) => {
      calls.push([command, ...args].join(" "));
      return { code: 0, stdout: "ok", stderr: "" };
    };

    await expect(validateAndReloadCaddy("C:\\devproxy\\Caddyfile", run)).resolves.toBe("reloaded");
    expect(calls).toEqual([
      "caddy version",
      "caddy validate --config C:\\devproxy\\Caddyfile",
      "caddy reload --config C:\\devproxy\\Caddyfile",
    ]);
  });

  it("starts Caddy when reload has no running admin endpoint", async () => {
    const calls: string[] = [];
    const run: CommandRunner = async (command, args) => {
      calls.push([command, ...args].join(" "));

      if (args[0] === "reload") {
        return {
          code: 1,
          stdout: "",
          stderr:
            'Error: sending configuration to instance: performing request: Post "http://localhost:2019/load": dial tcp [::1]:2019: connectex: No connection could be made because the target machine actively refused it.',
        };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    };

    await expect(validateAndReloadCaddy("C:\\devproxy\\Caddyfile", run)).resolves.toBe("started");
    expect(calls).toEqual([
      "caddy version",
      "caddy validate --config C:\\devproxy\\Caddyfile",
      "caddy reload --config C:\\devproxy\\Caddyfile",
      "caddy start --config C:\\devproxy\\Caddyfile",
    ]);
  });

  it("warns clearly when Caddy is not installed", async () => {
    const run: CommandRunner = async () => ({
      code: 127,
      stdout: "",
      stderr: "caddy not found",
    });

    await expect(ensureCaddyAvailable(run)).rejects.toThrow("brew install caddy");
  });

  it("stops Caddy through the generated config", async () => {
    const calls: string[] = [];
    const run: CommandRunner = async (command, args) => {
      calls.push([command, ...args].join(" "));
      return { code: 0, stdout: "ok", stderr: "" };
    };

    await expect(stopCaddy("C:\\devproxy\\Caddyfile", run)).resolves.toBe("stopped");
    expect(calls).toEqual(["caddy version", "caddy stop --config C:\\devproxy\\Caddyfile"]);
  });

  it("treats stop with no running Caddy as idempotent", async () => {
    const run: CommandRunner = async (_command, args) => {
      if (args[0] === "stop") {
        return {
          code: 1,
          stdout: "",
          stderr:
            'Error: performing request: Post "http://localhost:2019/stop": dial tcp [::1]:2019: connectex: No connection could be made because the target machine actively refused it.',
        };
      }

      return { code: 0, stdout: "ok", stderr: "" };
    };

    await expect(stopCaddy("C:\\devproxy\\Caddyfile", run)).resolves.toBe("not-running");
  });
});

describe("ensureCaddyTrusted", () => {
  it("returns already-trusted when the certificate exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "devproxy-caddy-test-"));
    const rootCAPath = join(dir, "root.crt");
    await mkdir(dirname(rootCAPath), { recursive: true });
    await writeFile(rootCAPath, "test-cert", "utf8");

    const run: CommandRunner = async () => ({ code: 0, stdout: "", stderr: "" });

    await expect(ensureCaddyTrusted(run, rootCAPath, async () => true)).resolves.toBe(
      "already-trusted",
    );
  });

  it("returns not-elevated when the process is not admin/root", async () => {
    const run: CommandRunner = async () => ({ code: 0, stdout: "", stderr: "" });

    await expect(ensureCaddyTrusted(run, "/nonexistent/root.crt", async () => false)).resolves.toBe(
      "not-elevated",
    );
  });

  it("runs caddy trust when elevated and cert is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "devproxy-caddy-test-"));
    const rootCAPath = join(dir, "root.crt");

    const calls: string[] = [];
    const run: CommandRunner = async (command, args) => {
      calls.push([command, ...args].join(" "));
      if (command === "caddy" && args[0] === "trust") {
        await mkdir(dirname(rootCAPath), { recursive: true });
        await writeFile(rootCAPath, "test-cert", "utf8");
      }
      return { code: 0, stdout: "trusted", stderr: "" };
    };

    const result = await ensureCaddyTrusted(run, rootCAPath, async () => true);
    expect(calls).toContain("caddy trust");
    expect(result).toBe("trusted");
  });

  it("returns trust-failed when caddy trust does not create the cert", async () => {
    const run: CommandRunner = async () => ({ code: 0, stdout: "", stderr: "" });

    await expect(ensureCaddyTrusted(run, "/nonexistent/root.crt", async () => true)).resolves.toBe(
      "trust-failed",
    );
  });
});
