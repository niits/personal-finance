import { describe, expect, it } from "vitest";
import { privateJsonResponse } from "./private-revalidation";

describe("privateJsonResponse", () => {
  const url = "https://example.test/api/dashboard?month=2026-10";

  it("returns a private validator and omits the body when the response is unchanged", async () => {
    const initial = await privateJsonResponse(new Request(url), "user-1", { total_expense: 0 });
    const etag = initial.headers.get("ETag");
    expect(initial.status).toBe(200);
    expect(initial.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(etag).toBeTruthy();

    const conditional = await privateJsonResponse(
      new Request(url, { headers: { "If-None-Match": etag! } }),
      "user-1",
      { total_expense: 0 },
    );
    expect(conditional.status).toBe(304);
    expect(await conditional.text()).toBe("");
  });

  it("returns fresh data after a financial value changes", async () => {
    const initial = await privateJsonResponse(new Request(url), "user-1", { total_expense: 0 });
    const etag = initial.headers.get("ETag")!;
    const changed = await privateJsonResponse(
      new Request(url, { headers: { "If-None-Match": etag } }),
      "user-1",
      { total_expense: 120_000 },
    );
    expect(changed.status).toBe(200);
    expect(changed.headers.get("ETag")).not.toBe(etag);
    expect(await changed.json()).toEqual({ total_expense: 120_000 });
  });

  it("separates validators by user and query", async () => {
    const body = { total_expense: 0 };
    const original = await privateJsonResponse(new Request(url), "user-1", body);
    const otherUser = await privateJsonResponse(new Request(url), "user-2", body);
    const otherMonth = await privateJsonResponse(
      new Request("https://example.test/api/dashboard?month=2026-09"),
      "user-1",
      body,
    );
    expect(otherUser.headers.get("ETag")).not.toBe(original.headers.get("ETag"));
    expect(otherMonth.headers.get("ETag")).not.toBe(original.headers.get("ETag"));
  });
});
