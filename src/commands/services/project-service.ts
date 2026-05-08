import { domainFromName } from "../../core/domain.js";
import { DevProxyError } from "../../core/errors.js";
import { projectConfigPath, readProjectConfig } from "../../core/config.js";
import type { DevProxyContext } from "../../core/types.js";
import { openDefaultBrowser } from "../../platform/browser.js";
import { ensureSupportedPlatform } from "../../platform/support.js";
import { getViteAllowedHostsWarning } from "./vite-config.js";

export class ProjectService {
  constructor(private readonly context: DevProxyContext) {}

  async openInBrowser(name?: string, cwd: string = process.cwd()): Promise<string> {
    ensureSupportedPlatform(this.context.platform);
    const resolved = name ?? (await this.resolveProjectName(cwd));
    const domain = domainFromName(resolved);
    const openUrl = this.context.openUrl ?? openDefaultBrowser;
    const viteWarning = name ? undefined : await getViteAllowedHostsWarning(cwd, domain);

    await openUrl(`https://${domain}/`);

    return [`Opened https://${domain}/ in the default browser.`, viteWarning]
      .filter((line) => line)
      .join("\n");
  }

  private async resolveProjectName(cwd: string): Promise<string> {
    const config = await readProjectConfig(projectConfigPath(cwd));
    if (!config?.name) {
      throw new DevProxyError(
        `No project config found at ${projectConfigPath(cwd)}. Run 'devproxy init' first.`,
      );
    }

    return config.name;
  }
}
