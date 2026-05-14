import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateText, Output, NoObjectGeneratedError, type LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { LangfuseExporter } from "langfuse-vercel";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import type { ZodType } from "zod";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

// Workers AI Llama 4 Scout hard limit — exceeding this causes error 3030
const MAX_OUTPUT_TOKENS = 131000;

function buildTracer(exporter: LangfuseExporter) {
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  return provider.getTracer("langfuse");
}

function getLangfuseExporter(): LangfuseExporter | undefined {
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL;
  if (!secretKey || !publicKey) return undefined;
  return new LangfuseExporter({ secretKey, publicKey, baseUrl });
}

export async function runAIObject<T>(opts: {
  schema: ZodType<T>;
  system?: string;
  prompt: string;
  maxOutputTokens?: number;
  traceName?: string;
  userId?: string;
}): Promise<T> {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });
  const model = workersai(MODEL);
  const exporter = getLangfuseExporter();

  // Cap at model hard limit — callers must not exceed this
  const cappedTokens = Math.min(opts.maxOutputTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);

  try {
    const { output: result } = await generateText({
      model,
      output: Output.object({ schema: opts.schema }),
      system: opts.system,
      prompt: opts.prompt,
      maxOutputTokens: cappedTokens,
      experimental_telemetry: exporter
        ? {
            isEnabled: true,
            functionId: opts.traceName ?? "runAIObject",
            tracer: buildTracer(exporter),
            metadata: {
              ...(opts.userId ? { userId: opts.userId } : {}),
              version: process.env.APP_VERSION ?? "dev",
            },
          }
        : undefined,
    });
    return result as T;
  } catch (structuredErr) {
    // NoObjectGeneratedError already carries the raw text the model returned.
    // Surface it so the caller (and logs) can see what the model actually sent.
    if (NoObjectGeneratedError.isInstance(structuredErr) && structuredErr.text != null) {
      throw new Error(
        `${structuredErr.message}\n\nRaw model response:\n${structuredErr.text}`,
      );
    }
    throw structuredErr;
  } finally {
    // Flush pending spans before the edge runtime suspends
    await exporter?.forceFlush();
  }
}

export async function getWorkersAIModel(): Promise<LanguageModel> {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });
  return workersai(MODEL);
}

export { generateText };
