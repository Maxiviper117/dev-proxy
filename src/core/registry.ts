import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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
  await mkdir(dirname(registryFile), { recursive: true });
  await writeFile(registryFile, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

/**
 * Add or update a service in the registry.
 *
 * If the service already exists with identical properties, only its
 * `updatedAt` timestamp is refreshed. If a conflicting entry (same name or
 * domain but different port) exists, an error is thrown. New entries are
 * appended and the list is sorted alphabetically by name.
 *
 * @throws {DevProxyError} When a conflicting service is already registered.
 */
export function upsertService(registry: Registry, service: Service): Registry {
  const existing = registry.services.find(
    (entry) => entry.name === service.name || entry.domain === service.domain,
  );
  if (existing) {
    if (
      existing.name === service.name &&
      existing.domain === service.domain &&
      existing.port === service.port &&
      existing.mode === service.mode
    ) {
      return {
        ...registry,
        services: registry.services.map((entry) =>
          entry.name === service.name ? { ...entry, updatedAt: service.updatedAt } : entry,
        ),
      };
    }

    throw new DevProxyError(
      `Service '${existing.name}' already exists for ${existing.domain}. Remove it before changing its port.`,
    );
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
