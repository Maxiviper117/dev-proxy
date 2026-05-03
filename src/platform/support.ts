import { DevProxyError } from "../core/errors.js";

export const supportedPlatforms = ["win32", "darwin", "linux"] as const;

export type SupportedPlatform = (typeof supportedPlatforms)[number];

export function isSupportedPlatform(platform: NodeJS.Platform): platform is SupportedPlatform {
  return supportedPlatforms.includes(platform as SupportedPlatform);
}

export function ensureSupportedPlatform(
  platform: NodeJS.Platform,
): asserts platform is SupportedPlatform {
  if (!isSupportedPlatform(platform)) {
    throw new DevProxyError(
      `DevProxy supports Windows, macOS, and Linux. Current platform: ${platform}.`,
    );
  }
}

export function formatPlatformName(platform: NodeJS.Platform): string {
  switch (platform) {
    case "win32":
      return "Windows";
    case "darwin":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return platform;
  }
}
