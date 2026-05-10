import { createAuthClient } from "better-auth/react";

// Do not fall back to a hardcoded localhost URL. When NEXT_PUBLIC_APP_URL is
// undefined (common if the env var wasn't set at Cloudflare Pages build time),
// better-auth defaults to window.location.origin — the correct production URL.
// A hardcoded http://localhost:8787 fallback caused useSession() to fail in
// production, making the Navbar incorrectly show "Đăng nhập" for authed users.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signOut, useSession } = authClient;
