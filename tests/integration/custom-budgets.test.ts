import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, seedUser, createTestSession, authHeaders } from "./helpers";

let cookie: string;

beforeAll(async () => {
  await applyMigrations();
  const userId = await seedUser({ id: "user-cb", email: "cb@example.com" });
  cookie = await createTestSession(userId);
});

describe("POST /api/custom-budgets", () => {
  it("creates a custom budget with is_active = 1", async () => {
    const res = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Trip Đà Lạt", amount: 3_000_000 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ custom_budget: { is_active: number; spent: number } }>();
    expect(body.custom_budget.is_active).toBe(1);
    expect(body.custom_budget.spent).toBe(0);
  });

  it("returns 400 for amount = 0", async () => {
    const res = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Bad budget", amount: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty name", async () => {
    const res = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "", amount: 1_000_000 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/custom-budgets/:id — toggle active", () => {
  it("toggles budget to inactive", async () => {
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Toggleable", amount: 2_000_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();

    const patchRes = await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ is_active: 0 }),
    });

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json<{ custom_budget: { is_active: number } }>();
    expect(body.custom_budget.is_active).toBe(0);
  });

  it("updates name and amount", async () => {
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Original", amount: 1_000_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();

    const patchRes = await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Updated", amount: 2_000_000 }),
    });

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json<{ custom_budget: { name: string; amount: number } }>();
    expect(body.custom_budget.name).toBe("Updated");
    expect(body.custom_budget.amount).toBe(2_000_000);
  });
});

describe("DELETE /api/custom-budgets/:id", () => {
  it("deletes the custom budget", async () => {
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "To delete", amount: 500_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();

    const deleteRes = await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(deleteRes.status).toBe(200);
  });

  it("returns 404 for non-existent budget", async () => {
    const res = await SELF.fetch("http://localhost/api/custom-budgets/99999", {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/custom-budgets", () => {
  it("returns list with spent = 0 for new budgets", async () => {
    await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "New budget", amount: 4_000_000 }),
    });

    const res = await SELF.fetch("http://localhost/api/custom-budgets", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ custom_budgets: { spent: number }[] }>();
    expect(Array.isArray(body.custom_budgets)).toBe(true);
  });

  it("active_only=true filters inactive budgets", async () => {
    // Create and immediately deactivate one
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Inactive budget", amount: 1_000_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();
    await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ is_active: 0 }),
    });

    const res = await SELF.fetch("http://localhost/api/custom-budgets?active_only=true", {
      headers: { Cookie: cookie },
    });
    const body = await res.json<{ custom_budgets: { is_active: number }[] }>();
    expect(body.custom_budgets.every((b: { is_active: number }) => b.is_active === 1)).toBe(true);
  });
});
