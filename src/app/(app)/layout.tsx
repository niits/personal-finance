"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const tabs = [
  { href: "/", label: "Tổng quan", icon: "◎" },
  { href: "/statistics", label: "Thống kê", icon: "◑" },
  { href: "/debts", label: "Nợ", icon: "◈" },
  { href: "/budget", label: "Ngân sách", icon: "⊟" },
  { href: "/account", label: "Tài khoản", icon: "◯" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Listen for global 401 events dispatched by the fetcher (e.g. from SWR
  // revalidation) so we redirect even when the layout session is still truthy.
  useEffect(() => {
    const handle = () => router.replace("/sign-in");
    window.addEventListener("auth:expired", handle);
    return () => window.removeEventListener("auth:expired", handle);
  }, [router]);

  return (
    <div style={{ minHeight: "100svh", background: "var(--canvas-parchment)", paddingTop: 44 }}>
      <main style={{ paddingBottom: 72 }}>
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[72px] flex items-start pt-2 z-50 border-t border-hairline bg-white/[0.92] backdrop-saturate-[1.8] backdrop-blur-[8px]">
        {tabs.map((tab) => {
          const active = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-[3px] no-underline transition-colors ${
                active ? "text-primary" : "text-ink-muted-48"
              }`}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                letterSpacing: -0.12,
              }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
