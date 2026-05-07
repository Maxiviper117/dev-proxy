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

/**
 * Build and configure the Commander CLI program with all devproxy commands.
 *
 * Registers subcommands (add, remove, open, list, doctor, status, certs, start, stop)
 * and wires each one to the corresponding service workflow. Help text includes a
 * colored ASCII banner and version line on the root command only.
 */
export function buildProgram(context: DevProxyContext): Command {
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

  program
    .command("init")
    .requiredOption("--name <name>", "service name, for example api.myapp")
    .requiredOption("--port <port>", "local port")
    .description("Initialize DevProxy for the current project and register its domain.")
    .action(async (options: { name: string; port: string }) => {
      const { initProjectConfig } = await getServices();
      const { renderSuccess } = await getUi();
      console.log(
        renderSuccess(
          await initProjectConfig(context, process.cwd(), {
            name: options.name,
            port: options.port,
          }),
        ),
      );
    });

  program
    .command("add")
    .argument("<name>", "service name, for example api.myapp or myapp")
    .requiredOption("-p, --port <port>", "local port of the service to proxy")
    .description("Register an attach-mode service.")
    .action(async (name: string, options: { port: string }) => {
      const { addService } = await getServices();
      const { renderSuccess } = await getUi();
      console.log(renderSuccess(await addService(context, { name, port: options.port })));
    });

  program
    .command("remove")
    .argument("<name>", "registered service name")
    .alias("rm")
    .description("Remove a registered service.")
    .action(async (name: string) => {
      const { removeRegisteredService } = await getServices();
      const { renderSuccess } = await getUi();
      console.log(renderSuccess(await removeRegisteredService(context, name)));
    });

  program
    .command("open [name]")
    .description("Open the service domain in the default browser.")
    .action(async (name?: string) => {
      const { openServiceInBrowser } = await getServices();
      const { renderSuccess } = await getUi();
      console.log(renderSuccess(await openServiceInBrowser(context, name)));
    });

  program
    .command("list")
    .alias("ls")
    .option("--json", "Output in JSON format")
    .description("List registered services.")
    .action(async (options: { json?: boolean }) => {
      const { getListData } = await getServices();
      if (options.json) {
        console.log(JSON.stringify(await getListData(context), null, 2));
      } else {
        const { renderList } = await getUi();
        console.log(renderList(await getListData(context)));
      }
    });

  program
    .command("doctor")
    .option("--json", "Output in JSON format")
    .description("Check local DevProxy prerequisites.")
    .action(async (options: { json?: boolean }) => {
      const { getDoctorData } = await getServices();
      if (options.json) {
        const data = await getDoctorData(context);
        console.log(JSON.stringify({ version: cliVersion, ...data }, null, 2));
      } else {
        const { renderDoctor } = await getUi();
        console.log(renderDoctor(await getDoctorData(context), cliVersion));
      }
    });

  program
    .command("status")
    .option("--json", "Output in JSON format")
    .description("Report Caddy, registry, and upstream status.")
    .action(async (options: { json?: boolean }) => {
      const { getStatusData } = await getServices();
      if (options.json) {
        console.log(JSON.stringify(await getStatusData(context), null, 2));
      } else {
        const { renderStatus } = await getUi();
        console.log(renderStatus(await getStatusData(context)));
      }
    });

  program
    .command("certs")
    .description("Print Caddy root CA certificate information.")
    .action(async () => {
      const { printCertificateInfo } = await getServices();
      const { renderCerts } = await getUi();
      console.log(renderCerts(await printCertificateInfo(context)));
    });

  program
    .command("trust")
    .description("Trust the Caddy local root CA certificate.")
    .action(async () => {
      const { trustCaddyCertificate } = await getServices();
      const { renderSuccess, renderWarning } = await getUi();
      const message = await trustCaddyCertificate(context);
      const isSuccess =
        message.includes("already trusted") || message.includes("trusted successfully");
      console.log(isSuccess ? renderSuccess(message) : renderWarning(message));
    });

  program
    .command("start")
    .description("Start Caddy with the current DevProxy config.")
    .action(async () => {
      const { getCaddyStartWarnings, startCaddyServer } = await getServices();
      const { renderSuccess, renderWarning } = await getUi();
      for (const message of await getCaddyStartWarnings(context)) {
        console.log(renderWarning(message));
      }

      console.log(renderSuccess(await startCaddyServer(context)));
    });

  program
    .command("stop")
    .description("Stop the Caddy server.")
    .action(async () => {
      const { stopCaddyServer } = await getServices();
      const { renderSuccess, renderWarning } = await getUi();
      const message = await stopCaddyServer(context);
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
    const { createDefaultContext } = await import("./commands/services.js");
    await buildProgram(createDefaultContext()).parseAsync(argv);
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
