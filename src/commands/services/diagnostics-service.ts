import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  caddyInstallHint,
  ensureCaddyTrusted,
  generateCaddyfile,
  validateAndReloadCaddy,
  writeCaddyfile,
} from "../../integrations/caddy.js";
import {
  canWriteHosts,
  hostsPermissionMessage,
  readHostsDrift,
  writeHostsFile,
  type HostsDrift,
} from "../../integrations/hosts.js";
import { probeHttpsUrl, probeTcpPort, probeUrl } from "../../platform/probes.js";
import { readRegistry } from "../../core/registry.js";
import type { DevProxyContext } from "../../core/types.js";

export type CaddyValidationResult = {
  valid: boolean;
  error?: string;
  skipped?: boolean;
};

export type DuplicatePortEntry = {
  port: number;
  services: string[];
};

export type DoctorData = {
  platform: string;
  caddyOnPath: boolean;
  hostsFileWritable: boolean;
  hostsDrift: HostsDrift;
  registryPath: string;
  caddyfilePath: string;
  caddyfilePreview: string;
  caddyValidation: CaddyValidationResult;
  duplicatePorts: DuplicatePortEntry[];
  hints: string[];
};

export type DoctorFixStatus = "fixed" | "skipped" | "manual" | "unchanged";

export type DoctorFixItem = {
  action: string;
  status: DoctorFixStatus;
  detail: string;
};

export type DoctorFixResult = {
  items: DoctorFixItem[];
  fixed: number;
  skipped: number;
  manual: number;
};

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

export class DiagnosticsService {
  constructor(private readonly context: DevProxyContext) {}

  async doctor(options?: {
    fix?: boolean;
    autoConfirm?: boolean;
  }): Promise<DoctorData & { fixResult?: DoctorFixResult }> {
    const data = await this.getDoctorData();

    if (!options?.fix) {
      return data;
    }

    const items: DoctorFixItem[] = [];
    const autoConfirm = options.autoConfirm ?? false;
    const registry = await readRegistry(this.context.paths.registryFile);

    async function shouldFix(
      confirm: DevProxyContext["confirm"],
      prompt: string,
    ): Promise<boolean> {
      if (autoConfirm) {
        return true;
      }

      if (!confirm) {
        return false;
      }

      return confirm({ message: prompt, default: true });
    }

    // Check 1: Caddy not on PATH -> MANUAL
    if (!data.caddyOnPath) {
      items.push({
        action: "Caddy installation",
        status: "manual",
        detail: caddyInstallHint,
      });
    }

    // Check 2: Hosts drift -> FIX if writable, MANUAL if not
    if (!data.hostsDrift.inSync) {
      if (data.hostsFileWritable) {
        const ok = await shouldFix(
          this.context.confirm,
          "Hosts entries are out of sync with the registry. Sync them now?",
        );
        if (ok) {
          try {
            await writeHostsFile(
              this.context.paths.hostsFile,
              registry.services,
              this.context.platform,
            );
            items.push({
              action: "Hosts drift",
              status: "fixed",
              detail: "Hosts entries synced with the registry.",
            });
          } catch {
            items.push({
              action: "Hosts drift",
              status: "manual",
              detail: hostsPermissionMessage(this.context.paths.hostsFile, this.context.platform),
            });
          }
        } else {
          items.push({
            action: "Hosts drift",
            status: "skipped",
            detail: "User declined to sync hosts.",
          });
        }
      } else {
        items.push({
          action: "Hosts drift",
          status: "manual",
          detail: hostsPermissionMessage(this.context.paths.hostsFile, this.context.platform),
        });
      }
    }

    // Check 3: Hosts file not writable -> MANUAL
    if (!data.hostsFileWritable) {
      items.push({
        action: "Hosts file access",
        status: "manual",
        detail: hostsPermissionMessage(this.context.paths.hostsFile, this.context.platform),
      });
    }

    // Check 4: Caddy on path + services + not running -> FIX
    if (data.caddyOnPath && registry.services.length > 0) {
      const probeUrlFn = this.context.probeUrl ?? probeUrl;
      const caddyRunning = await probeUrlFn("http://localhost:2019/config/");
      if (!caddyRunning) {
        const ok = await shouldFix(this.context.confirm, "Caddy is not running. Start it now?");
        if (ok) {
          try {
            await writeCaddyfile(this.context.paths.caddyFile, registry.services);
            await validateAndReloadCaddy(this.context.paths.caddyFile, this.context.run);
            items.push({
              action: "Caddy start",
              status: "fixed",
              detail: "Caddy started successfully.",
            });
          } catch (error) {
            items.push({
              action: "Caddy start",
              status: "manual",
              detail: `Caddy start failed: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        } else {
          items.push({
            action: "Caddy start",
            status: "skipped",
            detail: "User declined to start Caddy.",
          });
        }
      }
    }

    // Check 5: Root CA missing -> FIX if elevated, MANUAL if not
    try {
      const s = await stat(this.context.paths.caddyRootCAPath);
      if (!s.isFile()) {
        throw new Error("not a file");
      }
    } catch {
      const isElevated = this.context.isElevated ?? (async () => false);
      const elevated = await isElevated();
      if (elevated) {
        const ok = await shouldFix(
          this.context.confirm,
          "Caddy root CA certificate is missing. Trust it now?",
        );
        if (ok) {
          const result = await ensureCaddyTrusted(
            this.context.run,
            this.context.paths.caddyRootCAPath,
            async () => elevated,
          );
          if (result === "trusted" || result === "already-trusted") {
            items.push({
              action: "Root CA trust",
              status: "fixed",
              detail:
                result === "already-trusted"
                  ? "Root CA certificate was already trusted."
                  : "Root CA certificate trusted successfully.",
            });
          } else {
            items.push({
              action: "Root CA trust",
              status: "manual",
              detail:
                "Root CA trust did not complete. Run `caddy trust` manually with elevated privileges.",
            });
          }
        } else {
          items.push({
            action: "Root CA trust",
            status: "skipped",
            detail: "User declined to trust root CA.",
          });
        }
      } else {
        items.push({
          action: "Root CA trust",
          status: "manual",
          detail:
            this.context.platform === "win32"
              ? "Run PowerShell or Command Prompt as Administrator and run `devproxy trust`."
              : "Rerun with sudo: `sudo devproxy trust`.",
        });
      }
    }

    return {
      ...data,
      fixResult: {
        items,
        fixed: items.filter((i) => i.status === "fixed").length,
        skipped: items.filter((i) => i.status === "skipped").length,
        manual: items.filter((i) => i.status === "manual").length,
      },
    };
  }

  async getDoctorData(): Promise<DoctorData> {
    const caddy = await this.context.run("caddy", ["version"]);
    const caddyOnPath = caddy.code === 0;
    const registry = await readRegistry(this.context.paths.registryFile);
    const hostsDrift = await readHostsDrift(this.context.paths.hostsFile, registry.services);
    const hints: string[] = [];

    if (!caddyOnPath) {
      hints.push(caddyInstallHint);
    }
    if (!hostsDrift.inSync) {
      hints.push("Run 'devproxy sync-hosts' from an elevated terminal to align hosts.");
    }

    // Caddy config validation
    let caddyValidation: CaddyValidationResult;
    if (!caddyOnPath) {
      caddyValidation = { valid: false, skipped: true };
    } else if (registry.services.length === 0) {
      caddyValidation = { valid: true, skipped: true };
    } else {
      const tmpDir = await mkdtemp(join(tmpdir(), "devproxy-validate-"));
      const tmpCaddyfile = join(tmpDir, "Caddyfile");
      try {
        await writeFile(tmpCaddyfile, generateCaddyfile(registry.services), "utf8");
        const result = await this.context.run("caddy", ["validate", "--config", tmpCaddyfile]);
        caddyValidation =
          result.code === 0
            ? { valid: true }
            : { valid: false, error: result.stderr || result.stdout };
      } catch (error) {
        caddyValidation = {
          valid: false,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    // Duplicate port detection
    const portMap = new Map<number, string[]>();
    for (const service of registry.services) {
      const existing = portMap.get(service.port) ?? [];
      existing.push(service.name);
      portMap.set(service.port, existing);
    }
    const duplicatePorts: DuplicatePortEntry[] = [];
    for (const [port, services] of portMap) {
      if (services.length > 1) {
        duplicatePorts.push({ port, services });
      }
    }

    if (!caddyValidation.valid && !caddyValidation.skipped) {
      hints.push("Caddy config validation failed. Fix the errors above before starting DevProxy.");
    }
    for (const dup of duplicatePorts) {
      hints.push(
        `Port conflict: port ${dup.port} is used by multiple services (${dup.services.join(", ")}). Run 'devproxy update <name> --port <port>' to resolve.`,
      );
    }

    return {
      platform: this.context.platform,
      caddyOnPath,
      hostsFileWritable: await canWriteHosts(this.context.paths.hostsFile),
      hostsDrift,
      registryPath: this.context.paths.registryFile,
      caddyfilePath: this.context.paths.caddyFile,
      caddyfilePreview: generateCaddyfile(registry.services),
      caddyValidation,
      duplicatePorts,
      hints,
    };
  }

  async getStatusData(): Promise<StatusData> {
    const registry = await readRegistry(this.context.paths.registryFile);
    const probeTcp = this.context.probeTcp ?? probeTcpPort;
    const probeUrlFn = this.context.probeUrl ?? probeUrl;
    const probeHttps = this.context.probeHttps ?? probeHttpsUrl;
    const caddyVersion = await this.context.run("caddy", ["version"]);
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

  async status(): Promise<string> {
    const registry = await readRegistry(this.context.paths.registryFile);
    const probeTcp = this.context.probeTcp ?? probeTcpPort;
    const probeUrlFn = this.context.probeUrl ?? probeUrl;
    const probeHttps = this.context.probeHttps ?? probeHttpsUrl;
    const caddyVersion = await this.context.run("caddy", ["version"]);
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
          `${upstreamReachable ? "ok" : "warn"} upstream ${service.domain} -> 127.0.0.1:${service.port} ${
            loopbackReachable ? "reachable" : "unreachable"
          }, localhost:${service.port} ${localhostReachable ? "reachable" : "unreachable"}`,
        ].join("\n");
      }),
    );

    lines.push(...serviceLines);

    return lines.join("\n");
  }
}
