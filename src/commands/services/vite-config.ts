import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

const viteConfigFiles = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.mjs",
  "vite.config.cts",
  "vite.config.cjs",
];

export async function getViteAllowedHostsWarning(
  cwd: string,
  domain: string,
): Promise<string | undefined> {
  const viteConfigFile = await findViteConfigFile(cwd);
  if (!viteConfigFile) {
    return undefined;
  }

  const source = await readFile(viteConfigFile, "utf8");
  const allowedHosts = parseViteAllowedHosts(source);
  if (allowedHosts === true || allowedHosts.hosts.includes(domain)) {
    return undefined;
  }

  if (allowedHosts.found) {
    return `warn Vite config found, but server.allowedHosts does not include "${domain}". Add "${domain}" to server.allowedHosts in ${viteConfigFile} if the browser shows Vite's blocked-host warning.`;
  }

  return `warn Vite config found, but server.allowedHosts is not set. Add "${domain}" to server.allowedHosts in ${viteConfigFile} if the browser shows Vite's blocked-host warning.`;
}

async function findViteConfigFile(cwd: string): Promise<string | undefined> {
  const candidates = viteConfigFiles.map((configFile) => join(cwd, configFile));
  const existing = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await access(candidate);
        return candidate;
      } catch (error) {
        if (isFileMissing(error)) {
          return undefined;
        }

        throw error;
      }
    }),
  );

  return existing.find((candidate) => candidate);
}

function parseViteAllowedHosts(source: string): { found: boolean; hosts: string[] } | true {
  const sourceFile = ts.createSourceFile("vite.config.ts", source, ts.ScriptTarget.Latest, true);
  const serverConfig = findServerConfig(sourceFile);
  if (!serverConfig) {
    return { found: false, hosts: [] };
  }

  const allowedHosts = getObjectPropertyInitializer(serverConfig, "allowedHosts");
  if (!allowedHosts) {
    return { found: false, hosts: [] };
  }

  if (allowedHosts.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (!ts.isArrayLiteralExpression(allowedHosts)) {
    return { found: true, hosts: [] };
  }

  const hosts = allowedHosts.elements
    .filter((element) => ts.isStringLiteralLike(element))
    .map((element) => element.text);

  return { found: true, hosts };
}

function findServerConfig(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | undefined {
  let serverConfig: ts.ObjectLiteralExpression | undefined;

  function visit(node: ts.Node): void {
    if (serverConfig) {
      return;
    }

    if (ts.isObjectLiteralExpression(node)) {
      const server = getObjectPropertyInitializer(node, "server");
      if (server && ts.isObjectLiteralExpression(server)) {
        serverConfig = server;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return serverConfig;
}

function getObjectPropertyInitializer(
  objectLiteral: ts.ObjectLiteralExpression,
  propertyName: string,
): ts.Expression | undefined {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    if (getPropertyNameText(property.name) === propertyName) {
      return property.initializer;
    }
  }

  return undefined;
}

function getPropertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
    return name.text;
  }

  return undefined;
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
