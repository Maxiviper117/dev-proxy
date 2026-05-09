#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { renderBanner, renderVersionLine } from "./cli/help-text.js";
import { DevProxyError, normalizeError } from "./core/errors.js";
import type { DevProxyContext } from "./core/types.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: string };
const cliVersion = packageJson.version ?? "0.0.0";
type GetContext = () => DevProxyContext | Promise<DevProxyContext>;

/**
 * Build and configure the Commander CLI program with all devproxy commands.
 *
 * Registers subcommands (add, remove, open, list, doctor, status, certs, start, stop)
 * and wires each one to the corresponding service workflow. Help text includes a
 * colored ASCII banner and version line on the root command only.
 */
export function buildProgram(contextOrGetContext: DevProxyContext | GetContext): Command {
  const program = new Command();

  program
    .name("devproxy")
    .description("Stable HTTPS local domains for local development.")
    .version(cliVersion);

  program.addHelpText("beforeAll", ({ command }) => {
    const sections = [renderVersionLine(cliVersion)];

    if (command === program) {
      sections.unshift(renderBanner());
    }

    return sections.join("\n");
  });

  let servicesModule: typeof import("./commands/services.js") | undefined;
  let uiModule: typeof import("./cli/ui.js") | undefined;
  let serviceInstances:
    | {
        context: DevProxyContext;
        registry: import("./commands/services.js").RegistryService;
        project: import("./commands/services.js").ProjectService;
        caddy: import("./commands/services.js").CaddyService;
        diagnostics: import("./commands/services.js").DiagnosticsService;
      }
    | undefined;

  async function getServices() {
    if (!servicesModule) {
      servicesModule = await import("./commands/services.js");
    }
    return servicesModule;
  }

  async function getUi() {
    if (!uiModule) {
      uiModule = await import("./cli/ui.js");
    }
    return uiModule;
  }

  async function getContext(): Promise<DevProxyContext> {
    if (typeof contextOrGetContext === "function") {
      return await contextOrGetContext();
    }

    return contextOrGetContext;
  }

  async function getServiceInstances() {
    const context = await getContext();
    if (serviceInstances?.context === context) {
      return serviceInstances;
    }

    const { CaddyService, DiagnosticsService, ProjectService, RegistryService } =
      await getServices();
    serviceInstances = {
      caddy: new CaddyService(context),
      context,
      diagnostics: new DiagnosticsService(context),
      project: new ProjectService(context),
      registry: new RegistryService(context),
    };
    return serviceInstances;
  }

  program
    .command("init")
    .option("--name <name>", "service name, for example api.myapp")
    .option("--port <port>", "local port")
    .description("Initialize DevProxy for the current project and register its domain.")
    .action(async (options: { name?: string; port?: string }) => {
      const { renderSuccess } = await getUi();
      const { registry } = await getServiceInstances();
      const input =
        options.name !== undefined && options.port !== undefined
          ? { name: options.name, port: options.port }
          : undefined;
      console.log(renderSuccess(await registry.initProjectConfig(process.cwd(), input)));
    });

  program
    .command("add")
    .argument("<name>", "service name, for example api.myapp or myapp")
    .requiredOption("-p, --port <port>", "local port of the service to proxy")
    .description("Register an attach-mode service.")
    .action(async (name: string, options: { port: string }) => {
      const { renderSuccess } = await getUi();
      const { registry } = await getServiceInstances();
      console.log(renderSuccess(await registry.addService({ name, port: options.port })));
    });

  program
    .command("remove")
    .argument("<name>", "registered service name")
    .alias("rm")
    .description("Remove a registered service.")
    .action(async (name: string) => {
      const { renderSuccess } = await getUi();
      const { registry } = await getServiceInstances();
      console.log(renderSuccess(await registry.removeRegisteredService(name)));
    });

  program
    .command("open [target]")
    .description("Open a named browser target from .devproxy/config.json in the default browser.")
    .action(async (target?: string) => {
      const { renderSuccess } = await getUi();
      const { project } = await getServiceInstances();
      console.log(renderSuccess(await project.openInBrowser(target)));
    });

  program
    .command("list")
    .alias("ls")
    .option("--json", "Output in JSON format")
    .description("List registered services.")
    .action(async (options: { json?: boolean }) => {
      const { registry } = await getServiceInstances();
      if (options.json) {
        console.log(JSON.stringify(await registry.getListData(), null, 2));
      } else {
        const { renderList } = await getUi();
        console.log(renderList(await registry.getListData()));
      }
    });

  program
    .command("doctor")
    .option("--json", "Output in JSON format")
    .description("Check local DevProxy prerequisites.")
    .action(async (options: { json?: boolean }) => {
      const { diagnostics } = await getServiceInstances();
      if (options.json) {
        const data = await diagnostics.getDoctorData();
        console.log(JSON.stringify({ version: cliVersion, ...data }, null, 2));
      } else {
        const { renderDoctor } = await getUi();
        console.log(renderDoctor(await diagnostics.getDoctorData(), cliVersion));
      }
    });

  program
    .command("sync-hosts")
    .description("Align the DevProxy hosts-file block with the registry.")
    .action(async () => {
      const { renderSuccess } = await getUi();
      const { registry } = await getServiceInstances();
      console.log(renderSuccess(await registry.syncHosts()));
    });

  program
    .command("status")
    .option("--json", "Output in JSON format")
    .description("Report Caddy, registry, and upstream status.")
    .action(async (options: { json?: boolean }) => {
      const { diagnostics } = await getServiceInstances();
      if (options.json) {
        console.log(JSON.stringify(await diagnostics.getStatusData(), null, 2));
      } else {
        const { renderStatus } = await getUi();
        console.log(renderStatus(await diagnostics.getStatusData()));
      }
    });

  program
    .command("certs")
    .description("Print Caddy root CA certificate information.")
    .action(async () => {
      const { renderCerts } = await getUi();
      const { caddy } = await getServiceInstances();
      console.log(renderCerts(await caddy.printCertificateInfo()));
    });

  program
    .command("trust")
    .description("Trust the Caddy local root CA certificate.")
    .action(async () => {
      const { renderSuccess, renderWarning } = await getUi();
      const { caddy } = await getServiceInstances();
      const message = await caddy.trustCertificate();
      const isSuccess =
        message.includes("already trusted") || message.includes("trusted successfully");
      console.log(isSuccess ? renderSuccess(message) : renderWarning(message));
    });

  program
    .command("start")
    .description("Start Caddy with the current DevProxy config.")
    .action(async () => {
      const { renderSuccess, renderWarning } = await getUi();
      const { caddy } = await getServiceInstances();
      for (const message of await caddy.getStartWarnings()) {
        console.log(renderWarning(message));
      }

      console.log(renderSuccess(await caddy.start()));
    });

  program
    .command("stop")
    .description("Stop the Caddy server.")
    .action(async () => {
      const { renderSuccess, renderWarning } = await getUi();
      const { caddy } = await getServiceInstances();
      const message = await caddy.stop();
      const format = message.includes("not running") ? renderWarning : renderSuccess;
      console.log(format(message));
    });

  return program;
}

/**
 * Parse command-line arguments and execute the CLI.
 *
 * Builds the program, runs it against the provided argv, and catches any thrown
 * errors. Prints a colored error message and sets `process.exitCode` so the
 * process exits with a non-zero status on failure.
 */
export async function runCli(argv = process.argv): Promise<void> {
  try {
    let context: DevProxyContext | undefined;
    await buildProgram(async () => {
      if (!context) {
        const { createDefaultContext } = await import("./platform/context.js");
        context = createDefaultContext();
      }

      return context;
    }).parseAsync(argv);
  } catch (error) {
    const normalized = normalizeError(error);
    try {
      const { renderErrorMessage } = await import("./cli/ui.js");
      console.error(renderErrorMessage(normalized.message));
    } catch {
      console.error(normalized.message);
    }
    process.exitCode = normalized instanceof DevProxyError ? normalized.exitCode : 1;
  }
}

/**
 * Determine whether this module is being executed as the CLI entrypoint.
 *
 * Package managers commonly expose bin files as symlinks. Node resolves the
 * imported module to its real path, while `process.argv[1]` can remain the
 * symlink path, so both sides are resolved before comparing.
 */
export function isCliEntrypoint(argvPath: string | undefined, moduleUrl: string): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isCliEntrypoint(process.argv[1], import.meta.url)) {
  await runCli();
}
