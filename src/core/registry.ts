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
 * Update an existing service in the registry.
 *
 * Finds the service by old name, applies the provided updates, re-sorts the
 * list alphabetically, and returns the new registry alongside the old and new
 * service objects. If the new name or domain conflicts with another registered
 * service an error is thrown.
 *
 * @throws {DevProxyError} When the named service is not found.
 * @throws {DevProxyError} When the new name or domain conflicts with another service.
 */
export function updateService(
  registry: Registry,
  oldName: string,
  update: Partial<Pick<Service, "name" | "domain" | "port">>,
  timestamp: string,
): { registry: Registry; oldService: Service; newService: Service } {
  const existing = registry.services.find((s) => s.name === oldName);
  if (!existing) {
    throw new DevProxyError(`Service '${oldName}' is not registered.`);
  }

  const newName = update.name ?? existing.name;
  const newDomain = update.domain ?? existing.domain;
  const newPort = update.port ?? existing.port;

  if (newName !== existing.name || newDomain !== existing.domain) {
    const conflict = registry.services.find(
      (s) => s.name !== oldName && (s.name === newName || s.domain === newDomain),
    );
    if (conflict) {
      throw new DevProxyError(
        `Service '${conflict.name}' already uses ${
          conflict.name === newName ? `name '${newName}'` : `domain '${newDomain}'`
        }.`,
      );
    }
  }

  const newService: Service = {
    ...existing,
    name: newName,
    domain: newDomain,
    port: newPort,
    updatedAt: timestamp,
  };

  const services = registry.services
    .filter((s) => s.name !== oldName)
    .concat(newService)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    registry: { ...registry, services },
    oldService: existing,
    newService,
  };
}

/**
 * Remove multiple services from the registry by name.
 *
 * Filters out each named service, collects the removed entries, and returns
 * the updated registry alongside the removed list. Throws when no matching
 * services are found.
 *
 * @throws {DevProxyError} When no matching services are found.
 */
export function removeServices(
  registry: Registry,
  names: string[],
): { registry: Registry; removed: Service[] } {
  const removed: Service[] = [];
  const remaining = registry.services.filter((service) => {
    if (names.includes(service.name)) {
      removed.push(service);
      return false;
    }
    return true;
  });

  if (removed.length === 0) {
    throw new DevProxyError("No matching services found.");
  }

  return { removed, registry: { ...registry, services: remaining } };
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
