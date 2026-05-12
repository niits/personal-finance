"use client";

import { useSession, signInWithGoogle, signOut } from "@/lib/auth-client";

const GoogleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" fill="#34A853"/>
    <path d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
  </svg>
);

export default function Navbar() {
  const { data: session, isPending } = useSession();

  return (
    <nav style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      height: 44,
      background: "var(--surface-black)",
      display: "flex",
      alignItems: "center",
      padding: "0 22px",
      justifyContent: "space-between",
    }}>
      <span style={{
        color: "var(--on-dark)",
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: -0.2,
      }}>
        Finance
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {isPending ? null : session ? (
          <>
            <span style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              fontFamily: "var(--font-body)",
            }}>
              {session.user.name || session.user.email}
            </span>
            <button
              onClick={async () => {
                await signOut();
                window.location.href = "/";
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--primary-on-dark)",
                fontFamily: "var(--font-body)",
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 0",
                letterSpacing: -0.12,
              }}
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <button
            onClick={() => signInWithGoogle().catch((e) => console.error(e))}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              color: "var(--primary-on-dark)",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              cursor: "pointer",
              padding: "4px 0",
              letterSpacing: -0.12,
            }}
          >
            <GoogleIcon /> Đăng nhập
          </button>
        )}
      </div>
    </nav>
  );
}
