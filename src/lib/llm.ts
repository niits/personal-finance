import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateText, generateObject, NoObjectGeneratedError, type LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { Langfuse } from "langfuse";
import type { ZodType } from "zod";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

// Workers AI Llama 4 Scout hard limit — exceeding this causes error 3030
const MAX_OUTPUT_TOKENS = 131000;

function getLangfuse(): Langfuse | undefined {
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  if (!secretKey || !publicKey) return undefined;
  return new Langfuse({
    secretKey,
    publicKey,
    baseUrl: process.env.LANGFUSE_BASE_URL,
    // Flush immediately — Workers are short-lived and die after response
    flushAt: 1,
    flushInterval: 0,
  });
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
  const langfuse = getLangfuse();
  const cappedTokens = Math.min(opts.maxOutputTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);

  const trace = langfuse?.trace({
    name: opts.traceName ?? "runAIObject",
    userId: opts.userId,
    metadata: { version: process.env.APP_VERSION ?? "dev" },
  });
  const generation = trace?.generation({
    name: opts.traceName ?? "runAIObject",
    model: MODEL,
    input: opts.prompt,
    modelParameters: { maxOutputTokens: cappedTokens },
  });

  try {
    const { object } = await generateObject({
      model,
      schema: opts.schema,
      schemaName: opts.schemaName,
      schemaDescription: opts.schemaDescription,
      system: opts.system,
      prompt: opts.prompt,
      maxOutputTokens: cappedTokens,
    });
    generation?.end({ output: object });
    return object;
  } catch (structuredErr) {
    generation?.end({ level: "ERROR", statusMessage: String(structuredErr) });
    if (NoObjectGeneratedError.isInstance(structuredErr) && structuredErr.text != null) {
      throw new Error(
        `${structuredErr.message}\n\nRaw model response:\n${structuredErr.text}`,
      );
    }
    throw structuredErr;
  } finally {
    // Must flush before Worker process ends
    await langfuse?.shutdownAsync();
  }
}

export async function getWorkersAIModel(): Promise<LanguageModel> {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });
  return workersai(MODEL);
}

export { generateText };
