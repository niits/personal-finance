"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error_param = searchParams.get("error");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(error_param ?? null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token && !error_param) {
      setError("Liên kết không hợp lệ hoặc đã hết hạn.");
    }
  }, [token, error_param]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!token) {
      setError("Liên kết không hợp lệ.");
      return;
    }
    setLoading(true);
    try {
      const res = await authClient.resetPassword({ newPassword, token });
      if (res.error) throw new Error(res.error.message ?? "Đặt lại mật khẩu thất bại");
      setSuccess(true);
      setTimeout(() => router.replace("/sign-in"), 2000);
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
            Đặt lại mật khẩu
          </h1>
        </div>

        {success ? (
          <div style={{
            background: "var(--surface-white)",
            borderRadius: "var(--radius-lg)",
            padding: "24px 20px",
            textAlign: "center",
          }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)" }}>
              Mật khẩu đã được đặt lại thành công. Đang chuyển hướng…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />

            {error && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--danger)", margin: 0 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !token}
              className="btn-primary"
              style={{ width: "100%", padding: "13px 20px", fontSize: 15 }}
            >
              {loading ? "Đang lưu…" : "Đặt lại mật khẩu"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
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
