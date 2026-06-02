import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateText, generateObject, NoObjectGeneratedError, type LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ZodType } from "zod";
import { startAITrace } from "@/lib/telemetry";

function createAIGatewayProvider(cfEnv: Cloudflare.Env) {
  return createOpenAICompatible({
    name: "cloudflare-aig",
    apiKey: (cfEnv as Cloudflare.Env & { CF_AIG_TOKEN: string }).CF_AIG_TOKEN,
    baseURL: `https://gateway.ai.cloudflare.com/v1/${(cfEnv as Cloudflare.Env & { CLOUDFLARE_ACCOUNT_ID: string }).CLOUDFLARE_ACCOUNT_ID}/default/compat`,
  });
}

// gpt-4.1-nano: cheapest OpenAI model, reliable structured output, used for
// short-context tasks (fill-emoji, suggest categories, recategorize)
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
  const model = createAIGatewayProvider(env as Cloudflare.Env)("openai/gpt-4.1-nano");
  const trace = startAITrace(env as Cloudflare.Env, {
    name: opts.traceName ?? "ai-object",
    userId: opts.userId,
  });

  try {
    const { object } = await generateObject({
      model,
      schema: opts.schema,
      schemaName: opts.schemaName,
      schemaDescription: opts.schemaDescription,
      system: opts.system,
      prompt: opts.prompt,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      experimental_telemetry: trace.telemetry,
    });
    return object;
  } catch (structuredErr) {
    if (NoObjectGeneratedError.isInstance(structuredErr) && structuredErr.text != null) {
      throw new Error(
        `${structuredErr.message}\n\nRaw model response:\n${structuredErr.text}`,
      );
    }
    throw structuredErr;
  } finally {
    await trace.flush();
  }
}

// gpt-4o via Cloudflare AI Gateway — used for statistics agent (long context, streaming)
export async function getOpenAIModel(): Promise<LanguageModel> {
  const { env } = await getCloudflareContext({ async: true });
  return createAIGatewayProvider(env as Cloudflare.Env)("openai/gpt-4o");
}

export { generateText };
