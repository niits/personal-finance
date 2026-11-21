import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker-provider.js";
import { invokeRoute } from "./invoke";
import { MCP_TOOLS } from "./tools";

const INSTRUCTIONS = `Personal Finance is the user's own expense tracker in Vietnamese dong (VND). Every tool acts as the signed-in user, through the same rules as the app.

- Amounts are positive integer VND. Dates are YYYY-MM-DD and cannot be in the future. Budget months are YYYY-MM labels for working-day budget periods.
- Before creating or editing a transaction, call list_categories: only leaf categories can be assigned, and the category type must match the transaction type.
- Consumption expenses count in the monthly budget and may also count in custom budgets. Pay by card with credit_card_group_id or from a bank overdraft account with overdraft_account_id (this increases what the user owes the bank); omit both for cash.
- Repay an overdraft account with a repayment transaction (protected debt repayment category) whose finance_account_id is that account; it cannot exceed the amount owed.
- Lending, borrowing, repayments, savings deposits, and withdrawals use protected non-budget categories and require a finance_account_id from the matching account family (see list_finance_accounts).
- AI organize is two-step: preview, show the proposal to the user, then apply only what they accept.
- Error messages are in Vietnamese; explain them to the user in their language.
- Confirm with the user before deleting anything.`;

/** Builds a stateless MCP server whose tools call the app's routes as the token's user. */
export function createMcpServer(origin: string, authorization: string): McpServer {
  const server = new McpServer(
    { name: "personal-finance", version: "1.0.0" },
    { instructions: INSTRUCTIONS, jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
  );
  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.input, annotations: tool.annotations },
      (args: Record<string, unknown>) => invokeRoute(tool.route, args, origin, authorization),
    );
  }
  return server;
}
