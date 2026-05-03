import { describe, expect, it } from "vitest";
import { browserOpenCommand } from "../src/platform/browser.js";
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
