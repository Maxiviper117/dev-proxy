import { DevProxyError } from "../../core/errors.js";
import { readRegistry } from "../../core/registry.js";
import type { DevProxyContext } from "../../core/types.js";
import {
  ensureCaddyAvailable,
  ensureCaddyTrusted,
  getCaddyCertificateInfo,
  stopCaddy,
  validateAndReloadCaddy,
  writeCaddyfile,
} from "../../integrations/caddy.js";
import { ensureSupportedPlatform } from "../../platform/support.js";
import { formatCaddyLifecycle } from "./shared.js";

export class CaddyService {
  constructor(private readonly context: DevProxyContext) {}

  async start(): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const registry = await readRegistry(this.context.paths.registryFile);
    if (registry.services.length === 0) {
      throw new DevProxyError("No services registered. Add a service before starting Caddy.");
    }

    await writeCaddyfile(this.context.paths.caddyFile, registry.services);
    const caddyLifecycle = await validateAndReloadCaddy(
      this.context.paths.caddyFile,
      this.context.run,
    );

    return `Caddy ${formatCaddyLifecycle(caddyLifecycle)} with ${registry.services.length} registered service(s).`;
  }

  async getStartWarnings(): Promise<string[]> {
    ensureSupportedPlatform(this.context.platform);
    const info = await getCaddyCertificateInfo(
      this.context.run,
      this.context.paths.caddyRootCAPath,
    );

    if (info.exists) {
      return [];
    }

    return [
      [
        `Caddy local root CA certificate was not found at ${info.path}.`,
        "Browsers may show HTTPS certificate warnings until the Caddy root CA is trusted.",
        "Run `caddy trust` with the privileges needed to update your trust store.",
      ].join("\n"),
    ];
  }

  async trustCertificate(): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    await ensureCaddyAvailable(this.context.run);

    const result = await ensureCaddyTrusted(
      this.context.run,
      this.context.paths.caddyRootCAPath,
      this.context.isElevated ?? (async () => false),
    );

    if (result === "already-trusted") {
      return "Caddy root CA certificate is already trusted.";
    }

    if (result === "trusted") {
      return "Caddy root CA certificate trusted successfully.";
    }

    if (result === "not-elevated") {
      if (this.context.platform === "win32") {
        return [
          "DevProxy needs administrator rights to trust the Caddy root CA certificate.",
          "Open PowerShell or Command Prompt as Administrator and run:",
          "  devproxy trust",
        ].join("\n");
      }

      return [
        "DevProxy needs elevated permissions to trust the Caddy root CA certificate.",
        "Rerun the same command with sudo:",
        "  sudo devproxy trust",
      ].join("\n");
    }

    return [
      "Caddy root CA certificate could not be trusted automatically.",
      "Try running `caddy trust` manually with the privileges needed to update your trust store.",
    ].join("\n");
  }

  async stop(): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const result = await stopCaddy(this.context.paths.caddyFile, this.context.run);

    if (result === "not-running") {
      return "Caddy is not running.";
    }

    return "Caddy stopped.";
  }

  async printCertificateInfo(): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const info = await getCaddyCertificateInfo(
      this.context.run,
      this.context.paths.caddyRootCAPath,
    );

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
        "hint If browsers still warn about the certificate, run `caddy trust` with the privileges needed to update your trust store.",
      );
    } else {
      lines.push("warn Root CA certificate not found");
      lines.push(
        "hint Run `caddy trust` with the privileges needed to generate and install the root CA.",
      );
    }

    return lines.join("\n");
  }
}
