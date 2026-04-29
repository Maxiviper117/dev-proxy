import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { DevProxyError } from "../core/errors.js";
import type { Service } from "../core/types.js";

const startMarker = "# BEGIN DEVPROXY";
const endMarker = "# END DEVPROXY";

export function renderHostsBlock(services: readonly Service[]): string {
  const entries = services.map((service) => `127.0.0.1 ${service.domain}`);
  return [startMarker, ...entries, endMarker].join("\n");
}

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

export async function canWriteHosts(hostsFile: string): Promise<boolean> {
  try {
    await access(hostsFile, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureHostsWritable(hostsFile: string): Promise<void> {
  if (await canWriteHosts(hostsFile)) {
    return;
  }

  throw new DevProxyError(hostsPermissionMessage(hostsFile));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hostsPermissionError(hostsFile: string): DevProxyError {
  return new DevProxyError(hostsPermissionMessage(hostsFile));
}

function hostsPermissionMessage(hostsFile: string): string {
  return [
    "DevProxy needs administrator rights to update the Windows hosts file.",
    "Open PowerShell as Administrator and rerun the same devproxy command.",
    `Hosts file: ${hostsFile}`,
  ].join("\n");
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EACCES")
  );
}
