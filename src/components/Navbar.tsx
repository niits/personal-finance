"use client";

import { useSession, signIn, signOut } from "@/lib/auth-client";

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
      {/* Logo */}
      <span style={{
        color: "var(--on-dark)",
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: -0.2,
      }}>
        Finance
      </span>

      {/* Auth controls */}
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
              onClick={() => signOut()}
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
            onClick={() => signIn.social({ provider: "github", callbackURL: "/" })}
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
            Đăng nhập
          </button>
        )}
      </div>
    </nav>
  );
}
