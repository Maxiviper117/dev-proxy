import { spawn } from "node:child_process";
import { platform as currentPlatform } from "node:os";
import { ensureSupportedPlatform, type SupportedPlatform } from "./support.js";

/**
 * Open a URL in the platform default browser.
 *
 * Spawns the platform-native opener detached so the browser opens without
 * blocking the CLI process.
 */
export async function openDefaultBrowser(
  url: string,
  targetPlatform: NodeJS.Platform = currentPlatform(),
): Promise<void> {
  ensureSupportedPlatform(targetPlatform);
  const supportedPlatform = targetPlatform;
  const command = browserOpenCommand(url, supportedPlatform);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export function browserOpenCommand(
  url: string,
  targetPlatform: SupportedPlatform,
): { command: string; args: string[] } {
  switch (targetPlatform) {
    case "win32":
      return { command: "cmd", args: ["/c", "start", "", url] };
    case "darwin":
      return { command: "open", args: [url] };
    case "linux":
      return { command: "xdg-open", args: [url] };
  }
}
