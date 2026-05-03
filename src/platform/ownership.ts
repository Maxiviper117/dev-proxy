import { chown } from "node:fs/promises";

export type SudoOwner = {
  uid: number;
  gid: number;
};

/**
 * Resolve the original user for a process running through sudo.
 *
 * Returns undefined outside sudo or when sudo did not provide numeric ids.
 */
export function sudoOwnerFromEnv(env: NodeJS.ProcessEnv = process.env): SudoOwner | undefined {
  const uid = Number(env.SUDO_UID);
  const gid = Number(env.SUDO_GID);

  if (!Number.isInteger(uid) || !Number.isInteger(gid) || uid < 0 || gid < 0) {
    return undefined;
  }

  return { uid, gid };
}

/**
 * Give a generated file back to the user who invoked sudo.
 *
 * Hosts-file updates may require sudo on macOS/Linux, but DevProxy's own app
 * data should remain writable by the normal user so later start/stop/status
 * commands do not require elevation.
 */
export async function restoreSudoOwner(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const owner = sudoOwnerFromEnv(env);
  if (!owner) {
    return;
  }

  await chown(path, owner.uid, owner.gid);
}
