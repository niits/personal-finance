"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Tổng quan", icon: "◎" },
  { href: "/dashboard/categories", label: "Danh mục", icon: "⊞" },
  { href: "/dashboard/budget", label: "Ngân sách", icon: "◈" },
  { href: "/dashboard/transactions", label: "Giao dịch", icon: "≡" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: "100svh", background: "var(--canvas-parchment)", paddingTop: 44 }}>
      <main style={{ paddingBottom: 72 }}>
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 72,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderTop: "1px solid var(--hairline)",
        display: "flex",
        alignItems: "flex-start",
        paddingTop: 8,
        zIndex: 50,
      }}>
        {tabs.map((tab) => {
          const active = tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                textDecoration: "none",
                color: active ? "var(--primary)" : "var(--ink-muted-48)",
                transition: "color 0.15s",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontFamily: "var(--font-body)",
                fontSize: 10,
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
