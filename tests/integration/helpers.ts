import { env } from "cloudflare:test";

// Sign with whatever secret the Worker actually resolves at runtime (wrangler.jsonc
// vars, .dev.vars, and poolOptions.miniflare.vars merge in a version-dependent order),
// rather than a hardcoded value that can silently drift out of sync with it.
const TEST_SECRET = (env as { BETTER_AUTH_SECRET: string }).BETTER_AUTH_SECRET;

// Use Vite's import.meta.glob to bundle SQL files at compile time.
// This avoids node:fs calls which are not available in the Workers test runtime.
const migrationModules = import.meta.glob<string>("../../migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * Strip SQL line comments and split into individual statements.
 * Naive split(";") breaks when comments contain semicolons (e.g. migration 0006).
 */
function splitSql(sql: string): string[] {
  const lines = sql.split("\n");
  const cleaned = lines
    .map((line) => {
      const commentIdx = line.indexOf("--");
      return commentIdx === -1 ? line : line.substring(0, commentIdx);
    })
    .join("\n");

  return cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function applyMigrations() {
  const entries = Object.entries(migrationModules).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [, sql] of entries) {
    const statements = splitSql(sql);
    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }
  }
}

async function makeSignature(value: string, secret: string): Promise<string> {
  const keyBuf = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function seedUser(opts?: { id?: string; email?: string }) {
  const id = opts?.id ?? "user-test-1";
  const email = opts?.email ?? "test@example.com";
  // better-auth's D1 adapter stores date fields as ISO 8601 strings, not
  // raw epoch integers — match that format so session reads parse correctly.
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)",
  )
    .bind(id, "Test User", email, now, now)
    .run();

  return id;
}

export async function createTestSession(userId: string): Promise<string> {
  const token = `test-token-${userId}-${Date.now()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 24 * 7 * 1000); // 7 days

  await env.DB.prepare(
    "INSERT OR IGNORE INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(`session-${token}`, token, userId, expiresAt.toISOString(), now.toISOString(), now.toISOString())
    .run();

  const signature = await makeSignature(token, TEST_SECRET);
  return `better-auth.session_token=${token}.${signature}`;
}

export async function seedCategory(
  userId: string,
  name: string,
  parentId: number | null = null,
  level = 1,
) {
  const result = await env.DB.prepare(
    "INSERT INTO category (user_id, name, parent_id, level, sort_order) VALUES (?, ?, ?, ?, 0) RETURNING id",
  )
    .bind(userId, name, parentId, level)
    .first<{ id: number }>();
  return result!.id;
}

export async function seedMonthlyBudget(
  userId: string,
  month: string,
  amount: number,
) {
  const result = await env.DB.prepare(
    "INSERT INTO monthly_budget (user_id, month, amount) VALUES (?, ?, ?) RETURNING id, month, amount",
  )
    .bind(userId, month, amount)
    .first<{ id: number; month: string; amount: number }>();
  return result!;
}

export async function seedCustomBudget(userId: string, name: string, amount: number) {
  const result = await env.DB.prepare(
    "INSERT INTO custom_budget (user_id, name, amount) VALUES (?, ?, ?) RETURNING id",
  )
    .bind(userId, name, amount)
    .first<{ id: number }>();
  return result!.id;
}

export function authHeaders(cookie: string): HeadersInit {
  return { "Content-Type": "application/json", Cookie: cookie };
}
