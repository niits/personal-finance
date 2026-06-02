import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { LangfuseExporter } from "langfuse-vercel";
import type { TelemetrySettings } from "ai";

// Langfuse credentials are injected as Worker secrets (see .dev.vars.example).
// They are not part of the generated Cloudflare.Env type, so we widen it here.
type LangfuseEnv = Cloudflare.Env & {
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
};

export type AITrace = {
  // Spread straight into the AI SDK call's `experimental_telemetry`.
  telemetry: TelemetrySettings;
  // Best-effort flush of pending spans to Langfuse. Never throws.
  flush: () => Promise<void>;
};

const DISABLED: AITrace = { telemetry: { isEnabled: false }, flush: async () => {} };

/**
 * Wire Langfuse tracing into a single Vercel AI SDK call.
 *
 * Cloudflare Workers notes:
 * - We deliberately avoid `NodeSDK` / OpenTelemetry resource auto-detection, whose
 *   Node detectors `import os` (the `node:os` dependency that previously broke the
 *   Worker). `BasicTracerProvider` + `SimpleSpanProcessor` only need `fetch`.
 * - The provider is created per-call (never module scope): no cross-request span
 *   bleed, and a clean flush/shutdown each time — matching the per-request rule
 *   used for auth and other bindings.
 * - All spans the AI SDK emits for this call carry the same `langfuseTraceId`, so
 *   they group into one Langfuse trace without an OTel context manager (which would
 *   need `node:async_hooks`).
 */
export function startAITrace(
  env: Cloudflare.Env,
  opts: {
    name: string;
    userId?: string;
    metadata?: Record<string, string | number | boolean>;
  },
): AITrace {
  const { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL } = env as LangfuseEnv;
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) return DISABLED;

  const exporter = new LangfuseExporter({
    publicKey: LANGFUSE_PUBLIC_KEY,
    secretKey: LANGFUSE_SECRET_KEY,
    baseUrl: LANGFUSE_BASE_URL,
  });
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  return {
    telemetry: {
      isEnabled: true,
      functionId: opts.name, // → Langfuse trace name (via the `resource.name` span attribute)
      metadata: {
        langfuseTraceId: crypto.randomUUID(),
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...opts.metadata,
      },
      tracer: provider.getTracer("ai"),
    },
    flush: async () => {
      try {
        await provider.forceFlush();
        await exporter.forceFlush(); // drains the Langfuse HTTP queue
        await provider.shutdown();
      } catch (err) {
        console.error("[langfuse] trace flush failed:", err);
      }
    },
  };
}
