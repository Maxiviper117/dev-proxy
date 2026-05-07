import type { CommandRunner } from "../core/types.js";

export type ElevationChecker = () => Promise<boolean>;

/**
 * Build a cross-platform elevation checker.
 *
 * On Windows, runs `net session` which succeeds only for administrators.
 * On macOS/Linux, checks whether the effective UID is 0 (root).
 */
export function createElevationChecker(
  platform: NodeJS.Platform,
  run: CommandRunner,
): ElevationChecker {
  return async function isElevated(): Promise<boolean> {
    if (platform === "win32") {
      const result = await run("net", ["session"]);
      return result.code === 0;
    }

    return process.getuid?.() === 0;
  };
}
