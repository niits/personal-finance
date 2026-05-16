import { createAuthClient } from "better-auth/react";

// Do not fall back to a hardcoded localhost URL. When NEXT_PUBLIC_APP_URL is
// undefined (common if the env var wasn't set at Cloudflare Pages build time),
// better-auth defaults to window.location.origin — the correct production URL.
// A hardcoded http://localhost:8787 fallback caused useSession() to fail in
// production, making the Navbar incorrectly show "Đăng nhập" for authed users.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signOut, useSession, linkSocial, unlinkAccount, changePassword } = authClient;
export const authClientFetch = authClient.$fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getAuthClientErrorMessage(result: unknown): string | null {
  if (!isRecord(result) || !isRecord(result.error)) {
    return null;
  }

  return typeof result.error.message === "string" ? result.error.message : null;
}

export function setAccountPassword(input: { newPassword: string }) {
  return authClientFetch("/set-password", {
    method: "POST",
    body: input,
  });
}

export function requestPasswordResetEmail(input: { email: string; redirectTo?: string }) {
  return authClientFetch("/request-password-reset", {
    method: "POST",
    body: input,
  });
}

export function listLinkedAccounts() {
  return authClientFetch("/list-accounts");
}
