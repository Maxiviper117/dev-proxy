import { describe, expect, it } from "vitest";
import type { DevProxyContext } from "../src/core/types.js";
import { buildProgram } from "../src/cli.js";
import { captureHelp } from "./helpers/test-helpers.js";

describe("ui command", () => {
  it("registers ui command with expected options in help", () => {
    const program = buildProgram({} as DevProxyContext);
    const uiCommand = program.commands.find((command) => command.name() === "ui");
    const help = uiCommand ? captureHelp(uiCommand) : "";

    expect(help).toContain("Launch the local DevProxy dashboard.");
    expect(help).toContain("--host <host>");
    expect(help).toContain("--port <port>");
    expect(help).toContain("--no-open");
  });
});
