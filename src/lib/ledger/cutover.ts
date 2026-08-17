import { getDB } from "@/lib/db";
import { Errors } from "@/lib/errors";

export async function guardLegacyFinanceWrite(userId: string): Promise<Response | null> {
  const db = await getDB();
  const profile = await db.prepare("SELECT 1 FROM financial_profile WHERE user_id=?").bind(userId).first();
  return profile
    ? Errors.conflict("Legacy finance writes are disabled after ledger activation", "LEDGER_CUTOVER_ACTIVE")
    : null;
}
