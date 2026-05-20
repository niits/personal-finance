import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateText, generateObject, NoObjectGeneratedError, type LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ZodType } from "zod";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

// Workers AI Llama 4 Scout hard limit — exceeding this causes error 3030
const MAX_OUTPUT_TOKENS = 131000;

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
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env).AI });
  return workersai(MODEL);
}

// gpt-4o-mini via Cloudflare AI Gateway /compat endpoint using openai-compatible provider
// (avoids @ai-sdk/openai v3 Responses API which compat endpoint doesn't support)
export async function getOpenAIModel(): Promise<LanguageModel> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as Cloudflare.Env;
  const provider = createOpenAICompatible({
    name: "cloudflare-aig",
    apiKey: cfEnv.CF_AIG_TOKEN,
    baseURL: `https://gateway.ai.cloudflare.com/v1/${cfEnv.CLOUDFLARE_ACCOUNT_ID}/default/compat`,
  });
  return provider("openai/gpt-4o-mini");
}

export { generateText };
