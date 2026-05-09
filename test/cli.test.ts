import { readFile, symlink } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildProgram, isCliEntrypoint } from "../src/cli.js";
import type { DevProxyContext } from "../src/core/types.js";
import { captureHelp } from "./helpers/test-helpers.js";

describe("cli help and version", () => {
  it("uses the package version for the CLI version flag", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    expect(buildProgram({} as DevProxyContext).version()).toBe(packageJson.version);
  });

  it("detects CLI entrypoint execution through direct and symlinked bin paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "devproxy-bin-"));
    const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    const binPath = join(dir, "devproxy");
    await symlink(cliPath, binPath);

    expect(isCliEntrypoint(cliPath, new URL("../src/cli.ts", import.meta.url).href)).toBe(true);
    expect(isCliEntrypoint(binPath, new URL("../src/cli.ts", import.meta.url).href)).toBe(true);
  });

  it("adds the branded banner to root help output only", () => {
    const program = buildProgram({} as DevProxyContext);
    const addCommand = program.commands.find((command) => command.name() === "add");
    const rootHelp = captureHelp(program);
    const addHelp = addCommand ? captureHelp(addCommand) : "";

    expect(rootHelp).toContain("██████╗ ███████╗██╗   ██╗");
    expect(rootHelp).toContain("Version ");
    expect(addHelp).not.toContain("██████╗ ███████╗██╗   ██╗");
    expect(addHelp).toContain("Version ");
  });
});
