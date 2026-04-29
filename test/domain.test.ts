import { describe, expect, it } from "vitest";
import { domainFromName, parsePort } from "../src/core/domain.js";

describe("domain helpers", () => {
  it("derives .local domains from service names", () => {
    expect(domainFromName("api.myapp")).toBe("api.myapp.local");
  });

  it("normalizes names", () => {
    expect(domainFromName(" Web.MyApp ")).toBe("web.myapp.local");
  });

  it("requires project-style names", () => {
    expect(() => domainFromName("api")).toThrow("must include a project label");
  });

  it("parses valid ports", () => {
    expect(parsePort("5173")).toBe(5173);
  });

  it("rejects invalid ports", () => {
    expect(() => parsePort("70000")).toThrow("between 1 and 65535");
  });
});
