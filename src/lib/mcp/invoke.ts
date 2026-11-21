import { NextRequest } from "next/server";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RouteContext = { params: Promise<Record<string, string>> };
export type RouteHandler = (request: NextRequest, context: RouteContext) => Response | Promise<Response>;

export type RouteCall = {
  method: HttpMethod;
  /** Path template such as `/api/transactions/:id`; `:name` segments are filled from args. */
  path: string;
  handler: RouteHandler;
  /** Arg names sent as query parameters on a non-GET request (GET sends every non-path arg as query). */
  query?: string[];
};

/**
 * Splits tool arguments into path params, query string, and JSON body following
 * the route's HTTP conventions, so each MCP tool calls exactly one existing route.
 */
export function buildRouteRequest(call: RouteCall, args: Record<string, unknown>, origin: string, authorization: string) {
  const params: Record<string, string> = {};
  const rest: Record<string, unknown> = { ...args };
  const pathname = call.path.replace(/:([a-zA-Z_]+)/g, (_, name: string) => {
    params[name] = String(rest[name]);
    delete rest[name];
    return encodeURIComponent(params[name]);
  });

  const url = new URL(pathname, origin);
  const queryNames = call.method === "GET" ? Object.keys(rest) : call.query ?? [];
  for (const name of queryNames) {
    if (rest[name] !== undefined && rest[name] !== null) url.searchParams.set(name, String(rest[name]));
    delete rest[name];
  }

  const hasBody = call.method !== "GET" && call.method !== "DELETE";
  const request = new NextRequest(url, {
    method: call.method,
    headers: { authorization, ...(hasBody ? { "content-type": "application/json" } : {}) },
    body: hasBody ? JSON.stringify(rest) : undefined,
  });
  return { request, params };
}

/** Reads a server-sent event stream and keeps only the final report or error event. */
function finalStreamEvent(text: string): { event: unknown; isError: boolean } {
  const events = text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)) as { type?: string });
  const last = events.findLast((event) => event.type === "report" || event.type === "error");
  if (!last) return { event: { type: "error", message: "Stream ended without a result." }, isError: true };
  return { event: last.type === "report" ? (last as { report: unknown }).report : last, isError: last.type === "error" };
}

export async function toToolResult(response: Response): Promise<CallToolResult> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (contentType.includes("text/event-stream")) {
    const { event, isError } = finalStreamEvent(text);
    return { content: [{ type: "text", text: JSON.stringify(event) }], isError };
  }
  const isError = !response.ok;
  if (response.status === 204 || text === "") {
    return { content: [{ type: "text", text: JSON.stringify({ ok: !isError, status: response.status }) }], isError };
  }
  return { content: [{ type: "text", text }], isError };
}

export async function invokeRoute(call: RouteCall, args: Record<string, unknown>, origin: string, authorization: string) {
  const { request, params } = buildRouteRequest(call, args, origin, authorization);
  const response = await call.handler(request, { params: Promise.resolve(params) });
  return toToolResult(response);
}
