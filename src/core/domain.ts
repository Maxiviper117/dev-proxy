import { DevProxyError } from "./errors.js";

const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Derive a `.local` domain from a service name.
 *
 * Trims whitespace, lower-cases the input, validates it, and appends `.local`.
 * For example, `"api.myapp"` becomes `"api.myapp.local"`.
 *
 * @throws {DevProxyError} When the name is empty or contains invalid characters.
 */
export function domainFromName(name: string): string {
  const normalized = name.trim().toLowerCase();
  validateName(normalized);
  return `${normalized}.local`;
}

/**
 * Validate a service name format.
 *
 * Ensures the name is non-empty, does not already end with `.local`, and
 * contains only lowercase letters, numbers, dots, and hyphens in valid DNS
 * label positions.
 *
 * @throws {DevProxyError} When any validation rule fails.
 */
export function validateName(name: string): void {
  if (name.length === 0) {
    throw new DevProxyError("Service name is required.");
  }

  if (name.endsWith(".local")) {
    throw new DevProxyError("Use a service name like 'api.myapp', not the full '.local' domain.");
  }

  const labels = name.split(".");
  if (labels.length < 1 || (labels.length === 1 && labels[0] === "")) {
    throw new DevProxyError("Service name is required.");
  }

  for (const label of labels) {
    if (!labelPattern.test(label)) {
      throw new DevProxyError(
        `Invalid service name '${name}'. Use lowercase letters, numbers, dots, and hyphens.`,
      );
    }
  }
}

/**
 * Parse and validate a port number.
 *
 * Accepts a string or number and returns a valid integer port. Rejects
 * non-numeric values, floats, and numbers outside the 1–65535 range.
 *
 * @throws {DevProxyError} When the port is invalid.
 */
export function parsePort(value: string | number): number {
  const port = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new DevProxyError("Port must be an integer between 1 and 65535.");
  }

  return port;
}
