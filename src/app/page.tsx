"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signInWithGoogle } from "@/lib/auth-client";

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" fill="#34A853"/>
    <path d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
  </svg>
);

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session) router.replace("/dashboard");
  }, [session, isPending, router]);

  return (
    <main>
      <section style={{
        paddingTop: "calc(44px + var(--space-section))",
        paddingBottom: "var(--space-section)",
        padding: "calc(44px + var(--space-section)) 22px var(--space-section)",
        textAlign: "center",
        background: "var(--canvas)",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: 21,
          fontWeight: 600,
          lineHeight: 1.19,
          letterSpacing: 0.231,
          color: "var(--ink)",
          marginBottom: 12,
        }}>
          Personal Finance
        </p>

        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(34px, 8vw, 56px)",
          fontWeight: 600,
          lineHeight: 1.07,
          letterSpacing: -0.28,
          color: "var(--ink)",
          maxWidth: 720,
          marginBottom: 16,
        }}>
          Tiền của bạn.<br />Trong tầm kiểm soát.
        </h1>

        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(19px, 3vw, 28px)",
          fontWeight: 400,
          lineHeight: 1.14,
          letterSpacing: 0.196,
          color: "var(--ink-muted-48)",
          maxWidth: 560,
          marginBottom: 40,
        }}>
          Theo dõi chi tiêu cá nhân đơn giản, đẹp, và không phán xét.
        </p>

        {!isPending && !session && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              className="btn-primary"
              onClick={() => signInWithGoogle().catch(console.error)}
            >
              <GoogleIcon />
              Đăng nhập với Google
            </button>
          </div>
        )}

        {!isPending && session && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <p style={{ color: "var(--ink-muted-48)", fontSize: 14 }}>
              Xin chào, {session.user.name || session.user.email} 👋
            </p>
            <a href="/dashboard" className="btn-primary">
              Vào Dashboard →
            </a>
          </div>
        )}
      </section>

      <section style={{
        background: "var(--surface-tile-1)",
        padding: "var(--space-section) 22px",
        textAlign: "center",
      }}>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(28px, 5vw, 40px)",
          fontWeight: 600,
          lineHeight: 1.1,
          color: "var(--on-dark)",
          maxWidth: 600,
          margin: "0 auto 16px",
        }}>
          Mọi khoản chi. Một cái nhìn.
        </h2>
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: 21,
          fontWeight: 400,
          lineHeight: 1.14,
          color: "rgba(255,255,255,0.6)",
          maxWidth: 480,
          margin: "0 auto 48px",
        }}>
          Phân loại tự động, biểu đồ rõ ràng, không cần spreadsheet.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          maxWidth: 800,
          margin: "0 auto",
        }}>
          {[
            { icon: "📊", title: "Báo cáo tháng", desc: "Xem tiền đi đâu trong 30 giây" },
            { icon: "🏷️", title: "Phân loại thông minh", desc: "Tự động gắn nhãn chi tiêu" },
            { icon: "🔒", title: "Chỉ mình bạn thấy", desc: "Dữ liệu lưu trên tài khoản riêng" },
          ].map((f) => (
            <div key={f.title} style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-lg)",
              textAlign: "left",
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{
                fontFamily: "var(--font-body)",
                fontSize: 17,
                fontWeight: 600,
                color: "var(--on-dark)",
                marginBottom: 6,
                letterSpacing: -0.374,
              }}>{f.title}</div>
              <div style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.43,
              }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{
        background: "var(--canvas-parchment)",
        padding: "var(--space-section) 22px",
        textAlign: "center",
      }}>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(28px, 5vw, 40px)",
          fontWeight: 600,
          lineHeight: 1.1,
          color: "var(--ink)",
          marginBottom: 32,
        }}>
          Bắt đầu ngay hôm nay.
        </h2>
        {!isPending && !session && (
          <button
            className="btn-primary"
            onClick={() => signInWithGoogle().catch(console.error)}
          >
            <GoogleIcon />
            Đăng nhập miễn phí với Google
          </button>
        )}
        {!isPending && session && (
          <a href="/dashboard" className="btn-primary">Vào Dashboard →</a>
        )}
      </section>
    </main>
  );
}
