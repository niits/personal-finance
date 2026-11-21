import { describe, it, expect, vi } from "vitest";
import { buildRouteRequest, invokeRoute, toToolResult, type RouteCall } from "./invoke";

const ORIGIN = "https://finance.example.test";
const AUTH = "Bearer token-1";
const handler = vi.fn(async () => Response.json({ ok: true }));

describe("buildRouteRequest", () => {
  it("fills path params and sends the remaining args as a JSON body", async () => {
    const call: RouteCall = { method: "PATCH", path: "/api/transactions/:id", handler };
    const { request, params } = buildRouteRequest(call, { id: 42, amount: 50000, note: null }, ORIGIN, AUTH);

    expect(request.url).toBe(`${ORIGIN}/api/transactions/42`);
    expect(params).toEqual({ id: "42" });
    expect(await request.json()).toEqual({ amount: 50000, note: null });
    expect(request.headers.get("authorization")).toBe(AUTH);
  });

  it("sends GET args as query parameters and skips undefined values", () => {
    const call: RouteCall = { method: "GET", path: "/api/transactions", handler };
    const { request } = buildRouteRequest(call, { month: "2026-11", type: undefined, category_id: 7 }, ORIGIN, AUTH);

    expect(request.url).toBe(`${ORIGIN}/api/transactions?month=2026-11&category_id=7`);
    expect(request.body).toBeNull();
  });

  it("moves declared query args out of a POST body", async () => {
    const call: RouteCall = { method: "POST", path: "/api/statistics", handler, query: ["period_key"] };
    const { request } = buildRouteRequest(call, { period_key: "2026-10" }, ORIGIN, AUTH);

    expect(new URL(request.url).searchParams.get("period_key")).toBe("2026-10");
    expect(await request.json()).toEqual({});
  });

  it("encodes path params so they cannot change the route", () => {
    const call: RouteCall = { method: "DELETE", path: "/api/finance-accounts/:id", handler };
    const { request } = buildRouteRequest(call, { id: "../categories/1" }, ORIGIN, AUTH);

    expect(new URL(request.url).pathname).toBe("/api/finance-accounts/..%2Fcategories%2F1");
  });
});

describe("toToolResult", () => {
  it("returns JSON bodies as text and flags HTTP errors", async () => {
    const ok = await toToolResult(Response.json({ id: 1 }, { status: 201 }));
    const failed = await toToolResult(Response.json({ error: "Không tìm thấy" }, { status: 404 }));

    expect(ok).toEqual({ content: [{ type: "text", text: '{"id":1}' }], isError: false });
    expect(failed.isError).toBe(true);
    expect(failed.content[0]).toEqual({ type: "text", text: '{"error":"Không tìm thấy"}' });
  });

  it("reports an empty success response", async () => {
    const result = await toToolResult(new Response(null, { status: 204 }));

    expect(result).toEqual({ content: [{ type: "text", text: '{"ok":true,"status":204}' }], isError: false });
  });

  it("keeps only the final report from a server-sent event stream", async () => {
    const stream = 'data: {"type":"step","label":"a"}\n\ndata: {"type":"report","report":{"found":true}}\n\n';
    const result = await toToolResult(new Response(stream, { headers: { "content-type": "text/event-stream" } }));

    expect(result).toEqual({ content: [{ type: "text", text: '{"found":true}' }], isError: false });
  });

  it("flags a stream that ends with an error event", async () => {
    const stream = 'data: {"type":"step"}\n\ndata: {"type":"error","message":"Lỗi"}\n\n';
    const result = await toToolResult(new Response(stream, { headers: { "content-type": "text/event-stream" } }));

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: "text", text: '{"type":"error","message":"Lỗi"}' });
  });
});

describe("invokeRoute", () => {
  it("passes path params to the handler as a promise", async () => {
    const routeHandler = vi.fn(async (_req: Request, ctx: { params: Promise<Record<string, string>> }) => Response.json(await ctx.params));

    const result = await invokeRoute({ method: "DELETE", path: "/api/categories/:id", handler: routeHandler }, { id: 9 }, ORIGIN, AUTH);

    expect(result.content[0]).toEqual({ type: "text", text: '{"id":"9"}' });
  });
});
