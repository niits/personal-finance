import { describe, expect, it } from "vitest";
import {
  closePosition,
  positionActionEventKind,
  positionActionMatrix,
} from "./positions";

describe("positionActionMatrix", () => {
  it("defines every compatible principal action", () => {
    expect(positionActionMatrix).toEqual({
      term_deposit: { fund: "cash_to_position", withdraw: "position_to_cash" },
      personal_receivable: { lend: "cash_to_position", collect: "position_to_cash" },
      credit_card: { pay: "cash_to_position" },
      personal_payable: { borrow: "position_to_cash", repay: "cash_to_position" },
    });
  });

  it("rejects actions incompatible with a position kind", () => {
    expect(() => positionActionEventKind("credit_card", "borrow")).toThrow(
      "Action borrow is not valid for credit_card",
    );
  });
});

describe("closePosition", () => {
  it("withdraws the complete positive balance", () => {
    expect(closePosition("position", 250, "2026-08-16")).toEqual({
      type: "move_position",
      amount: 250,
      positionId: "position",
      direction: "position_to_cash",
      date: "2026-08-16",
    });
  });

  it("pays the complete negative balance", () => {
    expect(closePosition("position", -250, "2026-08-16")).toEqual({
      type: "move_position",
      amount: 250,
      positionId: "position",
      direction: "cash_to_position",
      date: "2026-08-16",
    });
  });

  it("needs no settlement event for a zero balance", () => {
    expect(closePosition("position", 0, "2026-08-16")).toBeNull();
  });

  it("uses signed balance direction for an overpaid credit card", () => {
    expect(closePosition("overpaid-card", 75, "2026-08-16")?.direction).toBe(
      "position_to_cash",
    );
  });

  it("uses signed balance direction for an overdrawn term deposit", () => {
    expect(closePosition("overdrawn-deposit", -75, "2026-08-16")?.direction).toBe(
      "cash_to_position",
    );
  });

  it("rejects invalid close dates", () => {
    expect(() => closePosition("position", 75, "2026-02-29")).toThrow(
      "Event date must be a real canonical YYYY-MM-DD date: 2026-02-29",
    );
  });
});
