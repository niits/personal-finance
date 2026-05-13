import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateText, Output, NoObjectGeneratedError, type LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { ZodType } from "zod";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export async function runAIObject<T>(opts: {
  schema: ZodType<T>;
  system?: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<T> {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });
  const model = workersai(MODEL);

  try {
    const { output: result } = await generateText({
      model,
      output: Output.object({ schema: opts.schema }),
      system: opts.system,
      prompt: opts.prompt,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
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
  }
}

export async function getWorkersAIModel(): Promise<LanguageModel> {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });
  return workersai(MODEL);
}

export { generateText };
