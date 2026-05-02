import { spawn } from "node:child_process";

/**
 * Open a URL in the default Windows browser.
 *
 * Spawns `cmd /c start` detached and hidden so the browser opens without
 * blocking the CLI process.
 */
export async function openDefaultBrowser(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("cmd", ["/c", "start", "", url], {
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
