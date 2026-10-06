# Statistics model evaluation

The statistics report uses `openai/gpt-6.1-sol` by default. `STATISTICS_MODEL=openai/gpt-5.6-terra` selects Terra. This choice applies to statistics reports.

## Method

The final evaluation on 2026-10-06 submitted the same deterministic snapshot, structured output schema, and Vietnamese instructions to both models through Vercel AI Gateway. Each model processed three synthetic scenarios once: substantial credit-card spending, budget overrun, and sparse transactions without a budget. The requests used low reasoning effort, a 6,144-token output limit, and no automatic retries. No customer transactions were submitted by this evaluation.

Run `node scripts/evaluate-statistics.mjs /tmp/statistics-evaluation` to repeat the paid evaluation with gateway credentials configured locally. The script is excluded from automated test suites. [Recorded outputs](statistics-model-evaluation.json) contain the final narratives, token usage, and estimated costs.

## Results

| Scenario | Terra duration | Terra estimated cost | Sol duration | Sol estimated cost |
| --- | ---: | ---: | ---: | ---: |
| Credit-card spending | 10.159 s | $0.013225 | 6.973 s | $0.007669 |
| Budget overrun | 4.644 s | $0.008601 | 6.675 s | $0.007449 |
| Sparse transactions | 4.478 s | $0.006560 | 6.531 s | $0.006014 |
| Mean | 6.427 s | $0.009462 | 6.726 s | $0.007044 |

All six final responses passed schema validation, numeric evidence checks, and chart reference validation. Manual review found correct amounts and budget-overrun percentages in these samples. Sol produced three insights consistently; Terra produced more insights in two scenarios. Sol's wording was generally more concise, although some explanations remained repetitive. Neither model demonstrated a clear latency advantage across this small sample.

Sol cost approximately 25.6% less on average in this evaluation. Estimates use the gateway catalog rates and reported token details, including cache writes and reasoning output. They are token cost estimates rather than invoices; routing, caching, future prices, and additional gateway charges can change actual costs. Model reference pages: [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) and [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

## Quality safeguards and limits

Earlier iterations exposed overly long text and confusion between the percentage of budget consumed and the percentage over budget. The final prompt names these metrics separately and limits narrative length. Validation rejects unknown monetary amounts, unsupported percentages, duplicate or unknown chart references, and certain incorrect budget-overrun statements. Validation does not prove every statement's meaning or recommendation quality.

The server computes chart values, periods, categories, and payment subsets. The model selects an existing chart and writes its explanation. Chart accuracy therefore depends on the verified data pipeline rather than model size. The UI renders these charts with shared design tokens, exact value labels, distinct series, and accessible data tables.

Three synthetic scenarios with one final run per model do not establish reliability on all real reports, nor do they isolate model improvements from prompt and pipeline improvements. Sol is the current cost and quality choice; broader evaluations should use representative anonymized cases and repeated runs before changing that default.
