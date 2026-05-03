import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { restoreSudoOwner } from "../platform/ownership.js";
import { DevProxyError } from "./errors.js";

export type DevProxyConfig = {
  name: string;
  port: number;
};

const configDirName = ".devproxy";
const configFileName = "config.json";

/**
 * Resolve the default project config path from the current working directory.
 *
 * Returns `$CWD/.devproxy/config.json`.
 */
export function projectConfigPath(cwd: string): string {
  return join(cwd, configDirName, configFileName);
}

/**
 * Read the project config file from the given path.
 *
 * Parses JSON and validates the presence of `name` and `port`. Returns
 * `undefined` when the file does not exist.
 *
 * @throws {DevProxyError} When the file exists but has an invalid structure.
 */
export async function readProjectConfig(configFile: string): Promise<DevProxyConfig | undefined> {
  try {
    const raw = await readFile(configFile, "utf8");
    const parsed = JSON.parse(raw) as DevProxyConfig;
    if (typeof parsed.name !== "string" || typeof parsed.port !== "number") {
      throw new DevProxyError(
        `Invalid project config at ${configFile}. Expected 'name' (string) and 'port' (number).`,
      );
    }

    return parsed;
  } catch (error) {
    if (isFileMissing(error)) {
      return undefined;
    }

    throw error;
  }
}

/**
 * Write the project config file to disk as formatted JSON.
 *
 * Creates parent directories automatically. Overwrites any existing file.
 */
export async function writeProjectConfig(
  configFile: string,
  config: DevProxyConfig,
): Promise<void> {
  await mkdir(dirname(configFile), { recursive: true });
  await restoreSudoOwner(dirname(configFile));
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await restoreSudoOwner(configFile);
}

/**
 * Determine whether an unknown error indicates a missing file.
 */
function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
