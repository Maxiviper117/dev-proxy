import { spawn } from "node:child_process";

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
