"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, authClient } from "@/lib/auth-client";

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

type Mode = "sign-in" | "sign-up";

export default function SignInPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) router.replace("/dashboard");
  }, [session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "sign-in") {
        const res = await signIn.email({ email, password, callbackURL: "/dashboard" });
        if (res.error) throw new Error(res.error.message ?? "Đăng nhập thất bại");
      } else {
        const res = await authClient.signUp.email({ email, password, name, callbackURL: "/dashboard" });
        if (res.error) throw new Error(res.error.message ?? "Tạo tài khoản thất bại");
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100svh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--canvas)",
      padding: "44px 22px 22px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink-muted-48)",
            letterSpacing: 0.1,
            marginBottom: 8,
          }}>
            Personal Finance
          </p>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: -0.28,
          }}>
            {mode === "sign-in" ? "Đăng nhập" : "Tạo tài khoản"}
          </h1>
        </div>

        {/* GitHub SSO */}
        <button
          onClick={() => signIn.social({ provider: "github", callbackURL: `${window.location.origin}/dashboard` })}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 20px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-white)",
            color: "var(--ink)",
            fontFamily: "var(--font-body)",
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          <GitHubIcon />
          Tiếp tục với GitHub
        </button>

        {/* Google SSO */}
        <button
          onClick={() => signIn.social({ provider: "google", callbackURL: `${window.location.origin}/dashboard` })}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 20px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-white)",
            color: "var(--ink)",
            fontFamily: "var(--font-body)",
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          <GoogleIcon />
          Tiếp tục với Google
        </button>

        {/* Divider */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}>
          <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
          <span style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--ink-muted-48)",
          }}>hoặc</span>
          <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "sign-up" && (
            <input
              type="text"
              placeholder="Tên hiển thị"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            style={inputStyle}
          />

          {mode === "sign-in" && (
            <div style={{ textAlign: "right", marginTop: -4 }}>
              <Link href="/sign-in/forgot-password" style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--ink-muted-48)",
              }}>
                Quên mật khẩu?
              </Link>
            </div>
          )}

          {error && (
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--danger)",
              textAlign: "center",
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
          >
            {loading ? "…" : mode === "sign-in" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </form>

        {/* Toggle mode */}
        <p style={{
          textAlign: "center",
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--ink-muted-48)",
          marginTop: 24,
        }}>
          {mode === "sign-in" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <button
            onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(null); }}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {mode === "sign-in" ? "Đăng ký" : "Đăng nhập"}
          </button>
        </p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--hairline)",
  background: "var(--surface-white)",
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box",
};
