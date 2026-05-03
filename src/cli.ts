#!/usr/bin/env node
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
  errorMessage,
  formatBanner,
  formatCerts,
  formatDoctor,
  formatList,
  formatStatus,
  formatVersionLine,
  success,
  withDoctorVersion,
  warning,
} from "./cli/output.js";
import {
  addService,
  createDefaultContext,
  doctor,
  getDoctorData,
  getListData,
  getStatusData,
  initProjectConfig,
  listServices,
  openServiceInBrowser,
  printCertificateInfo,
  removeRegisteredService,
  status,
  startCaddyServer,
  stopCaddyServer,
} from "./commands/services.js";
import { DevProxyError, normalizeError } from "./core/errors.js";

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
export function buildProgram(context = createDefaultContext()): Command {
  const program = new Command();

  program
    .name("devproxy")
    .description("Stable HTTPS local domains for Windows development.")
    .version(cliVersion);

  program.addHelpText("beforeAll", ({ command }) => {
    const sections = [formatVersionLine(cliVersion)];

    if (command === program) {
      sections.unshift(formatBanner());
    }

    return sections.join("\n");
  });

  program
    .command("init")
    .requiredOption("--name <name>", "service name, for example api.myapp")
    .requiredOption("--port <port>", "local port")
    .description("Initialize DevProxy for the current project and register its domain.")
    .action(async (options: { name: string; port: string }) => {
      console.log(
        success(
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
      console.log(success(await addService(context, { name, port: options.port })));
    });

  program
    .command("remove")
    .argument("<name>", "registered service name")
    .alias("rm")
    .description("Remove a registered service.")
    .action(async (name: string) => {
      console.log(success(await removeRegisteredService(context, name)));
    });

  program
    .command("open [name]")
    .description("Open the service domain in the default browser.")
    .action(async (name?: string) => {
      console.log(success(await openServiceInBrowser(context, name)));
    });

  program
    .command("list")
    .alias("ls")
    .option("--json", "Output in JSON format")
    .description("List registered services.")
    .action(async (options: { json?: boolean }) => {
      if (options.json) {
        console.log(JSON.stringify(await getListData(context), null, 2));
      } else {
        console.log(formatList(await listServices(context)));
      }
    });

  program
    .command("doctor")
    .option("--json", "Output in JSON format")
    .description("Check local DevProxy prerequisites.")
    .action(async (options: { json?: boolean }) => {
      if (options.json) {
        const data = await getDoctorData(context);
        console.log(JSON.stringify({ version: cliVersion, ...data }, null, 2));
      } else {
        console.log(formatDoctor(withDoctorVersion(await doctor(context), cliVersion)));
      }
    });

  program
    .command("status")
    .option("--json", "Output in JSON format")
    .description("Report Caddy, registry, and upstream status.")
    .action(async (options: { json?: boolean }) => {
      if (options.json) {
        console.log(JSON.stringify(await getStatusData(context), null, 2));
      } else {
        console.log(formatStatus(await status(context)));
      }
    });

  program
    .command("certs")
    .description("Print Caddy root CA certificate information.")
    .action(async () => {
      console.log(formatCerts(await printCertificateInfo(context)));
    });

  program
    .command("start")
    .description("Start Caddy with the current DevProxy config.")
    .action(async () => {
      console.log(success(await startCaddyServer(context)));
    });

  program
    .command("stop")
    .description("Stop the Caddy server.")
    .action(async () => {
      const message = await stopCaddyServer(context);
      const format = message.includes("not running") ? warning : success;
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
    await buildProgram().parseAsync(argv);
  } catch (error) {
    const normalized = normalizeError(error);
    console.error(errorMessage(normalized.message));
    process.exitCode = normalized instanceof DevProxyError ? normalized.exitCode : 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runCli();
}
