import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { DevProxyError } from "../core/errors.js";
import type { Service } from "../core/types.js";

const startMarker = "# BEGIN DEVPROXY";
const endMarker = "# END DEVPROXY";

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
): Promise<void> {
  try {
    const current = await readFile(hostsFile, "utf8");
    await writeFile(hostsFile, updateHostsContent(current, services), "utf8");
  } catch (error) {
    if (isPermissionError(error)) {
      throw hostsPermissionError(hostsFile);
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
export async function ensureHostsWritable(hostsFile: string): Promise<void> {
  if (await canWriteHosts(hostsFile)) {
    return;
  }

  throw new DevProxyError(hostsPermissionMessage(hostsFile));
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

/**
 * Build a {@link DevProxyError} for hosts-file permission failures.
 *
 * Includes the full path so the user knows exactly which file needs elevation.
 */
function hostsPermissionError(hostsFile: string): DevProxyError {
  return new DevProxyError(hostsPermissionMessage(hostsFile));
}

/**
 * Build the human-readable hosts permission error message.
 *
 * Instructs the user to open PowerShell as Administrator and rerun the same
 * command, including the absolute path to the hosts file for clarity.
 */
function hostsPermissionMessage(hostsFile: string): string {
  return [
    "DevProxy needs administrator rights to update the Windows hosts file.",
    "Open PowerShell as Administrator and rerun the same devproxy command.",
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
