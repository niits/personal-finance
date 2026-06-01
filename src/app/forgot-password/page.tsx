"use client";

import Link from "next/link";

export default function ForgotPasswordPage() {
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
        <div style={{
          background: "var(--surface-white)",
          borderRadius: "var(--radius-lg)",
          padding: "24px 20px",
          textAlign: "center",
          border: "1px solid var(--hairline)",
        }}>
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: 15,
            color: "var(--ink)",
            lineHeight: 1.6,
            margin: "0 0 10px",
          }}>
            Tính năng khôi phục mật khẩu đang được tạm dừng.
          </p>
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--ink-muted-48)",
            lineHeight: 1.6,
            margin: "0 0 20px",
          }}>
            Chúng tôi sẽ mở lại sau khi hoàn tất đợt ổn định hệ thống sắp tới.
          </p>
          <Link href="/sign-in" style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--primary)",
            fontWeight: 400,
          }}>
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </main>
  );
}
