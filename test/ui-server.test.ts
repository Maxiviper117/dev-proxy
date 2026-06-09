import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RegistryService } from "../src/commands/services.js";
import { startUiServer } from "../src/ui/server.js";
import { createContext } from "./helpers/test-helpers.js";

describe("ui server", () => {
  it("serves bootstrap data and API token auth", async () => {
    const context = await createContext();
    await new RegistryService(context).addService({ name: "api.myapp", port: "8000" });

    const staticDir = await mkdtemp(join(tmpdir(), "devproxy-ui-"));
    await writeFile(join(staticDir, "index.html"), "<html><body>ok</body></html>", "utf8");

    const server = await startUiServer({
      context,
      host: "127.0.0.1",
      port: 0,
      version: "0.25.0",
      staticDir,
    });

    try {
      const baseUrl = server.url.replace(/\/\?token=.*/, "");
      const unauthorized = await fetch(`${baseUrl}/api/bootstrap`);
      expect(unauthorized.status).toBe(401);

      const bootstrap = await fetch(`${baseUrl}/api/bootstrap?token=${server.token}`);
      const payload = (await bootstrap.json()) as { ok: boolean; data: { version: string } };
      expect(bootstrap.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.data.version).toBe("0.25.0");
    } finally {
      await server.close();
    }
  }, 15000);

  it("serves static assets and spa fallback", async () => {
    const context = await createContext();
    const staticDir = await mkdtemp(join(tmpdir(), "devproxy-ui-static-"));
    await mkdir(join(staticDir, "assets"), { recursive: true });
    await writeFile(join(staticDir, "index.html"), "<html>index</html>", "utf8");
    await writeFile(join(staticDir, "assets", "app.js"), "console.log('ok')", "utf8");

    const server = await startUiServer({
      context,
      host: "127.0.0.1",
      port: 0,
      version: "0.25.0",
      staticDir,
    });

    try {
      const baseUrl = server.url.replace(/\/\?token=.*/, "");
      const jsAsset = await fetch(`${baseUrl}/assets/app.js`);
      expect(jsAsset.status).toBe(200);
      expect(await jsAsset.text()).toContain("console.log");

      const fallback = await fetch(`${baseUrl}/some/route`);
      expect(fallback.status).toBe(200);
      expect(await fallback.text()).toContain("index");
    } finally {
      await server.close();
    }
  });
});
