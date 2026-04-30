#!/usr/bin/env node
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
  errorMessage,
  formatDoctor,
  formatList,
  formatStatus,
  success,
  warning,
} from "./cli/output.js";
import {
  addService,
  createDefaultContext,
  doctor,
  listServices,
  openServiceInBrowser,
  removeRegisteredService,
  status,
  startCaddyServer,
  stopCaddyServer,
} from "./commands/services.js";
import { DevProxyError, normalizeError } from "./core/errors.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: string };
const cliVersion = packageJson.version ?? "0.0.0";

export function buildProgram(context = createDefaultContext()): Command {
  const program = new Command();

  program
    .name("devproxy")
    .description("Stable HTTPS local domains for WSL development services.")
    .version(cliVersion);

  program
    .command("add")
    .argument("<name>", "service name, for example api.myapp")
    .requiredOption("-p, --port <port>", "local port forwarded from WSL")
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
    .command("open")
    .argument("<name>", "service name, for example api.myapp")
    .description("Open the service domain in the default browser.")
    .action(async (name: string) => {
      console.log(success(await openServiceInBrowser(context, name)));
    });

  program
    .command("list")
    .alias("ls")
    .description("List registered services.")
    .action(async () => {
      console.log(formatList(await listServices(context)));
    });

  program
    .command("doctor")
    .description("Check local DevProxy prerequisites.")
    .action(async () => {
      console.log(formatDoctor(await doctor(context)));
    });

  program
    .command("status")
    .description("Report Caddy, registry, and upstream status.")
    .action(async () => {
      console.log(formatStatus(await status(context)));
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
