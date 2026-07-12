import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
const getAuth = vi.fn(async () => ({ api: { getSession } }));

vi.mock("./auth", () => ({ getAuth }));

// Upstream better-auth bug (better-auth/better-auth#6613): a lazy-init race in its
// AsyncLocalStorage request-state singleton can make a *valid* session request fail
// with a generic FAILED_TO_GET_SESSION error on Cloudflare Workers. requireSession
// retries once to ride out the race instead of surfacing a false "logged out" state.
describe("requireSession", () => {
  beforeEach(() => {
    getSession.mockReset();
    getAuth.mockClear();
  });

  it("returns the session on the first successful call", async () => {
    const { requireSession } = await import("./session");
    const session = { user: { id: "u1" } };
    getSession.mockResolvedValueOnce(session);

    const result = await requireSession(new Request("https://example.test"));

    expect(result).toBe(session);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("retries once and succeeds when the request-state race error is thrown", async () => {
    const { requireSession } = await import("./session");
    const session = { user: { id: "u1" } };
    const raceError = Object.assign(new Error("Failed to get session"), {
      body: { code: "FAILED_TO_GET_SESSION" },
    });
    getSession.mockRejectedValueOnce(raceError).mockResolvedValueOnce(session);

    const result = await requireSession(new Request("https://example.test"));

    expect(result).toBe(session);
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it("rethrows unrelated errors without retrying", async () => {
    const { requireSession } = await import("./session");
    const otherError = Object.assign(new Error("Something else"), {
      body: { code: "SOME_OTHER_CODE" },
    });
    getSession.mockRejectedValueOnce(otherError);

    await expect(requireSession(new Request("https://example.test"))).rejects.toThrow(
      "Something else",
    );
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("rethrows if the retry also fails", async () => {
    const { requireSession } = await import("./session");
    const raceError = Object.assign(new Error("Failed to get session"), {
      body: { code: "FAILED_TO_GET_SESSION" },
    });
    getSession.mockRejectedValue(raceError);

    await expect(requireSession(new Request("https://example.test"))).rejects.toThrow(
      "Failed to get session",
    );
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
