import { spawn } from "node:child_process";
import type { CommandRunner } from "../core/types.js";

/**
 * Spawn a command and capture its exit code, stdout, and stderr.
 *
 * Runs the command with `windowsHide: true`, aggregates output streams into
 * strings, and resolves with the exit code. If the process fails to spawn,
 * resolves with code `127` and the error message as stderr.
 */
export const runCommand: CommandRunner = async (command, args) => {
  return await new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let resolved = false;

    const finish = (code: number, errorOutput?: string): void => {
      if (resolved) {
        return;
      }

      resolved = true;
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({ code, stdout, stderr: errorOutput ?? stderr });
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      finish(127, error.message);
    });
    child.on("exit", (code) => {
      finish(code ?? 1);
    });
  });
};
