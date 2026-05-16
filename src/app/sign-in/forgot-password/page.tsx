"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.forgetPassword({
        email,
        redirectTo: `${window.location.origin}/sign-in/reset-password`,
      });
      if (res.error) throw new Error(res.error.message ?? "Đã có lỗi xảy ra");
      setSent(true);
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
            Quên mật khẩu
          </h1>
        </div>

        {sent ? (
          <div style={{
            background: "var(--surface-white)",
            borderRadius: "var(--radius-lg)",
            padding: "24px 20px",
            textAlign: "center",
          }}>
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--ink)",
              lineHeight: 1.6,
              marginBottom: 20,
            }}>
              Nếu địa chỉ email <strong>{email}</strong> tồn tại trong hệ thống,
              bạn sẽ nhận được email hướng dẫn đặt lại mật khẩu.
            </p>
            <Link href="/sign-in" style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--primary)",
              fontWeight: 500,
            }}>
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={inputStyle}
            />

            {error && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--danger)", margin: 0 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", padding: "13px 20px", fontSize: 15 }}
            >
              {loading ? "Đang gửi…" : "Gửi link đặt lại mật khẩu"}
            </button>

            <p style={{ textAlign: "center", marginTop: 8 }}>
              <Link href="/sign-in" style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--ink-muted-48)",
              }}>
                Quay lại đăng nhập
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--hairline)",
  background: "var(--surface-white)",
  fontFamily: "var(--font-body)",
  fontSize: 15,
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box",
};
