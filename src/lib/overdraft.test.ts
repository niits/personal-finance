import { describe, it, expect } from "vitest";
import { overdraftPaymentError } from "./overdraft";

const base = { overdraftAccountId: "od-1", type: "expense" as const, isConsumption: true, creditCardGroupId: null };

describe("overdraftPaymentError", () => {
  it("allows a consumption expense paid by overdraft", () => {
    expect(overdraftPaymentError(base)).toBeNull();
  });

  it("allows any transaction without overdraft payment", () => {
    expect(overdraftPaymentError({ ...base, overdraftAccountId: null, type: "income", isConsumption: false })).toBeNull();
  });

  it("rejects income and debt or savings movements paid by overdraft", () => {
    expect(overdraftPaymentError({ ...base, type: "income" })).toMatch(/chỉ dùng để thanh toán chi tiêu/);
    expect(overdraftPaymentError({ ...base, isConsumption: false })).toMatch(/chỉ dùng để thanh toán chi tiêu/);
  });

  it("rejects combining overdraft with a card group", () => {
    expect(overdraftPaymentError({ ...base, creditCardGroupId: "card-1" })).toMatch(/Chỉ chọn một hình thức thanh toán/);
  });
});
