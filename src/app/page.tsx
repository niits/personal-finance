"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "@/lib/auth-client";

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session) {
      router.replace("/dashboard");
    }
  }, [session, isPending, router]);

  return (
    <main>
      {/* Hero — light canvas */}
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
              onClick={async () => {
                await signIn.social({ provider: "github", callbackURL: "/" });
              }}
            >
              <GitHubIcon />
              Đăng nhập với GitHub
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

      {/* Features — dark tile */}
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

      {/* CTA — parchment */}
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
            onClick={async () => {
              await signIn.social({ provider: "github", callbackURL: "/" });
            }}
          >
            <GitHubIcon />
            Đăng nhập miễn phí với GitHub
          </button>
        )}
        {!isPending && session && (
          <a href="/dashboard" className="btn-primary">Vào Dashboard →</a>
        )}
      </section>
    </main>
  );
}
