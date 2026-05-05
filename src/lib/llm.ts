import { ChatCloudflareWorkersAI } from "@langchain/cloudflare";

let instance: ChatCloudflareWorkersAI | null = null;

export function getLLM(): ChatCloudflareWorkersAI {
  if (!instance) {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken = process.env.CF_AI_API_TOKEN;
    if (!accountId) throw new Error("CF_ACCOUNT_ID is not set");
    if (!apiToken) throw new Error("CF_AI_API_TOKEN is not set");

    const gatewayId = process.env.CF_GATEWAY_ID;
    const baseUrl = gatewayId
      ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/workers-ai/`
      : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/`;

    instance = new ChatCloudflareWorkersAI({
      model: process.env.CF_AI_MODEL ?? "@cf/qwen/qwen1.5-14b-chat-awq",
      cloudflareAccountId: accountId,
      cloudflareApiToken: apiToken,
      baseUrl,
    });
  }
  return instance;
}
