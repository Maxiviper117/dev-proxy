import { describe, expect, it } from "vitest";
import { browserOpenCommand } from "../src/platform/browser.js";
import { createWindowsElevationInvoker } from "../src/platform/elevation.js";
import { sudoOwnerFromEnv } from "../src/platform/ownership.js";
import { defaultPaths } from "../src/platform/paths.js";

describe("defaultPaths", () => {
  it("resolves Windows runtime paths", () => {
    const paths = defaultPaths(
      {
        APPDATA: "C:\\Users\\dev\\AppData\\Roaming",
        SystemRoot: "C:\\Windows",
      },
      "win32",
    );

    expect(paths.appDir).toBe("C:\\Users\\dev\\AppData\\Roaming\\devproxy");
    expect(paths.hostsFile).toBe("C:\\Windows\\System32\\drivers\\etc\\hosts");
    expect(paths.caddyRootCAPath).toBe(
      "C:\\Users\\dev\\AppData\\Roaming\\Caddy\\pki\\authorities\\local\\root.crt",
    );
  });

  it("resolves macOS runtime paths", () => {
    const paths = defaultPaths({ HOME: "/Users/dev" }, "darwin");

    expect(paths.appDir).toBe("/Users/dev/Library/Application Support/devproxy");
    expect(paths.hostsFile).toBe("/etc/hosts");
    expect(paths.caddyRootCAPath).toBe(
      "/Users/dev/Library/Application Support/Caddy/pki/authorities/local/root.crt",
    );
  });

  it("resolves Linux runtime paths with XDG_DATA_HOME", () => {
    const paths = defaultPaths({ HOME: "/home/dev", XDG_DATA_HOME: "/tmp/data" }, "linux");

    expect(paths.appDir).toBe("/tmp/data/devproxy");
    expect(paths.hostsFile).toBe("/etc/hosts");
    expect(paths.caddyRootCAPath).toBe("/tmp/data/caddy/pki/authorities/local/root.crt");
  });

  it("rejects unsupported platforms", () => {
    expect(() => defaultPaths({}, "freebsd")).toThrow(
      "DevProxy supports Windows, macOS, and Linux",
    );
  });
});

describe("browserOpenCommand", () => {
  it("uses the platform default opener", () => {
    expect(browserOpenCommand("https://app.local/", "win32")).toEqual({
      command: "cmd",
      args: ["/c", "start", "", "https://app.local/"],
    });
    expect(browserOpenCommand("https://app.local/", "darwin")).toEqual({
      command: "open",
      args: ["https://app.local/"],
    });
    expect(browserOpenCommand("https://app.local/", "linux")).toEqual({
      command: "xdg-open",
      args: ["https://app.local/"],
    });
  });
});

describe("sudoOwnerFromEnv", () => {
  it("returns the original sudo user ids when present", () => {
    expect(sudoOwnerFromEnv({ SUDO_UID: "501", SUDO_GID: "20" })).toEqual({
      uid: 501,
      gid: 20,
    });
  });

  it("ignores missing or invalid sudo ids", () => {
    expect(sudoOwnerFromEnv({})).toBeUndefined();
    expect(sudoOwnerFromEnv({ SUDO_UID: "abc", SUDO_GID: "20" })).toBeUndefined();
  });
});

describe("createWindowsElevationInvoker", () => {
  it("builds a PowerShell Start-Process RunAs invocation", async () => {
    let encodedCommand = "";
    const launch = async (command: string, args: readonly string[]) => {
      expect(command).toBe("powershell.exe");
      expect(args).toContain("-EncodedCommand");
      encodedCommand = args[args.length - 1] ?? "";
      const script = Buffer.from(encodedCommand, "base64").toString("utf16le");
      const match = script.match(/\$resultPath = '([^']+)'/);
      const resultPath = match?.[1];
      expect(resultPath).toBeDefined();
      if (resultPath) {
        await import("node:fs/promises").then(({ writeFile }) =>
          writeFile(resultPath, JSON.stringify({ code: 0, stdout: "ok", stderr: "" }), "utf8"),
        );
      }
      return { code: 0, stdout: "", stderr: "" };
    };

    const elevate = createWindowsElevationInvoker(
      "win32",
      async () => ({ code: 0, stdout: "", stderr: "" }),
      "C:\\Program Files\\nodejs\\node.exe",
      "D:\\devproxy\\dist\\cli.js",
      launch,
    );

    expect(elevate).toBeDefined();
    const result = await elevate!({
      kind: "hosts-sync",
      registryFile: "C:\\temp\\registry.json",
      hostsFile: "C:\\Windows\\System32\\drivers\\etc\\hosts",
    });

    expect(result.code).toBe(0);
    expect(encodedCommand).not.toBe("");
    const script = Buffer.from(encodedCommand, "base64").toString("utf16le");
    expect(script).toContain("Start-Process");
    expect(script).toContain("-Verb RunAs");
    expect(script).toContain("-Wait -PassThru");
    expect(script).toContain("-ArgumentList");
  });
});
