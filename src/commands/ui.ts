import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDefaultBrowser } from "../platform/browser.js";
import type { DevProxyContext } from "../core/types.js";
import { startUiServer } from "../ui/server.js";
import { DevProxyError } from "../core/errors.js";

type UiCommandOptions = {
  host?: string;
  port?: string;
  open?: boolean;
};

export async function runUiCommand(
  context: DevProxyContext,
  version: string,
  options: UiCommandOptions,
): Promise<void> {
  const host = options.host?.trim() || "127.0.0.1";
  const requestedPort = parsePort(options.port);
  const chosenPort = await findAvailablePort(host, requestedPort, 25);
  if (chosenPort === undefined) {
    throw new DevProxyError(
      `Could not find an available port near ${requestedPort} on ${host}. Try --port with a different value.`,
    );
  }

  const staticDir = join(dirname(fileURLToPath(import.meta.url)), "..", "ui-static");
  const server = await startUiServer({
    context,
    host,
    port: chosenPort,
    version,
    staticDir,
  });

  const stop = async () => {
    await server.close();
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  const shouldOpen = options.open ?? true;
  if (shouldOpen) {
    const openUrl = context.openUrl ?? ((url: string) => openDefaultBrowser(url, context.platform));
    await openUrl(server.url);
  }

  console.log(`DevProxy UI running at ${server.url}`);
  console.log("Press Ctrl+C to stop.");

  await server.waitUntilClosed();
}

function parsePort(input?: string): number {
  if (input === undefined) {
    return 3579;
  }
  const trimmed = input.trim();
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new DevProxyError(`Invalid UI port '${input}'. Use a value between 1 and 65535.`);
  }
  return parsed;
}

async function findAvailablePort(host: string, startPort: number, maxAttempts: number) {
  const ports = Array.from({ length: maxAttempts }, (_unused, offset) => startPort + offset).filter(
    (port) => port <= 65535,
  );
  const checks = await Promise.all(
    ports.map(async (port) => ({ port, available: await canListen(host, port) })),
  );
  const match = checks.find((check) => check.available);
  if (match) {
    return match.port;
  }

  return undefined;
}

async function canListen(host: string, port: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, host, () => {
      probe.close(() => resolve(true));
    });
  });
}
