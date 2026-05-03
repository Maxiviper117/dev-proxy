import { spawn } from "node:child_process";
import type { CommandRunner, ManagedProcessSpawner } from "../core/types.js";

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

/**
 * Spawn a managed process with inherited stdio and return a handle.
 *
 * Uses `shell: true` so `.cmd` binaries like `npm` work on Windows. The
 * returned handle exposes the shell PID, an exit listener, and a tree-kill
 * via `taskkill`.
 */
export const spawnManagedProcess: ManagedProcessSpawner = (command, args) => {
  const child = spawn(command, args, {
    shell: true,
    stdio: "inherit",
    windowsHide: true,
  });

  let exited = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  const callbacks: Array<(code: number | null, signal: NodeJS.Signals | null) => void> = [];

  child.on("exit", (code, signal) => {
    exited = true;
    exitCode = code ?? null;
    exitSignal = signal ?? null;
    for (const cb of callbacks) {
      cb(exitCode, exitSignal);
    }
  });

  return {
    pid: child.pid ?? 0,
    onExit: (callback) => {
      if (exited) {
        callback(exitCode, exitSignal);
      } else {
        callbacks.push(callback);
      }
    },
    kill: async () => {
      if (!child.pid) return;
      return await new Promise<void>((resolve) => {
        const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
        });
        killer.on("exit", () => resolve());
        killer.on("error", () => resolve());
      });
    },
  };
};
