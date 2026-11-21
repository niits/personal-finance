import { describe, it, expect, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: vi.fn() }));

const { MCP_TOOLS } = await import("./tools");

describe("MCP tool registry", () => {
  it("has unique snake_case names", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z_]+$/);
  });

  it.each(MCP_TOOLS.map((tool) => [tool.name, tool] as const))("%s points at a real handler and declares its path params", (_, tool) => {
    expect(typeof tool.route.handler).toBe("function");
    for (const [, param] of tool.route.path.matchAll(/:([a-zA-Z_]+)/g)) {
      expect(Object.keys(tool.input.shape)).toContain(param);
    }
  });

  it("marks every GET tool read-only and every DELETE tool destructive", () => {
    for (const tool of MCP_TOOLS) {
      if (tool.route.method === "GET") expect(tool.annotations.readOnlyHint).toBe(true);
      if (tool.route.method === "DELETE") expect(tool.annotations.destructiveHint).toBe(true);
    }
  });
});
