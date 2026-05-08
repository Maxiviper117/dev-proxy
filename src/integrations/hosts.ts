import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { DevProxyError } from "../core/errors.js";
import type { Service } from "../core/types.js";
import { formatPlatformName } from "../platform/support.js";

const startMarker = "# BEGIN DEVPROXY";
const endMarker = "# END DEVPROXY";

export type HostsDrift = {
  inSync: boolean;
  expected: string[];
  actual: string[];
  missing: string[];
  extra: string[];
};

/**
 * Render the DevProxy hosts block for given services.
 *
 * Produces a block wrapped in `# BEGIN DEVPROXY` / `# END DEVPROXY` markers
 * with one `127.0.0.1 <domain>` entry per service.
 */
export function renderHostsBlock(services: readonly Service[]): string {
  const entries = services.map((service) => `127.0.0.1 ${service.domain}`);
  return [startMarker, ...entries, endMarker].join("\n");
}

/**
 * Insert or replace the DevProxy block in hosts file content.
 *
 * Normalizes line endings, strips any existing DevProxy block, and appends a
 * fresh one. When no services remain, removes the block entirely and returns
 * the cleaned content.
 */
export function updateHostsContent(content: string, services: readonly Service[]): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
  const block = renderHostsBlock(services);
  const pattern = new RegExp(
    `\\n?${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`,
    "m",
  );
  const withoutBlock = normalized.replace(pattern, "").trimEnd();

  if (services.length === 0) {
    return `${withoutBlock}\n`;
  }

  return `${withoutBlock}\n\n${block}\n`;
}

/**
 * Extract domains from the DevProxy-owned hosts block.
 *
 * Ignores entries outside the `# BEGIN DEVPROXY` / `# END DEVPROXY` marker
 * pair so DevProxy never treats user-managed hosts lines as its own state.
 */
export function extractDevProxyHostsDomains(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const pattern = new RegExp(
    `${escapeRegExp(startMarker)}\\n([\\s\\S]*?)\\n${escapeRegExp(endMarker)}`,
    "m",
  );
  const match = normalized.match(pattern);

  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim().match(/^127\.0\.0\.1\s+(\S+)$/)?.[1])
    .filter((domain): domain is string => domain !== undefined);
}

/**
 * Compare DevProxy-owned hosts entries against registry services.
 */
export function getHostsDrift(hostsContent: string, services: readonly Service[]): HostsDrift {
  const expected = uniqueSorted(services.map((service) => service.domain));
  const actual = uniqueSorted(extractDevProxyHostsDomains(hostsContent));
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((domain) => !actualSet.has(domain));
  const extra = actual.filter((domain) => !expectedSet.has(domain));

  return {
    actual,
    expected,
    extra,
    inSync: missing.length === 0 && extra.length === 0,
    missing,
  };
}

/**
 * Read the hosts file and compare DevProxy entries with registry services.
 */
export async function readHostsDrift(
  hostsFile: string,
  services: readonly Service[],
): Promise<HostsDrift> {
  const current = await readFile(hostsFile, "utf8");
  return getHostsDrift(current, services);
}

/**
 * Read the hosts file and write it back with updated services.
 *
 * Wraps {@link updateHostsContent} in filesystem I/O and translates permission
 * errors into a user-friendly {@link DevProxyError} that asks for Administrator
 * privileges.
 *
 * @throws {DevProxyError} When the file cannot be written due to permissions.
 */
export async function writeHostsFile(
  hostsFile: string,
  services: readonly Service[],
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  try {
    const current = await readFile(hostsFile, "utf8");
    await writeFile(hostsFile, updateHostsContent(current, services), "utf8");
  } catch (error) {
    if (isPermissionError(error)) {
      throw hostsPermissionError(hostsFile, platform);
    }

    throw error;
  }
}

/**
 * Check whether the hosts file is writable.
 *
 * Uses `fs.access` with `W_OK` to test write permissions without mutating the
 * file. Returns `false` on any error (including missing file).
 */
export async function canWriteHosts(hostsFile: string): Promise<boolean> {
  try {
    await access(hostsFile, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Throw if the hosts file cannot be written.
 *
 * A convenience wrapper around {@link canWriteHosts} that throws a detailed
 * {@link DevProxyError} instructing the user to run as Administrator.
 *
 * @throws {DevProxyError} When the hosts file is not writable.
 */
export async function ensureHostsWritable(
  hostsFile: string,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  if (await canWriteHosts(hostsFile)) {
    return;
  }

  throw new DevProxyError(hostsPermissionMessage(hostsFile, platform));
}

/**
 * Escape special regular-expression characters in a string.
 *
 * Prepends a backslash to `. * + ? ^ $ { } ( ) | [ ] \` so the string can be
 * safely embedded in a `RegExp`.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * Build a {@link DevProxyError} for hosts-file permission failures.
 *
 * Includes the full path so the user knows exactly which file needs elevation.
 */
function hostsPermissionError(hostsFile: string, platform: NodeJS.Platform): DevProxyError {
  return new DevProxyError(hostsPermissionMessage(hostsFile, platform));
}

/**
 * Build the human-readable hosts permission error message.
 *
 * Instructs the user to open PowerShell as Administrator and rerun the same
 * command, including the absolute path to the hosts file for clarity.
 */
export function hostsPermissionMessage(hostsFile: string, platform: NodeJS.Platform): string {
  if (platform === "win32") {
    return [
      "DevProxy needs administrator rights to update the Windows hosts file.",
      "Open PowerShell as Administrator and rerun the same devproxy command.",
      `Hosts file: ${hostsFile}`,
    ].join("\n");
  }

  return [
    `DevProxy needs elevated permissions to update the ${formatPlatformName(platform)} hosts file.`,
    "Rerun the same devproxy command with sudo or from an elevated shell.",
    `Hosts file: ${hostsFile}`,
  ].join("\n");
}

/**
 * Determine whether an unknown error is a permission error.
 *
 * Checks for `EPERM` or `EACCES` codes raised by Node.js when a process lacks
 * the rights needed to read or write a file.
 */
function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EACCES")
  );
}
