import { DevProxyError } from "./errors.js";

const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function domainFromName(name: string): string {
  const normalized = name.trim().toLowerCase();
  validateName(normalized);
  return `${normalized}.local`;
}

export function validateName(name: string): void {
  if (name.length === 0) {
    throw new DevProxyError("Service name is required.");
  }

  if (name.endsWith(".local")) {
    throw new DevProxyError("Use a service name like 'api.myapp', not the full '.local' domain.");
  }

  const labels = name.split(".");
  if (labels.length < 2) {
    throw new DevProxyError("Service name must include a project label, for example 'api.myapp'.");
  }

  for (const label of labels) {
    if (!labelPattern.test(label)) {
      throw new DevProxyError(
        `Invalid service name '${name}'. Use lowercase letters, numbers, dots, and hyphens.`,
      );
    }
  }
}

export function parsePort(value: string | number): number {
  const port = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new DevProxyError("Port must be an integer between 1 and 65535.");
  }

  return port;
}
