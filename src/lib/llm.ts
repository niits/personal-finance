import { createWorkersAI } from "workers-ai-provider";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getModel() {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });
  return workersai(process.env.CF_AI_MODEL ?? "@cf/qwen/qwen1.5-14b-chat-awq");
}
