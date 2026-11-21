import { expect, type APIRequestContext } from "@playwright/test";
import { expireMcpAccessToken } from "../db-reset";
import { BASE_URL, obtainAccessToken, test } from "../mcp";

// The remote MCP endpoint, called exactly as Claude calls it: JSON-RPC over
// Streamable HTTP with the OAuth bearer token and no cookie.
type CategoryNode = { id: number; type: string; budget_behavior: string; system_kind: string | null; children: CategoryNode[] };

let nextId = 1;

async function rpc(client: APIRequestContext, token: string | null, method: string, params: Record<string, unknown> = {}) {
  return client.post("/api/mcp", {
    headers: {
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    data: { jsonrpc: "2.0", id: nextId++, method, params },
  });
}

async function callTool(client: APIRequestContext, token: string, name: string, args: Record<string, unknown> = {}) {
  const res = await rpc(client, token, "tools/call", { name, arguments: args });
  expect(res.ok(), await res.text()).toBe(true);
  const { result } = await res.json();
  return { isError: Boolean(result.isError), data: JSON.parse(result.content[0].text) };
}

function firstConsumptionLeaf(nodes: CategoryNode[]): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.children.length === 0 && node.type === "expense" && node.budget_behavior === "consumption" && !node.system_kind) return node;
    const found = firstConsumptionLeaf(node.children);
    if (found) return found;
  }
}

test.describe("MCP server", () => {
  test("rejects requests without a valid bearer token and points to the resource metadata", async ({ mcpClient, request }) => {
    const anonymous = await rpc(mcpClient, null, "tools/list");
    expect(anonymous.status()).toBe(401);
    expect(anonymous.headers()["www-authenticate"]).toBe(`Bearer resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource/api/mcp"`);

    // A browser session cookie alone must never authorize tool calls.
    const cookieOnly = await rpc(request, null, "tools/list");
    expect(cookieOnly.status()).toBe(401);

    expect((await rpc(mcpClient, "not-a-token", "tools/list")).status()).toBe(401);
  });

  test("initializes and lists the app's tools", async ({ page, mcpClient }) => {
    const token = await obtainAccessToken(page, mcpClient);

    const init = await rpc(mcpClient, token, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "e2e", version: "1.0.0" },
    });
    expect(init.ok(), await init.text()).toBe(true);
    const { result: initResult } = await init.json();
    expect(initResult.serverInfo.name).toBe("personal-finance");
    expect(initResult.instructions).toContain("VND");

    const list = await rpc(mcpClient, token, "tools/list");
    const tools: { name: string; annotations?: { destructiveHint?: boolean } }[] = (await list.json()).result.tools;
    const names = tools.map((tool) => tool.name);
    for (const name of ["get_dashboard", "list_transactions", "create_transaction", "delete_transaction", "apply_ai_organize"]) {
      expect(names).toContain(name);
    }
    expect(tools.find((tool) => tool.name === "delete_transaction")?.annotations?.destructiveHint).toBe(true);
  });

  test("creates, reads, and deletes a transaction through tools as the token's user", async ({ page, mcpClient }) => {
    const token = await obtainAccessToken(page, mcpClient);

    const { data: categoryData } = await callTool(mcpClient, token, "list_categories");
    const category = firstConsumptionLeaf(categoryData.categories);
    expect(category).toBeTruthy();

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    const created = await callTool(mcpClient, token, "create_transaction", {
      type: "expense", amount: 12345, date: today, category_id: category!.id, note: "Tạo bởi MCP E2E",
    });
    expect(created.isError).toBe(false);
    const id = created.data.transaction.id;

    const { data: listed } = await callTool(mcpClient, token, "list_transactions");
    expect(listed.transactions.some((t: { id: number; note: string }) => t.id === id && t.note === "Tạo bởi MCP E2E")).toBe(true);

    const deleted = await callTool(mcpClient, token, "delete_transaction", { id });
    expect(deleted.isError).toBe(false);
    const { data: afterDelete } = await callTool(mcpClient, token, "list_transactions");
    expect(afterDelete.transactions.some((t: { id: number }) => t.id === id)).toBe(false);
  });

  test("returns the app's validation error as a tool error", async ({ page, mcpClient }) => {
    const token = await obtainAccessToken(page, mcpClient);

    const result = await callTool(mcpClient, token, "create_transaction", {
      type: "expense", amount: 1000, date: "2999-01-01", category_id: 1,
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.data)).toContain("tương lai");
  });

  test("rejects an expired access token", async ({ page, mcpClient }) => {
    const token = await obtainAccessToken(page, mcpClient);
    expect((await rpc(mcpClient, token, "tools/list")).ok()).toBe(true);

    expireMcpAccessToken(token);

    expect((await rpc(mcpClient, token, "tools/list")).status()).toBe(401);
  });
});
