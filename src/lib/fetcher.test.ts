import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetcher, AuthError } from "./fetcher";

function mockFetch(status: number, body: unknown = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("fetcher", () => {
  let dispatchedEvents: string[];

  beforeEach(() => {
    dispatchedEvents = [];
    global.window = {
      dispatchEvent: (e: Event) => { dispatchedEvents.push(e.type); return true; },
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on 200", async () => {
    mockFetch(200, { value: 42 });
    const result = await fetcher<{ value: number }>("/api/test");
    expect(result).toEqual({ value: 42 });
  });

  it("throws AuthError on 401", async () => {
    mockFetch(401);
    await expect(fetcher("/api/test")).rejects.toBeInstanceOf(AuthError);
  });

  it("dispatches auth:expired event on 401", async () => {
    mockFetch(401);
    await fetcher("/api/test").catch(() => {});
    expect(dispatchedEvents).toContain("auth:expired");
  });

  it("does not dispatch auth:expired on other errors", async () => {
    mockFetch(500);
    await fetcher("/api/test").catch(() => {});
    expect(dispatchedEvents).not.toContain("auth:expired");
  });

  it("throws generic Error on 500", async () => {
    mockFetch(500);
    await expect(fetcher("/api/test")).rejects.toThrow("500");
  });

  it("throws generic Error on 404", async () => {
    mockFetch(404);
    await expect(fetcher("/api/test")).rejects.toThrow("404");
  });

  it("AuthError has status 401", async () => {
    mockFetch(401);
    let err: unknown;
    await fetcher("/api/test").catch((e) => { err = e; });
    expect((err as AuthError).status).toBe(401);
  });
});
