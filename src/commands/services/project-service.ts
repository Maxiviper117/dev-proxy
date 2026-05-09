import { domainFromName } from "../../core/domain.js";
import { DevProxyError } from "../../core/errors.js";
import type { DevProxyConfig } from "../../core/config.js";
import { projectConfigPath, readProjectConfig } from "../../core/config.js";
import type { DevProxyContext } from "../../core/types.js";
import { openDefaultBrowser } from "../../platform/browser.js";
import { ensureSupportedPlatform } from "../../platform/support.js";
import { getViteAllowedHostsWarning } from "./vite-config.js";

export class ProjectService {
  constructor(private readonly context: DevProxyContext) {}

  async openInBrowser(target?: string, cwd: string = process.cwd()): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const configPath = projectConfigPath(cwd);
    const config = await readProjectConfig(configPath);
    if (!config) {
      throw new DevProxyError(
        `No project config found at ${configPath}. Run 'devproxy init' first.`,
      );
    }

    const domain = domainFromName(config.name);
    const url = resolveOpenUrl(config, domain, target);
    const openUrl = this.context.openUrl ?? openDefaultBrowser;
    const viteWarning = target ? undefined : await getViteAllowedHostsWarning(cwd, domain);

    await openUrl(url);

    return [`Opened ${url} in the default browser.`, viteWarning].filter((line) => line).join("\n");
  }
}

function resolveOpenUrl(config: DevProxyConfig, domain: string, target?: string): string {
  const base = `https://${domain}`;
  const open = config.open;
  const trailingSlash = domain + "/";

  if (!target) {
    if (!open || open.default === undefined) {
      return `https://${trailingSlash}`;
    }

    return `${base}${open.default}`;
  }

  if (!open?.targets) {
    throw new DevProxyError(
      `Target '${target}' not found. No targets defined in ${projectConfigPath(process.cwd())}.`,
    );
  }

  const targetPath = open.targets[target];
  if (targetPath === undefined) {
    const available = Object.keys(open.targets);
    if (available.length === 0) {
      throw new DevProxyError(
        `Target '${target}' not found. No targets defined in .devproxy/config.json.`,
      );
    }

    throw new DevProxyError(
      `Target '${target}' not found. Available targets: ${available.join(", ")}.`,
    );
  }

  return `${base}${targetPath}`;
}
