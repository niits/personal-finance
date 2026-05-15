import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateText, generateObject, NoObjectGeneratedError, type LanguageModel, type TelemetryIntegration } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { Langfuse } from "langfuse";
import type { ZodType } from "zod";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

// Workers AI Llama 4 Scout hard limit — exceeding this causes error 3030
const MAX_OUTPUT_TOKENS = 131000;

function makeLangfuseIntegration(traceName: string, userId?: string): TelemetryIntegration {
  const lf = new Langfuse();
  const trace = lf.trace({ name: traceName, userId });
  let generation: ReturnType<typeof trace.generation> | null = null;

  return {
    onStart({ model, system, prompt }) {
      generation = trace.generation({
        name: traceName,
        model: model.modelId,
        input: { system, prompt },
      });
    },
    onFinish({ text, usage, finishReason }) {
      generation?.update({
        output: text,
        usage: usage ? { input: usage.inputTokens, output: usage.outputTokens } : undefined,
        metadata: { finishReason },
      });
      generation?.end();
      lf.flushAsync().catch(() => null);
    },
  };
}

export async function runAIObject<T>(opts: {
  schema: ZodType<T>;
  schemaName?: string;
  schemaDescription?: string;
  system?: string;
  prompt: string;
  maxOutputTokens?: number;
  traceName?: string;
  userId?: string;
}): Promise<T> {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });
  const model = workersai(MODEL);

  const cappedTokens = Math.min(opts.maxOutputTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);
  const telemetry = opts.traceName
    ? { isEnabled: true, integrations: makeLangfuseIntegration(opts.traceName, opts.userId) }
    : undefined;

  try {
    const { object } = await generateObject({
      model,
      schema: opts.schema,
      schemaName: opts.schemaName,
      schemaDescription: opts.schemaDescription,
      system: opts.system,
      prompt: opts.prompt,
      maxOutputTokens: cappedTokens,
      experimental_telemetry: telemetry,
    });
    return object;
  } catch (structuredErr) {
    if (NoObjectGeneratedError.isInstance(structuredErr) && structuredErr.text != null) {
      throw new Error(
        `${structuredErr.message}\n\nRaw model response:\n${structuredErr.text}`,
      );
    }
    throw structuredErr;
  }
}

export async function getWorkersAIModel(): Promise<LanguageModel> {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });
  return workersai(MODEL);
}

export { generateText };
