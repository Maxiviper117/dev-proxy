import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectService, RegistryService } from "../src/commands/services.js";
import { createContext } from "./helpers/test-helpers.js";

describe("open command", () => {
  it("opens a service domain using project config", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "api.myapp",
      port: "8000",
    });

    let openedUrl = "";
    context.openUrl = async (url) => {
      openedUrl = url;
    };

    await expect(new ProjectService(context).openInBrowser(undefined, projectDir)).resolves.toBe(
      "Opened https://api.myapp.local/ in the default browser.",
    );
    expect(openedUrl).toBe("https://api.myapp.local/");
  });

  it("without target opens default URL when no open config", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    let openedUrl = "";
    context.openUrl = async (url) => {
      openedUrl = url;
    };

    await expect(new ProjectService(context).openInBrowser(undefined, projectDir)).resolves.toBe(
      "Opened https://my-app.local/ in the default browser.",
    );
    expect(openedUrl).toBe("https://my-app.local/");
  });

  it("without target uses open.default path", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    const configPath = join(projectDir, ".devproxy", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    config.open = { default: "/dashboard", targets: { docs: "/docs", admin: "/admin" } };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    let openedUrl = "";
    context.openUrl = async (url) => {
      openedUrl = url;
    };

    await expect(new ProjectService(context).openInBrowser(undefined, projectDir)).resolves.toBe(
      "Opened https://my-app.local/dashboard in the default browser.",
    );
    expect(openedUrl).toBe("https://my-app.local/dashboard");
  });

  it("with target opens the named target path", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    const configPath = join(projectDir, ".devproxy", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    config.open = { default: "/dashboard", targets: { docs: "/docs", admin: "/admin" } };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    let openedUrl = "";
    context.openUrl = async (url) => {
      openedUrl = url;
    };

    await expect(new ProjectService(context).openInBrowser("docs", projectDir)).resolves.toBe(
      "Opened https://my-app.local/docs in the default browser.",
    );
    expect(openedUrl).toBe("https://my-app.local/docs");
  });

  it("with unknown target lists available targets", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    const configPath = join(projectDir, ".devproxy", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    config.open = { default: "/", targets: { docs: "/docs", admin: "/admin" } };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    context.openUrl = async () => {};

    await expect(new ProjectService(context).openInBrowser("graphql", projectDir)).rejects.toThrow(
      "Target 'graphql' not found. Available targets: docs, admin.",
    );
  });

  it("with target errors when no targets defined", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });

    context.openUrl = async () => {};

    await expect(new ProjectService(context).openInBrowser("docs", projectDir)).rejects.toThrow(
      "Target 'docs' not found. No targets defined",
    );
  });

  it("warns when Vite allowedHosts is missing", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });
    await writeFile(
      join(projectDir, "vite.config.ts"),
      [
        "import { defineConfig } from 'vite';",
        "export default defineConfig({",
        "  server: { port: 8080 },",
        "});",
      ].join("\n"),
      "utf8",
    );

    context.openUrl = async () => {};

    await expect(
      new ProjectService(context).openInBrowser(undefined, projectDir),
    ).resolves.toContain('server.allowedHosts is not set. Add "my-app.local"');
  });

  it("ignores commented Vite allowedHosts", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });
    await writeFile(
      join(projectDir, "vite.config.ts"),
      [
        "import { defineConfig } from 'vite';",
        "export default defineConfig({",
        "  server: {",
        "    // host: '0.0.0.0',",
        "    // port: 8080,",
        "    // allowedHosts: ['my-app.local'],",
        "  },",
        "});",
      ].join("\n"),
      "utf8",
    );

    context.openUrl = async () => {};

    await expect(
      new ProjectService(context).openInBrowser(undefined, projectDir),
    ).resolves.toContain('server.allowedHosts is not set. Add "my-app.local"');
  });

  it("warns when Vite allowedHosts omits the project domain", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });
    await writeFile(
      join(projectDir, "vite.config.js"),
      "export default { server: { allowedHosts: ['other.local'] } };\n",
      "utf8",
    );

    context.openUrl = async () => {};

    await expect(
      new ProjectService(context).openInBrowser(undefined, projectDir),
    ).resolves.toContain('server.allowedHosts does not include "my-app.local"');
  });

  it("does not warn when Vite allowedHosts includes the project domain", async () => {
    const context = await createContext();
    const projectDir = context.paths.appDir;
    await new RegistryService(context).initProjectConfig(projectDir, {
      name: "my-app",
      port: "8080",
    });
    await writeFile(
      join(projectDir, "vite.config.ts"),
      "export default { server: { allowedHosts: ['my-app.local'] } };\n",
      "utf8",
    );

    context.openUrl = async () => {};

    await expect(new ProjectService(context).openInBrowser(undefined, projectDir)).resolves.toBe(
      "Opened https://my-app.local/ in the default browser.",
    );
  });

  it("errors when no config exists", async () => {
    const context = await createContext();

    await expect(
      new ProjectService(context).openInBrowser(undefined, context.paths.appDir),
    ).rejects.toThrow("No project config found");
  });
});
