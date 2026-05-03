import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { restoreSudoOwner } from "../platform/ownership.js";
import { DevProxyError } from "./errors.js";
import type { Registry, Service } from "./types.js";

export const emptyRegistry = {
  version: 1,
  services: [],
} satisfies Registry;

/**
 * Read the registry file from disk.
 *
 * Parses JSON and validates the `version` and `services` shape. If the file
 * does not exist, returns a fresh empty registry instead of throwing.
 *
 * @throws {DevProxyError} When the file exists but has an invalid structure.
 */
export async function readRegistry(registryFile: string): Promise<Registry> {
  try {
    const raw = await readFile(registryFile, "utf8");
    const parsed = JSON.parse(raw) as Registry;
    if (parsed.version !== 1 || !Array.isArray(parsed.services)) {
      throw new DevProxyError(`Invalid registry file: ${registryFile}`);
    }

    return parsed;
  } catch (error) {
    if (isFileMissing(error)) {
      return { ...emptyRegistry, services: [] };
    }

    if (isPermissionError(error)) {
      throw new DevProxyError(appDataPermissionMessage(registryFile));
    }

    throw error;
  }
}

/**
 * Write the registry to disk as formatted JSON.
 *
 * Creates parent directories automatically so the file can be written to a
 * fresh application data folder.
 */
export async function writeRegistry(registryFile: string, registry: Registry): Promise<void> {
  try {
    await mkdir(dirname(registryFile), { recursive: true });
    await restoreSudoOwner(dirname(registryFile));
    await writeFile(registryFile, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
    await restoreSudoOwner(registryFile);
  } catch (error) {
    if (isPermissionError(error)) {
      throw new DevProxyError(appDataPermissionMessage(registryFile));
    }

    throw error;
  }
}

/**
 * Find an existing service in the registry by name or domain.
 *
 * Returns the matching service entry or `undefined` when no conflict exists.
 */
export function findService(registry: Registry, name: string, domain: string): Service | undefined {
  return registry.services.find((entry) => entry.name === name || entry.domain === domain);
}

/**
 * Add or update a service in the registry.
 *
 * If a service with the same name or domain already exists, the existing
 * entry is replaced and the original `createdAt` timestamp is preserved.
 * New entries are appended and the list is sorted alphabetically by name.
 */
export function upsertService(registry: Registry, service: Service): Registry {
  const existingIndex = registry.services.findIndex(
    (entry) => entry.name === service.name || entry.domain === service.domain,
  );

  if (existingIndex !== -1) {
    const existing = registry.services[existingIndex]!;
    const updated = [...registry.services];
    updated[existingIndex] = { ...service, createdAt: existing.createdAt };
    return { ...registry, services: updated };
  }

  return {
    ...registry,
    services: [...registry.services, service].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * Remove a service from the registry by name.
 *
 * Finds the service, returns it alongside the updated registry, and preserves
 * immutability by creating a new services array.
 *
 * @throws {DevProxyError} When the named service is not found.
 */
export function removeService(
  registry: Registry,
  name: string,
): { registry: Registry; removed: Service } {
  const removed = registry.services.find((service) => service.name === name);
  if (!removed) {
    throw new DevProxyError(`Service '${name}' is not registered.`);
  }

  return {
    removed,
    registry: {
      ...registry,
      services: registry.services.filter((service) => service.name !== name),
    },
  };
}

/**
 * Determine whether an unknown error indicates a missing file.
 *
 * Checks for the `ENOENT` error code commonly raised by Node.js filesystem
 * operations when a path does not exist.
 */
function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EACCES")
  );
}

function appDataPermissionMessage(path: string): string {
  return [
    "DevProxy cannot access its user app-data files.",
    "This usually happens when a previous command was run with sudo and created root-owned files.",
    "Fix ownership, then rerun the command:",
    `  sudo chown -R ${process.env.USER ?? "$USER"}:staff "${dirname(path)}"`,
  ].join("\n");
}
