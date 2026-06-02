import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { startAITrace } from "@/lib/telemetry";

// This test exercises the full Langfuse tracing stack INSIDE the Cloudflare
// Workers runtime (vitest-pool-workers / workerd). Its real purpose is to prove
// the stack loads and runs in the Worker — i.e. that constructing
// BasicTracerProvider + LangfuseExporter and flushing does NOT pull in an
// unsupported `node:os` (the dependency that previously broke the Worker).
//
// We drive the real Vercel AI SDK against a mock model so no OpenAI call is made,
// and stub `fetch` so no real Langfuse network call leaves the test.

const LANGFUSE_ENV = {
  LANGFUSE_PUBLIC_KEY: "pk-lf-test",
  LANGFUSE_SECRET_KEY: "sk-lf-test",
  LANGFUSE_BASE_URL: "https://cloud.langfuse.test",
} as unknown as Cloudflare.Env;

function mockModel() {
  return new MockLanguageModelV3({
    modelId: "mock-model",
    doGenerate: async () => ({
      content: [{ type: "text", text: "ok" }],
      finishReason: "stop",
      usage: {
        inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 3, text: 3, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

describe("Langfuse tracing in the Workers runtime", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Fresh Response per call — Langfuse's retry logic may read the body twice.
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ successes: [], errors: [] }), {
          status: 207,
          headers: { "content-type": "application/json" },
        }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("loads the OTel + Langfuse stack and ships an ingestion request", async () => {
    const trace = startAITrace(LANGFUSE_ENV, { name: "test-trace", userId: "user-1" });
    expect(trace.telemetry.isEnabled).toBe(true);

    // Real AI SDK call against a mock model — emits genuine `ai.*` telemetry spans.
    const { text } = await generateText({
      model: mockModel(),
      prompt: "hi",
      experimental_telemetry: trace.telemetry,
    });
    expect(text).toBe("ok");

    await trace.flush();

    const ingestionCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/public/ingestion"),
    );
    expect(ingestionCalls.length).toBeGreaterThan(0);
  });

  it("is a no-op when Langfuse keys are absent", async () => {
    const trace = startAITrace({} as Cloudflare.Env, { name: "disabled" });
    expect(trace.telemetry).toEqual({ isEnabled: false });

    await trace.flush(); // must never throw
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
