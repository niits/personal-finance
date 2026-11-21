import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { RouteCall, RouteHandler } from "./invoke";
import { OrganizePatchSchema, OrganizeRetrySchema } from "@/lib/organize-patch";
import { CategoryTreePlanSchema } from "@/lib/category-tree-organize";
import * as dashboard from "@/app/api/dashboard/route";
import * as transactions from "@/app/api/transactions/route";
import * as transaction from "@/app/api/transactions/[id]/route";
import * as categories from "@/app/api/categories/route";
import * as category from "@/app/api/categories/[id]/route";
import * as categorySeed from "@/app/api/categories/seed/route";
import * as categoryTreeOrganize from "@/app/api/categories/organize/route";
import * as categoryTreeApply from "@/app/api/categories/organize/apply/route";
import * as monthlyBudgets from "@/app/api/monthly-budgets/route";
import * as monthlyBudget from "@/app/api/monthly-budgets/[id]/route";
import * as customBudgets from "@/app/api/custom-budgets/route";
import * as customBudget from "@/app/api/custom-budgets/[id]/route";
import * as budgetConfig from "@/app/api/budget-config/route";
import * as financeAccounts from "@/app/api/finance-accounts/route";
import * as financeAccount from "@/app/api/finance-accounts/[id]/route";
import * as cardGroups from "@/app/api/credit-card-groups/route";
import * as cardGroup from "@/app/api/credit-card-groups/[id]/route";
import * as statementPay from "@/app/api/credit-card-statements/[id]/pay/route";
import * as statistics from "@/app/api/statistics/route";
import * as aiOrganize from "@/app/api/ai/organize/route";
import * as aiOrganizeApply from "@/app/api/ai/organize/apply/route";
import * as accountExport from "@/app/api/account/export/route";

export type McpTool = {
  name: string;
  title: string;
  description: string;
  annotations: ToolAnnotations;
  input: z.ZodObject;
  route: RouteCall;
};

// Route handlers declare narrower params types (e.g. { id: string }); the invoker
// always passes the params parsed from the path template.
const h = (handler: unknown) => handler as RouteHandler;

const READ: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const UPDATE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
// AI tools call an external model provider.
const AI: Pick<ToolAnnotations, "openWorldHint"> = { openWorldHint: true };
const DELETE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

const month = z.string().regex(/^\d{4}-\d{2}$/).describe("Budget month label YYYY-MM. Defaults to the current budget month.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date YYYY-MM-DD; future dates are rejected.");
const vnd = z.number().int().positive().describe("Positive integer amount in VND.");
const numericId = z.number().int().positive();
const textId = z.string().min(1);
const nullableText = z.string().nullable();

const transactionFields = {
  type: z.enum(["expense", "income"]),
  amount: vnd,
  date,
  category_id: numericId.describe("Leaf category id whose type matches `type` (see list_categories)."),
  note: nullableText.optional(),
  emoji: nullableText.optional(),
  custom_budget_ids: z.array(numericId).optional().describe("Expense only: active custom budgets this expense also counts in."),
  finance_account_id: textId.nullable().optional().describe("Required for debt or savings categories (protected non-budget categories); must match the category's account family. Not allowed for consumption categories."),
  credit_card_group_id: textId.nullable().optional().describe("Consumption expense paid by this card group; omit or null for cash."),
};

export const MCP_TOOLS: McpTool[] = [
  // ── Read ────────────────────────────────────────────────────────────────
  {
    name: "get_dashboard", title: "Get dashboard",
    description: "Monthly outcome for one budget month: income, expense, budget limit and remaining, unpaid card spending, and pace summary.",
    annotations: READ, input: z.object({ month: month.optional() }),
    route: { method: "GET", path: "/api/dashboard", handler: h(dashboard.GET) },
  },
  {
    name: "list_transactions", title: "List transactions",
    description: "All transactions of one budget month (newest first) with category path, custom budgets, finance account, and card group.",
    annotations: READ,
    input: z.object({
      month: month.optional(),
      type: z.enum(["expense", "income"]).optional(),
      category_id: numericId.optional(),
      custom_budget_id: numericId.optional(),
    }),
    route: { method: "GET", path: "/api/transactions", handler: h(transactions.GET) },
  },
  {
    name: "list_categories", title: "List categories",
    description: "The user's three-level income/expense category tree with ids, emoji, system kinds, and budget behavior. Only leaf categories can be assigned to transactions.",
    annotations: READ, input: z.object({}),
    route: { method: "GET", path: "/api/categories", handler: h(categories.GET) },
  },
  {
    name: "get_monthly_budget", title: "Get monthly budget",
    description: "The monthly budget period for one month: effective limit, objective, period dates, and adjustment history.",
    annotations: READ, input: z.object({ month: month.optional() }),
    route: { method: "GET", path: "/api/monthly-budgets", handler: h(monthlyBudgets.GET) },
  },
  {
    name: "list_custom_budgets", title: "List custom budgets",
    description: "Custom budgets with amount, spending, and active state.",
    annotations: READ, input: z.object({ active_only: z.boolean().optional() }),
    route: { method: "GET", path: "/api/custom-budgets", handler: h(customBudgets.GET) },
  },
  {
    name: "get_budget_config", title: "Get default monthly budget",
    description: "The default amount used when a new monthly budget period is created.",
    annotations: READ, input: z.object({}),
    route: { method: "GET", path: "/api/budget-config", handler: h(budgetConfig.GET) },
  },
  {
    name: "list_finance_accounts", title: "List finance accounts",
    description: "Debt (lend/borrow) and savings accounts with balances derived from their transactions.",
    annotations: READ, input: z.object({}),
    route: { method: "GET", path: "/api/finance-accounts", handler: h(financeAccounts.GET) },
  },
  {
    name: "list_credit_card_groups", title: "List credit card groups",
    description: "Card groups with statement-close day, statements (paid/unpaid), and unpaid spending.",
    annotations: READ, input: z.object({}),
    route: { method: "GET", path: "/api/credit-card-groups", handler: h(cardGroups.GET) },
  },
  {
    name: "get_statistics_report", title: "Get statistics report",
    description: "The saved narrative statistics report for one month. Returns found=false when none exists yet; is_dirty=true means data changed since generation.",
    annotations: READ, input: z.object({ period_key: month }),
    route: { method: "GET", path: "/api/statistics", handler: h(statistics.GET) },
  },
  {
    name: "export_account_data", title: "Export account data",
    description: "Export transactions, categories, and budgets as JSON (default) or CSV of transactions.",
    annotations: READ, input: z.object({ format: z.enum(["json", "csv"]).optional() }),
    route: { method: "GET", path: "/api/account/export", handler: h(accountExport.GET) },
  },

  // ── Transactions ────────────────────────────────────────────────────────
  {
    name: "create_transaction", title: "Create transaction",
    description: "Record an expense or income. Consumption expenses count in the monthly budget; debt and savings movements need a matching finance account.",
    annotations: WRITE, input: z.object(transactionFields),
    route: { method: "POST", path: "/api/transactions", handler: h(transactions.POST) },
  },
  {
    name: "update_transaction", title: "Update transaction",
    description: "Change any fields of a transaction; omitted fields keep their value. Pass null to clear finance_account_id or credit_card_group_id.",
    annotations: UPDATE,
    input: z.object({ id: numericId, ...Object.fromEntries(Object.entries(transactionFields).map(([k, v]) => [k, v.optional()])) }),
    route: { method: "PATCH", path: "/api/transactions/:id", handler: h(transaction.PATCH) },
  },
  {
    name: "delete_transaction", title: "Delete transaction",
    description: "Permanently delete a transaction. Its category, budgets, card group, and finance account remain.",
    annotations: DELETE, input: z.object({ id: numericId }),
    route: { method: "DELETE", path: "/api/transactions/:id", handler: h(transaction.DELETE) },
  },

  // ── Categories ──────────────────────────────────────────────────────────
  {
    name: "create_category", title: "Create category",
    description: "Create a category. A child inherits its parent's type; a top-level category needs `type`. Maximum depth is three levels.",
    annotations: WRITE,
    input: z.object({
      name: z.string().min(1).max(100),
      parent_id: numericId.nullable().optional(),
      type: z.enum(["expense", "income"]).optional(),
      emoji: nullableText.optional(),
    }),
    route: { method: "POST", path: "/api/categories", handler: h(categories.POST) },
  },
  {
    name: "update_category", title: "Update category",
    description: "Rename a category, change its emoji, or its sort order among siblings.",
    annotations: UPDATE,
    input: z.object({ id: numericId, name: z.string().min(1).max(100).optional(), sort_order: z.number().int().optional(), emoji: nullableText.optional() }),
    route: { method: "PATCH", path: "/api/categories/:id", handler: h(category.PATCH) },
  },
  {
    name: "delete_category", title: "Delete category",
    description: "Delete a category. Protected categories, categories with children, or with transactions are refused.",
    annotations: DELETE, input: z.object({ id: numericId }),
    route: { method: "DELETE", path: "/api/categories/:id", handler: h(category.DELETE) },
  },
  {
    name: "seed_default_categories", title: "Create default categories",
    description: "Create the default category tree for a user who has no categories.",
    annotations: WRITE, input: z.object({}),
    route: { method: "POST", path: "/api/categories/seed", handler: h(categorySeed.POST) },
  },

  // ── Budgets ─────────────────────────────────────────────────────────────
  {
    name: "create_monthly_budget", title: "Create monthly budget",
    description: "Create the budget period for a month with a limit and an optional objective.",
    annotations: WRITE,
    input: z.object({ month, amount: vnd, objective: z.string().max(500).nullable().optional() }),
    route: { method: "POST", path: "/api/monthly-budgets", handler: h(monthlyBudgets.POST) },
  },
  {
    name: "adjust_monthly_budget", title: "Adjust monthly budget",
    description: "Change a monthly budget's limit by a non-zero signed VND delta, recorded as an adjustment with a required reason (`note`), and/or set its objective.",
    annotations: WRITE,
    input: z.object({
      id: numericId,
      delta: z.number().int().optional().describe("Signed integer VND change to the effective limit."),
      note: z.string().max(500).optional().describe("Reason for the adjustment; required when delta is set."),
      objective: z.string().max(500).nullable().optional(),
    }),
    route: { method: "PATCH", path: "/api/monthly-budgets/:id", handler: h(monthlyBudget.PATCH) },
  },
  {
    name: "create_custom_budget", title: "Create custom budget",
    description: "Create a custom budget (for example a trip) that selected expenses also count in.",
    annotations: WRITE, input: z.object({ name: z.string().min(1).max(100), amount: vnd }),
    route: { method: "POST", path: "/api/custom-budgets", handler: h(customBudgets.POST) },
  },
  {
    name: "update_custom_budget", title: "Update custom budget",
    description: "Rename, change the amount, or activate (1) / deactivate (0) a custom budget.",
    annotations: UPDATE,
    input: z.object({ id: numericId, name: z.string().min(1).max(100).optional(), amount: vnd.optional(), is_active: z.union([z.literal(0), z.literal(1)]).optional() }),
    route: { method: "PATCH", path: "/api/custom-budgets/:id", handler: h(customBudget.PATCH) },
  },
  {
    name: "delete_custom_budget", title: "Delete custom budget",
    description: "Delete a custom budget; refused while expenses are linked to it.",
    annotations: DELETE, input: z.object({ id: numericId }),
    route: { method: "DELETE", path: "/api/custom-budgets/:id", handler: h(customBudget.DELETE) },
  },
  {
    name: "update_budget_config", title: "Set default monthly budget",
    description: "Set the default amount for newly created monthly budget periods.",
    annotations: UPDATE, input: z.object({ default_monthly_amount: vnd }),
    route: { method: "PUT", path: "/api/budget-config", handler: h(budgetConfig.PUT) },
  },

  // ── Finance accounts and cards ──────────────────────────────────────────
  {
    name: "create_finance_account", title: "Create finance account",
    description: "Create a debt account (debt_direction lend = someone owes the user, borrow = the user owes) or a savings account. Balances come from transactions.",
    annotations: WRITE,
    input: z.object({ type: z.enum(["debt", "savings"]), name: z.string().min(1), debt_direction: z.enum(["lend", "borrow"]).optional(), note: nullableText.optional() }),
    route: { method: "POST", path: "/api/finance-accounts", handler: h(financeAccounts.POST) },
  },
  {
    name: "update_finance_account", title: "Update finance account",
    description: "Rename a finance account or change its note.",
    annotations: UPDATE, input: z.object({ id: textId, name: z.string().min(1), note: nullableText.optional() }),
    route: { method: "PATCH", path: "/api/finance-accounts/:id", handler: h(financeAccount.PATCH) },
  },
  {
    name: "delete_finance_account", title: "Delete finance account",
    description: "Delete a finance account; refused while transactions reference it.",
    annotations: DELETE, input: z.object({ id: textId }),
    route: { method: "DELETE", path: "/api/finance-accounts/:id", handler: h(financeAccount.DELETE) },
  },
  {
    name: "create_credit_card_group", title: "Create card group",
    description: "Create a credit card group with its monthly statement-close day (1-31).",
    annotations: WRITE, input: z.object({ name: z.string().min(1), statement_close_day: z.number().int().min(1).max(31) }),
    route: { method: "POST", path: "/api/credit-card-groups", handler: h(cardGroups.POST) },
  },
  {
    name: "update_credit_card_group", title: "Update card group",
    description: "Rename a card group or change its statement-close day (affects new statements only).",
    annotations: UPDATE, input: z.object({ id: textId, name: z.string().min(1), statement_close_day: z.number().int().min(1).max(31) }),
    route: { method: "PATCH", path: "/api/credit-card-groups/:id", handler: h(cardGroup.PATCH) },
  },
  {
    name: "delete_credit_card_group", title: "Delete card group",
    description: "Delete a card group; refused while purchases reference it.",
    annotations: DELETE, input: z.object({ id: textId }),
    route: { method: "DELETE", path: "/api/credit-card-groups/:id", handler: h(cardGroup.DELETE) },
  },
  {
    name: "pay_credit_card_statement", title: "Pay card statement",
    description: "Mark a closed card statement as paid in full on a non-future date. Does not create an expense.",
    annotations: UPDATE, input: z.object({ id: textId, paid_at: date }),
    route: { method: "PATCH", path: "/api/credit-card-statements/:id/pay", handler: h(statementPay.PATCH) },
  },

  // ── AI features ─────────────────────────────────────────────────────────
  {
    name: "generate_statistics_report", title: "Generate statistics report",
    description: "Generate (or regenerate) the narrative statistics report for a month that is not in the future. Takes up to a minute; returns the saved report.",
    annotations: { ...WRITE, ...AI }, input: z.object({ period_key: month }),
    route: { method: "POST", path: "/api/statistics", handler: h(statistics.POST), query: ["period_key"] },
  },
  {
    name: "preview_ai_organize", title: "Preview AI organize",
    description: "Ask AI to propose category merges, moves, new categories, recategorizations, and emoji. Nothing changes until apply_ai_organize. Pass `retry` with the rejected patch and errors to request a corrected proposal.",
    annotations: { ...READ, ...AI }, input: z.object({ retry: OrganizeRetrySchema.optional() }),
    route: { method: "POST", path: "/api/ai/organize", handler: h(aiOrganize.POST) },
  },
  {
    name: "apply_ai_organize", title: "Apply AI organize",
    description: "Apply the items the user accepted from preview_ai_organize, passing them in the same shape (including category_snapshot). Applied atomically; a stale proposal is refused.",
    annotations: { ...WRITE, destructiveHint: true }, input: OrganizePatchSchema,
    route: { method: "POST", path: "/api/ai/organize/apply", handler: h(aiOrganizeApply.POST) },
  },
  {
    name: "preview_category_tree_organize", title: "Preview category tree organize",
    description: "Ask AI to propose parent-child and sibling-order changes to existing categories. Nothing changes until apply_category_tree_organize.",
    annotations: { ...READ, ...AI }, input: z.object({}),
    route: { method: "POST", path: "/api/categories/organize", handler: h(categoryTreeOrganize.POST) },
  },
  {
    name: "apply_category_tree_organize", title: "Apply category tree organize",
    description: "Apply a whole-tree plan from preview_category_tree_organize with its snapshot hash. Applied atomically; a stale snapshot is refused.",
    annotations: { ...WRITE, destructiveHint: true },
    input: CategoryTreePlanSchema.extend({ snapshot: z.string().regex(/^[a-f0-9]{64}$/) }),
    route: { method: "POST", path: "/api/categories/organize/apply", handler: h(categoryTreeApply.POST) },
  },
];
