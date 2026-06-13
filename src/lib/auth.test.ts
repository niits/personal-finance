import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// auth.ts dynamically imports these inside getAuth(); mock both so the test runs
// in plain node without a Workers runtime or a real better-auth instance.
const getCloudflareContext = vi.fn();
const betterAuth = vi.fn((config: unknown) => ({ config }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));
vi.mock("better-auth", () => ({ betterAuth }));

const fakeEnv = {
  DB: { __binding: "d1" },
  GITHUB_CLIENT_ID: "gh-id",
  GITHUB_CLIENT_SECRET: "gh-secret",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "https://example.test",
};

describe("getAuth", () => {
  beforeEach(() => {
    getCloudflareContext.mockReset().mockResolvedValue({ env: fakeEnv });
    betterAuth.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Regression: the instance must NOT be cached in module scope. A warm Cloudflare
  // isolate reuses the module across requests; a cached instance would close over
  // the first request's D1 binding, whose proxy can no longer resolve the request
  // state on later requests ("No request state found ... runWithRequestState").
  it("rebuilds the auth instance on every call (no module-scope cache)", async () => {
    const { getAuth } = await import("./auth");

    await getAuth();
    await getAuth();

    // Each call must re-enter the request context and reconstruct the instance.
    expect(getCloudflareContext).toHaveBeenCalledTimes(2);
    expect(betterAuth).toHaveBeenCalledTimes(2);
  });

  it("wires the request-scoped D1 binding into the auth config", async () => {
    const { getAuth } = await import("./auth");

    await getAuth();

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({ database: fakeEnv.DB, secret: fakeEnv.BETTER_AUTH_SECRET }),
    );
  });
});
