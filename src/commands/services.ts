import { Socket } from "node:net";
import { request as httpsRequest } from "node:https";
import { platform } from "node:os";
import { domainFromName, parsePort } from "../core/domain.js";
import { DevProxyError } from "../core/errors.js";
import { readRegistry, removeService, upsertService, writeRegistry } from "../core/registry.js";
import type { DevProxyContext, Service } from "../core/types.js";
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
import { runCommand } from "../platform/runner.js";

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
  };
}

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

  return `Registered ${domain} -> localhost:${port}, 127.0.0.1:${port} (${formatCaddyLifecycle(caddyLifecycle)}).`;
}

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

export async function listServices(context: DevProxyContext): Promise<string> {
  const registry = await readRegistry(context.paths.registryFile);
  if (registry.services.length === 0) {
    return "No services registered.";
  }

  const rows = registry.services.map((service) => {
    return `${service.name.padEnd(24)} https://${service.domain.padEnd(32)} -> localhost:${service.port}, 127.0.0.1:${service.port}`;
  });

  return ["Registered services:", ...rows].join("\n");
}

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

export async function stopCaddyServer(context: DevProxyContext): Promise<string> {
  ensureWindows(context);
  const result = await stopCaddy(context.paths.caddyFile, context.run);

  if (result === "not-running") {
    return "Caddy is not running.";
  }

  return "Caddy stopped.";
}

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

      return [
        `${domainReachable ? "ok" : "warn"} https://${service.domain}/ ${
          domainReachable ? "is reachable through Caddy" : "is not reachable through Caddy"
        }`,
        `${upstreamReachable ? "ok" : "warn"} upstream ${service.domain} -> localhost:${service.port} ${
          localhostReachable ? "reachable" : "unreachable"
        }, 127.0.0.1:${service.port} ${loopbackReachable ? "reachable" : "unreachable"}`,
      ].join("\n");
    }),
  );

  lines.push(...serviceLines);

  return lines.join("\n");
}

function ensureWindows(context: DevProxyContext): void {
  if (context.platform !== "win32") {
    throw new DevProxyError("DevProxy currently supports Windows only.");
  }
}

function formatCaddyLifecycle(lifecycle: "reloaded" | "started"): string {
  return lifecycle === "started" ? "started" : "reloaded";
}

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

async function probeUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(750) });
    return response.ok || response.status >= 200;
  } catch {
    return false;
  }
}

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
        resolve(true);
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
