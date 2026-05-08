import { caddyInstallHint, generateCaddyfile } from "../../integrations/caddy.js";
import { canWriteHosts, readHostsDrift, type HostsDrift } from "../../integrations/hosts.js";
import { probeHttpsUrl, probeTcpPort, probeUrl } from "../../platform/probes.js";
import { isSupportedPlatform } from "../../platform/support.js";
import { readRegistry } from "../../core/registry.js";
import type { DevProxyContext } from "../../core/types.js";

export type DoctorData = {
  platform: string;
  caddyOnPath: boolean;
  hostsFileWritable: boolean;
  hostsDrift: HostsDrift;
  registryPath: string;
  caddyfilePath: string;
  caddyfilePreview: string;
  hints: string[];
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

  async doctor(): Promise<string> {
    const checks: string[] = [];
    const supportedPlatform = isSupportedPlatform(this.context.platform);
    checks.push(
      `${supportedPlatform ? "ok" : "warn"} ${
        supportedPlatform ? "Supported platform" : "Unsupported platform"
      }: ${this.context.platform}`,
    );

    const caddy = await this.context.run("caddy", ["version"]);
    const registry = await readRegistry(this.context.paths.registryFile);
    const hostsDrift = await readHostsDrift(this.context.paths.hostsFile, registry.services);
    checks.push(
      `${caddy.code === 0 ? "ok" : "fail"} Caddy ${caddy.code === 0 ? "on" : "not on"} PATH`,
    );

    const hostsFileWritable = await canWriteHosts(this.context.paths.hostsFile);
    checks.push(
      `${hostsFileWritable ? "ok" : "warn"} Hosts file ${
        hostsFileWritable ? "writable" : "not writable"
      }`,
    );
    checks.push(
      `${hostsDrift.inSync ? "ok" : "warn"} ${
        hostsDrift.inSync ? "Hosts entries match registry" : "Hosts drift detected"
      }`,
    );
    checks.push(`info Registry: ${this.context.paths.registryFile}`);
    checks.push(`info Caddyfile: ${this.context.paths.caddyFile}`);

    if (caddy.code !== 0) {
      checks.push(`hint ${caddyInstallHint}`);
    }
    if (!hostsDrift.inSync) {
      checks.push("hint Run 'devproxy sync-hosts' from an elevated terminal to align hosts.");
    }

    return checks.join("\n");
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

    return {
      platform: this.context.platform,
      caddyOnPath,
      hostsFileWritable: await canWriteHosts(this.context.paths.hostsFile),
      hostsDrift,
      registryPath: this.context.paths.registryFile,
      caddyfilePath: this.context.paths.caddyFile,
      caddyfilePreview: generateCaddyfile(registry.services),
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
