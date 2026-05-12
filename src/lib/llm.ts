import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { ZodType } from "zod";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export async function runAIObject<T>(opts: {
  schema: ZodType<T>;
  system?: string;
  prompt: string;
}): Promise<T> {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });

  const { object } = await generateObject({
    model: workersai(MODEL),
    schema: opts.schema,
    system: opts.system,
    prompt: opts.prompt,
  });

  return object;
}
