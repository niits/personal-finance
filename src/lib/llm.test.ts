import { describe, it, expect, vi, beforeEach } from "vitest";

const getCloudflareContext = vi.fn();
const generateObject = vi.fn();
const generateText = vi.fn();
const createGateway = vi.fn();
const startAITrace = vi.fn();

class FakeNoObjectGeneratedError extends Error {
  text?: string;
  constructor(message: string, text?: string) {
    super(message);
    this.text = text;
  }
  static isInstance(err: unknown): err is FakeNoObjectGeneratedError {
    return err instanceof FakeNoObjectGeneratedError;
  }
}

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));
vi.mock("ai", () => ({
  generateObject,
  generateText,
  createGateway,
  NoObjectGeneratedError: FakeNoObjectGeneratedError,
}));
vi.mock("@/lib/telemetry", () => ({ startAITrace }));

const fakeEnv = { AI_GATEWAY_API_KEY: "vck_test-key" };

describe("llm", () => {
  const gatewayModel = vi.fn((modelId: string) => ({ modelId }));
  const waitUntil = vi.fn();

  beforeEach(() => {
    getCloudflareContext.mockReset().mockResolvedValue({ env: fakeEnv, ctx: { waitUntil } });
    createGateway.mockReset().mockReturnValue(gatewayModel);
    gatewayModel.mockClear();
    generateObject.mockReset();
    startAITrace.mockReset().mockReturnValue({ telemetry: { isEnabled: false }, flush: vi.fn() });
    waitUntil.mockReset();
  });

  it("builds the Vercel AI Gateway provider with the configured API key", async () => {
    const { getOpenAIModel } = await import("./llm");

    await getOpenAIModel();

    expect(createGateway).toHaveBeenCalledWith({ apiKey: fakeEnv.AI_GATEWAY_API_KEY });
    expect(gatewayModel).toHaveBeenCalledWith("openai/gpt-4o");
  });

  it("runAIObject requests the cheap model and returns the generated object", async () => {
    const { runAIObject } = await import("./llm");
    const object = { foo: "bar" };
    generateObject.mockResolvedValue({ object });

    const result = await runAIObject({ schema: {} as never, prompt: "hi" });

    expect(result).toBe(object);
    expect(gatewayModel).toHaveBeenCalledWith("openai/gpt-4.1-nano");
  });

  it("wraps NoObjectGeneratedError with the raw model response", async () => {
    const { runAIObject } = await import("./llm");
    generateObject.mockRejectedValue(new FakeNoObjectGeneratedError("bad output", "raw text"));

    await expect(runAIObject({ schema: {} as never, prompt: "hi" })).rejects.toThrow(
      "raw text",
    );
  });

  it("flushes the trace via ctx.waitUntil", async () => {
    const { runAIObject } = await import("./llm");
    const flush = vi.fn().mockResolvedValue(undefined);
    startAITrace.mockReturnValue({ telemetry: { isEnabled: false }, flush });
    generateObject.mockResolvedValue({ object: {} });

    await runAIObject({ schema: {} as never, prompt: "hi" });

    expect(flush).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
});
