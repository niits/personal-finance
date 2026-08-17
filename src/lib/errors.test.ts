import { describe, expect, it, vi } from "vitest";
import { Errors } from "./errors";

describe("Errors.internal D1 sanitization", () => {
  it("preserves a stable ledger trigger code without exposing database internals", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = Errors.internal(new Error(
      "D1_ERROR: ledger_cutover_active while INSERT INTO transaction with binding 1: SQLITE_CONSTRAINT",
    ));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Database write conflicted", code: "LEDGER_CUTOVER_ACTIVE" });
    expect(JSON.stringify(body)).not.toMatch(/D1|SQL|INSERT|transaction|binding|constraint/i);
  });

  it("uses a generic response for non-domain D1 errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = Errors.internal(new Error("D1_ERROR: no such table: secret_table"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Database operation failed", code: "INTERNAL_ERROR" });
    expect(JSON.stringify(body)).not.toContain("secret_table");
  });
});
