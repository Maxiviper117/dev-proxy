import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { restoreSudoOwner } from "../platform/ownership.js";
import { DevProxyError } from "./errors.js";

export type OpenTargets = Record<string, string>;

export type OpenConfig = {
  default?: string;
  targets?: OpenTargets;
};

export type DevProxyConfig = {
  $schema?: string;
  name: string;
  port: number;
  open?: OpenConfig;
};

const configSchemaFile = join(dirname(fileURLToPath(import.meta.url)), "config-schema.json");
const configSchemaUrl = pathToFileURL(configSchemaFile).href;

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
    const { $schema: _, ...config } = parsed;
    if (typeof config.name !== "string" || typeof config.port !== "number") {
      throw new DevProxyError(
        `Invalid project config at ${configFile}. Expected 'name' (string) and 'port' (number).`,
      );
    }

    validateOpenConfig(config, configFile);

    return parsed;
  } catch (error) {
    if (isFileMissing(error)) {
      return undefined;
    }

    throw error;
  }
}

function validateOpenConfig(config: DevProxyConfig, configFile: string): void {
  if (config.open === undefined) {
    return;
  }

  if (typeof config.open !== "object" || config.open === null) {
    throw new DevProxyError(
      `Invalid project config at ${configFile}. 'open' must be an object with 'default' (string) and 'targets' (object).`,
    );
  }

  if (config.open.default !== undefined && typeof config.open.default !== "string") {
    throw new DevProxyError(
      `Invalid project config at ${configFile}. 'open.default' must be a string.`,
    );
  }

  if (config.open.targets !== undefined) {
    if (typeof config.open.targets !== "object" || config.open.targets === null) {
      throw new DevProxyError(
        `Invalid project config at ${configFile}. 'open.targets' must be an object mapping target names to URL paths.`,
      );
    }

    for (const [key, value] of Object.entries(config.open.targets)) {
      if (typeof value !== "string") {
        throw new DevProxyError(
          `Invalid project config at ${configFile}. 'open.targets.${key}' must be a string.`,
        );
      }
    }
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
  const withSchema: DevProxyConfig = { $schema: configSchemaUrl, ...config };
  await writeFile(configFile, `${JSON.stringify(withSchema, null, 2)}\n`, "utf8");
  await restoreSudoOwner(configFile);
}

/**
 * Determine whether an unknown error indicates a missing file.
 */
function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
