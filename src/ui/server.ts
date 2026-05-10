import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import type { DevProxyContext } from "../core/types.js";
import { CaddyService, DiagnosticsService, RegistryService } from "../commands/services.js";

type UiServerOptions = {
  context: DevProxyContext;
  host: string;
  port: number;
  version: string;
  staticDir: string;
};

type UiServerHandle = {
  url: string;
  token: string;
  close: () => Promise<void>;
  waitUntilClosed: () => Promise<void>;
};

type JsonResult<T> = { ok: true; data: T } | { ok: false; error: string };

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export async function startUiServer(options: UiServerOptions): Promise<UiServerHandle> {
  const token = randomBytes(24).toString("hex");
  const registryService = new RegistryService(options.context);
  const diagnosticsService = new DiagnosticsService(options.context);
  const caddyService = new CaddyService(options.context);

  const server = createServer(async (req, res) => {
    try {
      await routeRequest(req, res, {
        ...options,
        token,
        registryService,
        diagnosticsService,
        caddyService,
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://${address.address}:${address.port}`;
  const close = async () =>
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  const waitUntilClosed = async () =>
    await new Promise<void>((resolve) => {
      server.once("close", () => resolve());
    });

  return {
    url: `${baseUrl}/?token=${token}`,
    token,
    close,
    waitUntilClosed,
  };
}

type RouteContext = UiServerOptions & {
  token: string;
  registryService: RegistryService;
  diagnosticsService: DiagnosticsService;
  caddyService: CaddyService;
};

async function routeRequest(req: IncomingMessage, res: ServerResponse, ctx: RouteContext) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

  if (url.pathname.startsWith("/api/")) {
    if (url.searchParams.get("token") !== ctx.token) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return;
    }

    await handleApiRequest(req, res, url, ctx);
    return;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  await serveStaticFile(res, ctx.staticDir, url.pathname);
}

async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: RouteContext,
) {
  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const [list, status, doctor] = await Promise.all([
      ctx.registryService.getListData(),
      ctx.diagnosticsService.getStatusData(),
      ctx.diagnosticsService.getDoctorData(),
    ]);

    sendJson(res, 200, {
      ok: true,
      data: {
        version: ctx.version,
        platform: ctx.context.platform,
        paths: ctx.context.paths,
        services: list.services,
        status,
        doctor,
      },
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    sendJson(res, 200, { ok: true, data: await ctx.diagnosticsService.getStatusData() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/doctor") {
    sendJson(res, 200, { ok: true, data: await ctx.diagnosticsService.getDoctorData() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/start") {
    const warnings = await ctx.caddyService.getStartWarnings();
    const message = await ctx.caddyService.start();
    sendJson(res, 200, { ok: true, data: { message, warnings } });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/stop") {
    sendJson(res, 200, { ok: true, data: { message: await ctx.caddyService.stop() } });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/open") {
    const body = await readJsonBody(req);
    const name = typeof body.name === "string" ? body.name.trim().toLowerCase() : "";

    if (name.length === 0) {
      sendJson(res, 400, { ok: false, error: "Service name is required." });
      return;
    }

    const list = await ctx.registryService.getListData();
    const service = list.services.find((item) => item.name === name);
    if (!service) {
      sendJson(res, 404, { ok: false, error: `Service '${name}' was not found.` });
      return;
    }

    const urlToOpen = `https://${service.domain}/`;
    const openUrl = ctx.context.openUrl;
    if (!openUrl) {
      sendJson(res, 500, { ok: false, error: "Browser open integration is not available." });
      return;
    }

    await openUrl(urlToOpen);
    sendJson(res, 200, { ok: true, data: { message: `Opened ${urlToOpen}.` } });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object body.");
  }
  return parsed as Record<string, unknown>;
}

async function serveStaticFile(res: ServerResponse, staticDir: string, pathname: string) {
  const candidatePath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(candidatePath).replace(/^(\.\.[/\\])+/, "");
  const diskPath = join(staticDir, safePath);

  const exists = await fileExists(diskPath);
  const targetPath = exists ? diskPath : join(staticDir, "index.html");
  const data = await readFile(targetPath);
  const contentType = CONTENT_TYPES[extname(targetPath)] ?? "application/octet-stream";

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.end(data);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const result = await stat(path);
    return result.isFile();
  } catch {
    return false;
  }
}

function sendJson<T>(res: ServerResponse, statusCode: number, body: JsonResult<T>) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
