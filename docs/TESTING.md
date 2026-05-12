# Testing Strategy

| Field | Value |
|-------|-------|
| Type | Testing Strategy |
| Status | Active |
| Version | 2.1 |
| Author | niits |
| Last Updated | 2026-05-12 |
| Related | TECHNICAL_DESIGN.md, FIREBASE_MIGRATION.md |

---

## Overview

Three layers of automated testing:

| Layer | Type | Runner | Needs Emulator |
|-------|------|--------|----------------|
| 1 | Unit | Vitest (Node) | No |
| 2 | Integration | Vitest + Firebase Emulator | Yes |
| 3 | Security Rules | `@firebase/rules-unit-testing` | Yes |

---

## Layer 1 — Unit Tests

Pure TypeScript functions with no I/O. Co-located with the modules they test under `src/`.

| File | Coverage |
|------|----------|
| `src/lib/validators.test.ts` | `parseAmount`, `parseDate`, `parseMonth`, `lastWorkingDay`, `getBudgetMonthForDate`, `getBudgetPeriod`, `getBudgetPeriodInclusive` |
| `src/lib/pace-line.test.ts` | `idealBudgetAtDay`, `isOverPace`, `getDaysInMonth`, `buildIdealLine`, `buildActualLine` |
| `src/lib/derive/dashboard.test.ts` | `deriveDashboard`, `buildCategoryPath`, `getRootCategoryName` |

```bash
npm run test:unit
```

No setup required. Runs offline.

---

## Layer 2 — Integration Tests

### Prerequisites

#### 1. Java JDK 17+

The Firestore emulator is a `.jar` file — it will not start without a JRE:

```bash
sudo apt-get install -y openjdk-17-jre-headless
java -version   # should print "openjdk 17..."
```

#### 2. Download emulator binaries

Firebase CLI downloads emulator `.jar` files on first use into `~/.cache/firebase/emulators/`. Run once to pre-download:

```bash
npx firebase emulators:start --only auth,firestore --project=demo-personal-finance
# Wait for "All emulators ready", then Ctrl+C
```

Subsequent runs use the cached binaries — no network needed.

### How `npm run test:integration` works

```json
"test:integration": "firebase emulators:exec --only auth,firestore --project=demo-personal-finance \"vitest run --config vitest.config.ts\""
```

`emulators:exec` does three things automatically:
1. Starts Auth (port 9099) and Firestore (port 8080) emulators
2. Sets environment variables `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` and `FIRESTORE_EMULATOR_HOST=localhost:8080`
3. Runs the quoted command, then shuts emulators down

The `demo-personal-finance` project ID has the `demo-` prefix — Firebase treats any `demo-*` project as a local-only project requiring no credentials and no internet access.

### Why no `globalSetup` or `setupFiles`

`vitest.config.ts` does not use `globalSetup` or `setupFiles`. Here is why each was considered and rejected:

**`globalSetup`** runs once before test workers, in a completely isolated global scope that is separate from test processes — variables defined there are unreachable by tests. Its only practical use is starting external servers. Since `emulators:exec` already manages the emulator lifecycle, `globalSetup` would be an empty file with no purpose.

**`setupFiles`** runs before each test file in the same process as the tests, and is the right place for global mocks or environment patching. Firebase app initialization is not a good fit here because:
- Each test file must call `initializeApp(config, uniqueName)` with a **unique app name** to avoid Vitest running test files in the same process and hitting the `connectFirestoreEmulator() already called` error on the shared Firestore instance.
- A shared setup file would need to know the unique name ahead of time, creating coordination complexity with no benefit.

The correct approach is a **plain TypeScript helper module** that each test file imports directly — no Vitest lifecycle hooks involved:

```
tests/
  integration/
    helpers.ts          ← shared Firebase init helpers (regular import)
    categories.test.ts  ← imports from helpers.ts
    transactions.test.ts
    ...
```

### `tests/integration/helpers.ts`

This is the only shared file needed. It is a plain module — not a Vitest setup file:

```ts
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
} from "firebase/auth";

const FIREBASE_CONFIG = {
  apiKey: "test-api-key",
  authDomain: "demo-personal-finance.firebaseapp.com",
  projectId: "demo-personal-finance",
};

export type TestContext = {
  db: Firestore;
  uid: string;
  app: FirebaseApp;
};

/**
 * Creates an isolated Firebase app + Firestore + fresh anonymous user.
 * Call once per describe block or beforeEach.
 * Pass the returned `app` to `teardown()` in afterAll.
 */
export async function setup(): Promise<TestContext> {
  // Unique app name prevents "already initialized" errors when multiple
  // test files run in the same Vitest worker process.
  const app = initializeApp(FIREBASE_CONFIG, `test-${Date.now()}-${Math.random()}`);

  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, "localhost", 8080);

  const cred = await signInAnonymously(auth);
  const uid = cred.user.uid;

  return { app, db, uid };
}

/** Call in afterAll to avoid memory leaks across test files. */
export async function teardown(app: FirebaseApp): Promise<void> {
  await deleteApp(app);
}
```

### Isolation strategy

Each call to `setup()` returns a **new anonymous user UID**. All Firestore reads and writes for that test go under `/users/{uid}/` — a namespace no other test touches. There is no need to delete documents after tests.

### Test file pattern

```ts
// tests/integration/categories.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { setup, teardown, type TestContext } from "./helpers";
import { createCategory, deleteCategory, CategoryError } from "@/lib/data/categories";
import type { FirebaseApp } from "firebase/app";

let ctx: TestContext;
let app: FirebaseApp;

beforeEach(async () => {
  ctx = await setup();
  app = ctx.app;
});

afterAll(async () => {
  await teardown(app);
});

describe("createCategory", () => {
  it("creates a root expense category", async () => {
    const cat = await createCategory(ctx.db, ctx.uid, {
      name: "Ăn uống",
      parentId: null,
      type: "expense",
    });
    expect(cat.id).toBeDefined();
    expect(cat.level).toBe(1);
    expect(cat.type).toBe("expense");
  });

  it("rejects level-4 category", async () => {
    // build a 3-level chain first
    const l1 = await createCategory(ctx.db, ctx.uid, { name: "L1", parentId: null, type: "expense" });
    const l2 = await createCategory(ctx.db, ctx.uid, { name: "L2", parentId: l1.id });
    const l3 = await createCategory(ctx.db, ctx.uid, { name: "L3", parentId: l2.id });

    await expect(
      createCategory(ctx.db, ctx.uid, { name: "L4", parentId: l3.id }),
    ).rejects.toThrow(CategoryError);
  });
});
```

---

## Layer 3 — Security Rules Tests

**Package:** `@firebase/rules-unit-testing` (already installed)

`initializeTestEnvironment` loads `firestore.rules` directly into the emulator, then provides `authenticatedContext` and `unauthenticatedContext` helpers to simulate different auth states without needing a real signed-in user.

```ts
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { setDoc, doc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-personal-finance",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "localhost",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});
```

### Coverage map

| Collection | Scenario | Expected |
|------------|----------|----------|
| `/users/{uid}` | Owner reads own doc | Allow |
| `/users/{uid}` | Other authenticated user reads | Deny |
| `/users/{uid}` | Unauthenticated reads | Deny |
| `/categories/{id}` | Owner creates valid doc (level 1–3, valid name) | Allow |
| `/categories/{id}` | Owner creates with `level=4` | Deny |
| `/categories/{id}` | Owner creates with empty `name` | Deny |
| `/transactions/{id}` | Income with non-null `monthlyBudgetId` | Deny |
| `/transactions/{id}` | Income with non-empty `customBudgetIds` | Deny |
| `/transactions/{id}` | Expense with `monthlyBudgetId = null` | Deny |
| `/aiSuggestionRuns/{id}` | Any client write | Deny |
| `/monthlyBudgets/{id}/adjustments/{id}` | Client update | Deny |
| `/monthlyBudgets/{id}/adjustments/{id}` | Client delete | Deny |

**File:** `tests/rules/firestore.rules.test.ts`

Rules tests also need the Firestore emulator running. Add to `package.json`:

```json
"test:rules": "firebase emulators:exec --only firestore --project=demo-personal-finance \"vitest run tests/rules\""
```

---

## All commands

```bash
# Layer 1 — no emulator, instant
npm run test:unit

# Layer 2 — starts emulators, runs, stops
npm run test:integration

# Layer 2 — when emulators already running separately
npm run test:integration:nofire

# All layers
npm test
```

---

## File layout

```
tests/
  integration/
    helpers.ts              ← shared setup() / teardown() helpers
    categories.test.ts
    monthly-budgets.test.ts
    transactions.test.ts
    custom-budgets.test.ts
    budget-config.test.ts
  rules/
    firestore.rules.test.ts

src/lib/
  validators.test.ts        ✓ exists
  pace-line.test.ts         ✓ exists
  derive/
    dashboard.test.ts       ✓ exists
```

---

## What NOT to test

- Firebase Auth flow — tested by the Firebase SDK itself
- LLM routes (`/api/categories/suggest`, `/api/transactions/recategorize`) — depend on live AI model; tested manually
- UI rendering — covered manually on device
