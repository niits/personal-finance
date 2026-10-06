import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createGateway, generateText, Output } from "ai";
import { buildStatisticsSnapshot, narrativeSchema, hydrateStatisticsInsights, STATISTICS_SYSTEM } from "../src/lib/statistics-report.ts";

const args = process.argv.slice(2);
const outputDir = args[0] ?? "/tmp/personal-finance-statistics-evaluation";
const localVars = await readFile(new URL("../.dev.vars", import.meta.url), "utf8").catch(() => "");
const key = process.env.AI_GATEWAY_API_KEY ?? localVars.match(/^AI_GATEWAY_API_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
if (!key) throw new Error("AI_GATEWAY_API_KEY is required to run the live evaluation.");
const gateway = createGateway({ apiKey: key });
const models = ["openai/gpt-5.6-terra", "openai/gpt-6.1-sol"];
const modelCatalog = await fetch("https://ai-gateway.vercel.sh/v1/models").then(r => r.json());
const period = { key: "2026-05", start: "2026-04-30", end: "2026-05-28", through: "2026-05-14" };
const previousPeriod = { key: "2026-04", start: "2026-03-31", end: "2026-04-29", through: "2026-04-14" };
const txn = (amount, date, category_path, card_group = null, is_unpaid = false, budget_behavior = "consumption", type = "expense", note = null) => ({ amount, date, category_path, card_group, is_unpaid, budget_behavior, type, note });
const cases = [
  { name: "card-heavy", budget: 8_000_000, rows: [
    txn(1_400_000,"2026-05-02","Ăn uống","Thẻ A",true),txn(2_800_000,"2026-05-03","Mua sắm","Thẻ B",false),txn(500_000,"2026-05-08","Di chuyển"),txn(800_000,"2026-05-10","Ăn uống","Thẻ A",true),
    txn(6_000_000,"2026-05-04","Gửi tiết kiệm",null,false,"non_budget"),txn(15_000_000,"2026-05-01","Lương",null,false,"non_budget","income"),
    txn(1_000_000,"2026-04-02","Ăn uống","Thẻ A",false),txn(800_000,"2026-04-03","Mua sắm","Thẻ B",false),txn(600_000,"2026-04-08","Di chuyển"),
  ]},
  { name: "over-budget", budget: 2_000_000, rows: [
    txn(2_200_000,"2026-05-02","Ăn uống","Thẻ A",true),txn(1_800_000,"2026-05-05","Mua sắm"),txn(300_000,"2026-05-12","Di chuyển"),
    txn(1_000_000,"2026-04-02","Ăn uống","Thẻ A",false),txn(800_000,"2026-04-05","Mua sắm"),
  ]},
  { name: "sparse-no-budget", budget: null, rows: [
    txn(150_000,"2026-05-10","Ăn uống"),txn(2_000_000,"2026-05-11","Trả nợ",null,false,"non_budget"),
  ]},
];
await mkdir(outputDir, { recursive: true });
const results = [];
for (const scenario of cases) {
  const snapshot = buildStatisticsSnapshot({ period, previousPeriod, transactions: scenario.rows, budgetAmount: scenario.budget, previousBudgetAmount: scenario.budget, objective: "Giữ chi tiêu trong hạn mức và theo dõi khoản chi thẻ chưa thanh toán." });
  await writeFile(`${outputDir}/${scenario.name}-input.json`, JSON.stringify(snapshot, null, 2));
  for (const modelId of models) {
    const started = Date.now();
    try {
      const result = await generateText({ model: gateway(modelId), system: STATISTICS_SYSTEM, prompt: JSON.stringify(snapshot), output: Output.object({ schema: narrativeSchema }), maxOutputTokens: 6144, providerOptions: { openai: { reasoningEffort: "low" } }, maxRetries: 0, abortSignal: AbortSignal.timeout(120_000) });
      const insights = hydrateStatisticsInsights(result.output, snapshot);
      const price = modelCatalog.data.find(m => m.id === modelId)?.pricing;
      const usage = result.totalUsage;
      const inputDetails = usage.inputTokenDetails;
      const estimatedCost = price ?
        (inputDetails?.noCacheTokens ?? usage.inputTokens ?? 0) * Number(price.input) +
        (inputDetails?.cacheReadTokens ?? 0) * Number(price.input_cache_read ?? price.input) +
        (inputDetails?.cacheWriteTokens ?? 0) * Number(price.input_cache_write ?? price.input) +
        (usage.outputTokens ?? 0) * Number(price.output) : null;
      const record = { scenario: scenario.name, modelId, success: true, durationMs: Date.now() - started, usage, pricing: price, estimatedCostUsd: estimatedCost, narrative: result.output, insights };
      results.push(record);
      await writeFile(`${outputDir}/${scenario.name}-${modelId.split('/')[1]}.json`, JSON.stringify(record, null, 2));
      console.log(JSON.stringify({ scenario: scenario.name, modelId, durationMs: record.durationMs, usage, estimatedCostUsd: estimatedCost }));
    } catch (error) {
      const record = { scenario: scenario.name, modelId, success: false, durationMs: Date.now() - started, error: error.message };
      results.push(record);
      console.log(JSON.stringify(record));
    }
  }
}
await writeFile(`${outputDir}/results.json`, JSON.stringify(results, null, 2));
console.log(`Evaluation artifacts: ${outputDir}`);
