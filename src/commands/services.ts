import { Socket } from "node:net";
import { request as httpsRequest } from "node:https";
import { platform } from "node:os";
import { domainFromName, parsePort } from "../core/domain.js";
import { DevProxyError } from "../core/errors.js";
import { readRegistry, removeService, upsertService, writeRegistry } from "../core/registry.js";
import type { DevProxyContext, Service, ServiceMode } from "../core/types.js";
import {
  caddyInstallHint,
  generateCaddyfile,
  getCaddyCertificateInfo,
  stopCaddy,
  validateAndReloadCaddy,
  writeCaddyfile,
} from "../integrations/caddy.js";
import { canWriteHosts, ensureHostsWritable, writeHostsFile } from "../integrations/hosts.js";
import { openDefaultBrowser } from "../platform/browser.js";
import { defaultPaths } from "../platform/paths.js";
import { runCommand, spawnManagedProcess } from "../platform/runner.js";

/**
 * Create a default {@link DevProxyContext} backed by real platform integrations.
 *
 * Uses actual filesystem paths, process spawning, TCP/HTTPS probes, and the
 * default browser opener so the CLI behaves correctly in production.
 */
export function createDefaultContext(): DevProxyContext {
  return {
    paths: defaultPaths(),
    run: runCommand,
    now: () => new Date(),
    platform: platform(),
    probeTcp: probeTcpPort,
    probeUrl: probeUrl,
    probeHttps: probeHttpsUrl,
    openUrl: openDefaultBrowser,
    spawnManaged: spawnManagedProcess,
  };
}

/**
 * Register an attach-mode service and update all downstream artifacts.
 *
 * Validates the name and port, inserts the service into the registry, writes
 * the registry file, updates the Windows hosts file, generates a new Caddyfile,
 * and reloads (or starts) Caddy so the domain is immediately reachable.
 *
 * @throws {DevProxyError} When the platform is not Windows, the name or port is
 *   invalid, or the hosts file is not writable.
 */
export async function addService(
  context: DevProxyContext,
  input: { name: string; port: string | number },
): Promise<string> {
  ensureWindows(context);
  const domain = domainFromName(input.name);
  const port = parsePort(input.port);
  const registry = await readRegistry(context.paths.registryFile);
  const timestamp = context.now().toISOString();
  const service: Service = {
    name: input.name.trim().toLowerCase(),
    domain,
    port,
    mode: "attach",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const next = upsertService(registry, service);

  await ensureHostsWritable(context.paths.hostsFile);
  await writeRegistry(context.paths.registryFile, next);
  await writeHostsFile(context.paths.hostsFile, next.services);
  await writeCaddyfile(context.paths.caddyFile, next.services);
  const caddyLifecycle = await validateAndReloadCaddy(context.paths.caddyFile, context.run);

  return `Registered ${domain} -> 127.0.0.1:${port}, localhost:${port} (${formatCaddyLifecycle(caddyLifecycle)}).`;
}

export type ManagedProcessHandle = {
  message: string;
  wait: () => Promise<string>;
};

/**
 * Start a managed process and register its domain in one step.
 *
 * Validates the name and port, spawns the command with inherited stdio, writes
 * the registry entry with mode "managed", updates the hosts file and Caddyfile,
 * and reloads (or starts) Caddy. Returns immediately with a start message and a
 * wait handle that resolves when the child exits, at which point the stored PID
 * is cleared from the registry.
 *
 * @throws {DevProxyError} When the platform is not Windows, the name or port is
 *   invalid, or the hosts file is not writable.
 */
export async function runManagedService(
  context: DevProxyContext,
  input: { name: string; port: string | number; command: string; args: string[] },
): Promise<ManagedProcessHandle> {
  ensureWindows(context);
  const domain = domainFromName(input.name);
  const port = parsePort(input.port);
  const registry = await readRegistry(context.paths.registryFile);
  const timestamp = context.now().toISOString();
  const service: Service = {
    name: input.name.trim().toLowerCase(),
    domain,
    port,
    mode: "managed",
    command: [input.command, ...input.args].join(" "),
    cwd: process.cwd(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const next = upsertService(registry, service);

  await ensureHostsWritable(context.paths.hostsFile);
  await writeRegistry(context.paths.registryFile, next);
  await writeHostsFile(context.paths.hostsFile, next.services);
  await writeCaddyfile(context.paths.caddyFile, next.services);
  const caddyLifecycle = await validateAndReloadCaddy(context.paths.caddyFile, context.run);

  const spawnManaged = context.spawnManaged ?? spawnManagedProcess;
  const managed = spawnManaged(input.command, input.args);

  const withPid: typeof next = {
    ...next,
    services: next.services.map((s) =>
      s.name === service.name
        ? { ...s, pid: managed.pid, updatedAt: context.now().toISOString() }
        : s,
    ),
  };
  await writeRegistry(context.paths.registryFile, withPid);

  const message = `Started ${domain} -> 127.0.0.1:${port}, localhost:${port} (${formatCaddyLifecycle(caddyLifecycle)}). PID ${managed.pid}`;

  const wait = (): Promise<string> =>
    new Promise((resolve) => {
      managed.onExit(async (code) => {
        try {
          const current = await readRegistry(context.paths.registryFile);
          const cleaned: typeof current = {
            ...current,
            services: current.services.map((s) => {
              if (s.name !== service.name) return s;
              const { pid: _pid, ...rest } = s;
              return { ...rest, updatedAt: context.now().toISOString() };
            }),
          };
          await writeRegistry(context.paths.registryFile, cleaned);
        } catch {
          // ignore cleanup errors
        }
        resolve(`Process exited with code ${code ?? "unknown"}.`);
      });
    });

  return { message, wait };
}

/**
 * Remove a registered service by name and update all downstream artifacts.
 *
 * Looks up the service in the registry, removes it, rewrites the registry file,
 * updates the Windows hosts file, regenerates the Caddyfile, and reloads Caddy.
 *
 * @throws {DevProxyError} When the platform is not Windows, the service does not
 *   exist, or the hosts file is not writable.
 */
export async function removeRegisteredService(
  context: DevProxyContext,
  name: string,
): Promise<string> {
  ensureWindows(context);
  const registry = await readRegistry(context.paths.registryFile);
  const { registry: next, removed } = removeService(registry, name.trim().toLowerCase());

  await ensureHostsWritable(context.paths.hostsFile);
  await writeRegistry(context.paths.registryFile, next);
  await writeHostsFile(context.paths.hostsFile, next.services);
  await writeCaddyfile(context.paths.caddyFile, next.services);
  await validateAndReloadCaddy(context.paths.caddyFile, context.run);

  return `Removed ${removed.domain}`;
}

/**
 * Open a service's HTTPS domain in the default browser.
 *
 * Derives the `.local` domain from the service name and delegates to the
 * browser opener defined in the context (or the platform default).
 *
 * @throws {DevProxyError} When the platform is not Windows.
 */
export async function openServiceInBrowser(
  context: DevProxyContext,
  name: string,
): Promise<string> {
  ensureWindows(context);
  const domain = domainFromName(name);
  const openUrl = context.openUrl ?? openDefaultBrowser;

  await openUrl(`https://${domain}/`);

  return `Opened https://${domain}/ in the default browser.`;
}

/**
 * Return a human-readable list of registered services.
 *
 * Reads the registry and formats each service as a line showing its name,
 * domain, and upstream ports. Returns a friendly message when empty.
 */
export async function listServices(context: DevProxyContext): Promise<string> {
  const registry = await readRegistry(context.paths.registryFile);
  if (registry.services.length === 0) {
    return "No services registered.";
  }

  const rows = registry.services.map((service) => {
    const tags: string[] = [];
    if (service.mode === "managed") {
      tags.push("managed");
    }
    if (service.pid) {
      tags.push(`PID ${service.pid}`);
    }
    const tagStr = tags.length > 0 ? ` (${tags.join(", ")})` : "";
    return `${service.name.padEnd(24)} https://${service.domain.padEnd(32)} -> 127.0.0.1:${service.port}, localhost:${service.port}${tagStr}`;
  });

  return ["Registered services:", ...rows].join("\n");
}

/**
 * Run prerequisite checks and return a formatted diagnostic report.
 *
 * Verifies the platform, Caddy availability, hosts-file writability, and
 * displays the current registry and Caddyfile paths. Hints are appended
 * when Caddy is missing.
 */
export async function doctor(context: DevProxyContext): Promise<string> {
  const checks: string[] = [];
  checks.push(
    `${context.platform === "win32" ? "ok" : "warn"} Windows platform: ${context.platform}`,
  );

  const caddy = await context.run("caddy", ["version"]);
  checks.push(`${caddy.code === 0 ? "ok" : "fail"} Caddy on PATH`);

  checks.push(
    `${(await canWriteHosts(context.paths.hostsFile)) ? "ok" : "warn"} Hosts file writable`,
  );
  checks.push(`info Registry: ${context.paths.registryFile}`);
  checks.push(`info Caddyfile: ${context.paths.caddyFile}`);
  checks.push(
    `info Generated Caddyfile preview:\n${generateCaddyfile((await readRegistry(context.paths.registryFile)).services)}`,
  );

  if (caddy.code !== 0) {
    checks.push(`hint ${caddyInstallHint}`);
  }

  return checks.join("\n");
}

/**
 * Start or reload Caddy using the current registry.
 *
 * Generates a fresh Caddyfile from the registry and then validates and
 * reloads Caddy. If Caddy is not yet running, it falls back to starting it.
 *
 * @throws {DevProxyError} When no services are registered or the platform is not Windows.
 */
export async function startCaddyServer(context: DevProxyContext): Promise<string> {
  ensureWindows(context);
  const registry = await readRegistry(context.paths.registryFile);
  if (registry.services.length === 0) {
    throw new DevProxyError("No services registered. Add a service before starting Caddy.");
  }

  await writeCaddyfile(context.paths.caddyFile, registry.services);
  const caddyLifecycle = await validateAndReloadCaddy(context.paths.caddyFile, context.run);

  return `Caddy ${formatCaddyLifecycle(caddyLifecycle)} with ${registry.services.length} registered service(s).`;
}

/**
 * Stop the running Caddy server.
 *
 * Issues a Caddy stop command. If Caddy is not running, returns a message
 * indicating so instead of throwing.
 *
 * @throws {DevProxyError} When the platform is not Windows.
 */
export async function stopCaddyServer(context: DevProxyContext): Promise<string> {
  ensureWindows(context);
  const result = await stopCaddy(context.paths.caddyFile, context.run);

  if (result === "not-running") {
    return "Caddy is not running.";
  }

  return "Caddy stopped.";
}

/**
 * Return the raw list of registered services for JSON output.
 *
 * Reads the registry and returns its services array without formatting.
 */
export async function getListData(context: DevProxyContext): Promise<{ services: Service[] }> {
  const registry = await readRegistry(context.paths.registryFile);
  return { services: registry.services };
}

export type DoctorData = {
  platform: string;
  caddyOnPath: boolean;
  hostsFileWritable: boolean;
  registryPath: string;
  caddyfilePath: string;
  caddyfilePreview: string;
  hints: string[];
};

/**
 * Return structured diagnostic data for JSON output.
 *
 * Gathers the same information as {@link doctor} but returns it as a typed
 * object so the CLI can emit clean JSON instead of plain text.
 */
export async function getDoctorData(context: DevProxyContext): Promise<DoctorData> {
  const caddy = await context.run("caddy", ["version"]);
  const caddyOnPath = caddy.code === 0;
  const hints: string[] = [];

  if (!caddyOnPath) {
    hints.push(caddyInstallHint);
  }

  return {
    platform: context.platform,
    caddyOnPath,
    hostsFileWritable: await canWriteHosts(context.paths.hostsFile),
    registryPath: context.paths.registryFile,
    caddyfilePath: context.paths.caddyFile,
    caddyfilePreview: generateCaddyfile((await readRegistry(context.paths.registryFile)).services),
    hints,
  };
}

export type StatusServiceData = {
  name: string;
  domain: string;
  port: number;
  mode: ServiceMode;
  processRunning?: boolean;
  domainReachable: boolean;
  localhostReachable: boolean;
  loopbackReachable: boolean;
};

export type StatusData = {
  caddyInstalled: boolean;
  caddyRunning: boolean;
  serviceCount: number;
  services: StatusServiceData[];
  hints: string[];
};

/**
 * Return structured status data for JSON output.
 *
 * Probes Caddy installation, Caddy runtime, and each registered service's
 * upstream and domain reachability, returning the results as a typed object.
 */
export async function getStatusData(context: DevProxyContext): Promise<StatusData> {
  const registry = await readRegistry(context.paths.registryFile);
  const probeTcp = context.probeTcp ?? probeTcpPort;
  const probeUrlFn = context.probeUrl ?? probeUrl;
  const probeHttps = context.probeHttps ?? probeHttpsUrl;
  const caddyVersion = await context.run("caddy", ["version"]);
  const caddyInstalled = caddyVersion.code === 0;
  const caddyRunning = caddyInstalled ? await probeUrlFn("http://localhost:2019/config/") : false;

  const hints: string[] = [];
  if (!caddyInstalled) {
    hints.push(caddyInstallHint);
  }

  const services = await Promise.all(
    registry.services.map(async (service) => {
      const [localhostReachable, loopbackReachable] = await Promise.all([
        probeTcp("localhost", service.port),
        probeTcp("127.0.0.1", service.port),
      ]);
      const domainReachable = await probeHttps(`https://${service.domain}/`);

      return {
        name: service.name,
        domain: service.domain,
        port: service.port,
        mode: service.mode,
        ...(service.pid ? { processRunning: isProcessRunning(service.pid) } : {}),
        domainReachable,
        localhostReachable,
        loopbackReachable,
      };
    }),
  );

  return {
    caddyInstalled,
    caddyRunning,
    serviceCount: registry.services.length,
    services,
    hints,
  };
}

/**
 * Return formatted Caddy root CA certificate information.
 *
 * Locates the Caddy internal root CA certificate, parses its metadata, and
 * returns a multi-line report including path, subject, issuer, validity, and
 * fingerprints. Hints guide the user to run `caddy trust` when the cert is missing.
 *
 * @throws {DevProxyError} When the platform is not Windows.
 */
export async function printCertificateInfo(context: DevProxyContext): Promise<string> {
  ensureWindows(context);
  const info = await getCaddyCertificateInfo(context.run, context.paths.caddyRootCAPath);

  const lines: string[] = [];
  lines.push(`info Root CA path: ${info.path}`);

  if (info.exists) {
    lines.push("ok Root CA certificate found");
    lines.push(`info Subject: ${info.subject}`);
    lines.push(`info Issuer: ${info.issuer}`);
    lines.push(`info Valid from: ${info.validFrom}`);
    lines.push(`info Valid to: ${info.validTo}`);
    lines.push(`info Fingerprint (SHA-1): ${info.fingerprint}`);
    lines.push(`info Fingerprint (SHA-256): ${info.fingerprint256}`);
    lines.push(
      "hint If browsers still warn about the certificate, run `caddy trust` from an elevated PowerShell session.",
    );
  } else {
    lines.push("warn Root CA certificate not found");
    lines.push(
      "hint Run `caddy trust` from an elevated PowerShell session to generate and install the root CA.",
    );
  }

  return lines.join("\n");
}

/**
 * Return a human-readable status report for Caddy and all registered services.
 *
 * Checks whether Caddy is installed and its admin endpoint is reachable, then
 * probes each service's upstream TCP ports and HTTPS domain. Results are returned
 * as colored plain-text lines.
 */
export async function status(context: DevProxyContext): Promise<string> {
  const registry = await readRegistry(context.paths.registryFile);
  const probeTcp = context.probeTcp ?? probeTcpPort;
  const probeUrlFn = context.probeUrl ?? probeUrl;
  const probeHttps = context.probeHttps ?? probeHttpsUrl;
  const caddyVersion = await context.run("caddy", ["version"]);
  const caddyInstalled = caddyVersion.code === 0;
  const caddyRunning = caddyInstalled ? await probeUrlFn("http://localhost:2019/config/") : false;

  const lines: string[] = [];
  lines.push(`${caddyInstalled ? "ok" : "fail"} Caddy on PATH`);

  if (caddyInstalled) {
    lines.push(
      `${caddyRunning ? "ok" : "warn"} Caddy admin endpoint on localhost:2019 ${
        caddyRunning ? "is reachable" : "is not reachable"
      }`,
    );
  } else {
    lines.push(`hint ${caddyInstallHint}`);
  }

  lines.push(`info Registered services: ${registry.services.length}`);

  if (registry.services.length === 0) {
    lines.push("info No services registered.");
    return lines.join("\n");
  }

  const serviceLines = await Promise.all(
    registry.services.map(async (service) => {
      const [localhostReachable, loopbackReachable] = await Promise.all([
        probeTcp("localhost", service.port),
        probeTcp("127.0.0.1", service.port),
      ]);
      const upstreamReachable = localhostReachable || loopbackReachable;
      const domainReachable = await probeHttps(`https://${service.domain}/`);
      const modeTag = service.mode === "managed" ? " [managed]" : "";
      const processTag =
        service.mode === "managed" && service.pid
          ? ` (${isProcessRunning(service.pid) ? "running" : "stopped"})`
          : "";

      return [
        `${domainReachable ? "ok" : "warn"} https://${service.domain}/ ${
          domainReachable ? "is reachable through Caddy" : "is not reachable through Caddy"
        }${modeTag}${processTag}`,
        `${upstreamReachable ? "ok" : "warn"} upstream ${service.domain} -> 127.0.0.1:${service.port} ${
          loopbackReachable ? "reachable" : "unreachable"
        }, localhost:${service.port} ${localhostReachable ? "reachable" : "unreachable"}`,
      ].join("\n");
    }),
  );

  lines.push(...serviceLines);

  return lines.join("\n");
}

/**
 * Check whether a process with the given PID is still running.
 *
 * Uses `process.kill(pid, 0)` which performs an existence check without
 * sending a real signal. Returns `false` for missing or invalid PIDs.
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Enforce that the runtime platform is Windows.
 *
 * @throws {DevProxyError} When `context.platform` is not `"win32"`.
 */
function ensureWindows(context: DevProxyContext): void {
  if (context.platform !== "win32") {
    throw new DevProxyError("DevProxy currently supports Windows only.");
  }
}

/**
 * Convert a Caddy lifecycle state into a human-readable verb.
 *
 * Returns `"started"` when Caddy had to be started fresh, otherwise `"reloaded"`.
 */
function formatCaddyLifecycle(lifecycle: "reloaded" | "started"): string {
  return lifecycle === "started" ? "started" : "reloaded";
}

/**
 * Probe whether a TCP host:port is reachable.
 *
 * Opens a socket with a 750 ms timeout and resolves `true` on connect,
 * `false` on timeout or error.
 */
async function probeTcpPort(host: string, port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;

    const finish = (reachable: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(750);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * Probe whether a URL responds successfully.
 *
 * Performs a `fetch` with a 750 ms timeout and resolves `true` when the
 * response status is 2xx or greater.
 */
async function probeUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(750) });
    return response.ok || response.status >= 200;
  } catch {
    return false;
  }
}

/**
 * Probe whether an HTTPS URL is reachable, ignoring certificate errors.
 *
 * Sends a `HEAD` request via `node:https` with a 750 ms timeout and resolves
 * `true` when the status code is below 500. Used to verify that Caddy is
 * serving a `.local` domain even before the root CA is trusted.
 */
async function probeHttpsUrl(url: string): Promise<boolean> {
  return await new Promise((resolve) => {
    const request = httpsRequest(
      url,
      {
        method: "HEAD",
        rejectUnauthorized: false,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode !== undefined && response.statusCode < 500);
      },
    );

    let settled = false;

    const finish = (reachable: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      request.destroy();
      resolve(reachable);
    };

    request.setTimeout(750, () => finish(false));
    request.once("error", () => finish(false));
    request.end();
  });
}
