"use client";

import { useSession, signIn, signOut } from "@/lib/auth-client";

export function Navbar() {
  const { data: session, isPending } = useSession();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] h-11 bg-surface-black flex items-center justify-between px-[22px]">
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
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "var(--font-body)" }}>
              {session.user.name || session.user.email}
            </span>
            <button type="button"
              onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
              className="bg-transparent border-none text-primary-on-dark font-body text-xs cursor-pointer py-1 px-0 tracking-[-0.12px]"
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <button type="button"
            onClick={() => signIn.social({ provider: "github", callbackURL: "/" })}
            className="bg-transparent border-none text-primary-on-dark font-body text-xs cursor-pointer py-1 px-0 tracking-[-0.12px]"
          >
            Đăng nhập
          </button>
        )}
      </div>
    </nav>
  );
}
