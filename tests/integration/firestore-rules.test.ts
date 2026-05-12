/**
 * Firestore security rules tests.
 * Each test uses assertFails / assertSucceeds directly against the emulator,
 * bypassing the data layer to probe the rules themselves.
 */
import { describe, it, beforeAll, afterAll } from "vitest";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  setupTestEnvironment,
  authenticatedDb,
  unauthenticatedDb,
  assertFails,
  assertSucceeds,
  uid,
} from "./helpers";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnvironment(); });
afterAll(async () => { await env.cleanup(); });

// Seed data bypassing security rules, so read/write tests can be set up independently.
async function adminSetDoc(u: string, path: string[], data: Record<string, unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const ref = doc(db, path[0], ...path.slice(1));
    await setDoc(ref, data);
  });
}

async function seedCategory(u: string, name = "Ăn uống"): Promise<string> {
  const catId = `cat-${Math.random().toString(36).slice(2)}`;
  await adminSetDoc(u, ["users", u, "categories", catId], {
    name,
    parentId: null,
    level: 1,
    sortOrder: 0,
    type: "expense",
    createdAt: serverTimestamp(),
  });
  return catId;
}

// ---------------------------------------------------------------------------
// Unauthenticated access
// ---------------------------------------------------------------------------
describe("unauthenticated access", () => {
  it("cannot read categories", async () => {
    const u = uid();
    await seedCategory(u);
    const db = unauthenticatedDb(env);
    await assertFails(getDocs(collection(db, "users", u, "categories")));
  });

  it("cannot read monthlyBudgets", async () => {
    const u = uid();
    const db = unauthenticatedDb(env);
    await assertFails(getDocs(collection(db, "users", u, "monthlyBudgets")));
  });

  it("cannot read transactions", async () => {
    const u = uid();
    const db = unauthenticatedDb(env);
    await assertFails(getDocs(collection(db, "users", u, "transactions")));
  });

  it("cannot write a category", async () => {
    const u = uid();
    const db = unauthenticatedDb(env);
    await assertFails(
      addDoc(collection(db, "users", u, "categories"), {
        name: "Hack",
        parentId: null,
        level: 1,
        sortOrder: 0,
        type: "expense",
        createdAt: serverTimestamp(),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-user isolation
// ---------------------------------------------------------------------------
describe("cross-user isolation", () => {
  it("user B cannot read user A's categories", async () => {
    const uA = uid();
    const uB = uid();
    await seedCategory(uA, "Private cat");
    const dbB = authenticatedDb(env, uB);
    await assertFails(getDocs(collection(dbB, "users", uA, "categories")));
  });

  it("user B cannot write to user A's categories", async () => {
    const uA = uid();
    const uB = uid();
    const dbB = authenticatedDb(env, uB);
    await assertFails(
      addDoc(collection(dbB, "users", uA, "categories"), {
        name: "Intruder",
        parentId: null,
        level: 1,
        sortOrder: 0,
        type: "expense",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("user B cannot delete user A's category", async () => {
    const uA = uid();
    const uB = uid();
    const catId = await seedCategory(uA);
    const dbB = authenticatedDb(env, uB);
    await assertFails(deleteDoc(doc(dbB, "users", uA, "categories", catId)));
  });
});

// ---------------------------------------------------------------------------
// Category validation
// ---------------------------------------------------------------------------
describe("category write rules — validation", () => {
  it("allows a valid category write", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertSucceeds(
      addDoc(collection(db, "users", u, "categories"), {
        name: "Ăn uống",
        parentId: null,
        level: 1,
        sortOrder: 0,
        type: "expense",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("rejects invalid type", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertFails(
      addDoc(collection(db, "users", u, "categories"), {
        name: "Bad",
        parentId: null,
        level: 1,
        sortOrder: 0,
        type: "other",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("rejects empty name", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertFails(
      addDoc(collection(db, "users", u, "categories"), {
        name: "",
        parentId: null,
        level: 1,
        sortOrder: 0,
        type: "expense",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("rejects level out of range", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertFails(
      addDoc(collection(db, "users", u, "categories"), {
        name: "Bad",
        parentId: null,
        level: 4,
        sortOrder: 0,
        type: "expense",
        createdAt: serverTimestamp(),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Transaction write rules — validation
// ---------------------------------------------------------------------------
describe("transaction write rules — validation", () => {
  it("rejects expense with null monthlyBudgetId", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertFails(
      addDoc(collection(db, "users", u, "transactions"), {
        amount: 100_000,
        type: "expense",
        categoryId: "cat1",
        note: null,
        date: "2026-05-10",
        monthlyBudgetId: null,
        customBudgetIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("rejects income with a non-null monthlyBudgetId", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertFails(
      addDoc(collection(db, "users", u, "transactions"), {
        amount: 15_000_000,
        type: "income",
        categoryId: "cat1",
        note: null,
        date: "2026-05-01",
        monthlyBudgetId: "some-budget",
        customBudgetIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("rejects non-positive amount", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertFails(
      addDoc(collection(db, "users", u, "transactions"), {
        amount: 0,
        type: "income",
        categoryId: "cat1",
        note: null,
        date: "2026-05-01",
        monthlyBudgetId: null,
        customBudgetIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("rejects invalid date format", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertFails(
      addDoc(collection(db, "users", u, "transactions"), {
        amount: 100_000,
        type: "income",
        categoryId: "cat1",
        note: null,
        date: "10-05-2026",
        monthlyBudgetId: null,
        customBudgetIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Adjustment immutability
// ---------------------------------------------------------------------------
describe("adjustment rules — immutable", () => {
  it("allows creating an adjustment", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertSucceeds(
      addDoc(collection(db, "users", u, "monthlyBudgets", "budget1", "adjustments"), {
        delta: 1_000_000,
        note: null,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("rejects updating an adjustment", async () => {
    const u = uid();
    const adjId = `adj-${Math.random().toString(36).slice(2)}`;
    await adminSetDoc(u, ["users", u, "monthlyBudgets", "budget1", "adjustments", adjId], {
      delta: 1_000_000,
      note: null,
      createdAt: serverTimestamp(),
    });
    const db = authenticatedDb(env, u);
    await assertFails(
      updateDoc(doc(db, "users", u, "monthlyBudgets", "budget1", "adjustments", adjId), { delta: 9_999 }),
    );
  });

  it("rejects deleting an adjustment", async () => {
    const u = uid();
    const adjId = `adj-${Math.random().toString(36).slice(2)}`;
    await adminSetDoc(u, ["users", u, "monthlyBudgets", "budget1", "adjustments", adjId], {
      delta: 1_000_000,
      note: null,
      createdAt: serverTimestamp(),
    });
    const db = authenticatedDb(env, u);
    await assertFails(
      deleteDoc(doc(db, "users", u, "monthlyBudgets", "budget1", "adjustments", adjId)),
    );
  });
});

// ---------------------------------------------------------------------------
// aiSuggestionRuns — client writes blocked
// ---------------------------------------------------------------------------
describe("aiSuggestionRuns — write blocked for clients", () => {
  it("user cannot create an aiSuggestionRun", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await assertFails(
      addDoc(collection(db, "users", u, "aiSuggestionRuns"), {
        status: "pending",
        fromUpdatedAt: null,
        upToUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("user can read their own aiSuggestionRuns", async () => {
    const u = uid();
    const runId = `run-${Math.random().toString(36).slice(2)}`;
    await adminSetDoc(u, ["users", u, "aiSuggestionRuns", runId], {
      status: "pending",
      fromUpdatedAt: null,
      upToUpdatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    const db = authenticatedDb(env, u);
    await assertSucceeds(getDoc(doc(db, "users", u, "aiSuggestionRuns", runId)));
  });
});
