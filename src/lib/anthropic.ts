import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

    const accountId = process.env.CF_ACCOUNT_ID;
    const gatewayId = process.env.CF_GATEWAY_ID;

    const options: ConstructorParameters<typeof Anthropic>[0] = { apiKey };

    if (accountId && gatewayId) {
      options.baseURL = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/anthropic`;
      const aigToken = process.env.CF_AIG_TOKEN;
      if (aigToken) {
        options.defaultHeaders = { "cf-aig-authorization": `Bearer ${aigToken}` };
      }
    }

    client = new Anthropic(options);
  }
  return client;
}
