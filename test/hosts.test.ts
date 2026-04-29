import { describe, expect, it } from "vitest";
import { updateHostsContent } from "../src/integrations/hosts.js";
import type { Service } from "../src/core/types.js";

const services = [
  {
    name: "api.myapp",
    domain: "api.myapp.local",
    port: 8000,
    mode: "attach",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  },
] satisfies Service[];

describe("updateHostsContent", () => {
  it("adds a DevProxy-owned hosts block", () => {
    const result = updateHostsContent("127.0.0.1 localhost\n", services);

    expect(result).toContain("127.0.0.1 localhost");
    expect(result).toContain("# BEGIN DEVPROXY");
    expect(result).toContain("127.0.0.1 api.myapp.local");
  });

  it("replaces the existing DevProxy block", () => {
    const result = updateHostsContent(
      "keep.me\n# BEGIN DEVPROXY\n127.0.0.1 old.local\n# END DEVPROXY\n",
      services,
    );

    expect(result).toContain("keep.me");
    expect(result).not.toContain("old.local");
    expect(result).toContain("api.myapp.local");
  });

  it("removes the DevProxy block when no services remain", () => {
    const result = updateHostsContent(
      "keep.me\n# BEGIN DEVPROXY\n127.0.0.1 old.local\n# END DEVPROXY\n",
      [],
    );

    expect(result).toBe("keep.me\n");
  });
});
