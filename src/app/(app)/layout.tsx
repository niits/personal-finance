"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LedgerProfileMode, LedgerProfileResponse } from "@/lib/ledger/contracts";

const tabs = [
  { href: "/", label: "Tổng quan", icon: "◎" },
  { href: "/statistics", label: "Thống kê", icon: "◑" },
  { href: "/debts", label: "Vị thế", icon: "◈" },
  { href: "/budget", label: "Ngân sách", icon: "⊟" },
  { href: "/account", label: "Tài khoản", icon: "◯" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<LedgerProfileMode | null>(null);

  // Listen for global 401 events dispatched by the fetcher (e.g. from SWR
  // revalidation) so we redirect even when the layout session is still truthy.
  useEffect(() => {
    const handle = () => router.replace("/sign-in");
    window.addEventListener("auth:expired", handle);
    return () => window.removeEventListener("auth:expired", handle);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const loadMode = () => {
      fetch("/api/ledger/profile")
        .then((response) => response.ok ? response.json() as Promise<LedgerProfileResponse> : null)
        .then((data) => { if (!cancelled && data) setMode(data.mode); })
        .catch(() => undefined);
    };
    loadMode();
    window.addEventListener("ledger:initialized", loadMode);
    return () => { cancelled = true; window.removeEventListener("ledger:initialized", loadMode); };
  }, []);

  const visibleTabs = mode === "ledger"
    ? tabs.filter((tab) => tab.href !== "/statistics")
    : tabs.filter((tab) => tab.href === "/" || tab.href === "/account");

  return (
    <div className="min-h-svh bg-canvas-parchment pt-11">
      <main className="pb-[calc(72px+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(72px+env(safe-area-inset-bottom))] items-start border-t border-hairline bg-canvas/90 pt-xs pb-[env(safe-area-inset-bottom)] backdrop-saturate-[1.8] backdrop-blur-[8px]">
        {visibleTabs.map((tab) => {
          const active = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-[3px] no-underline transition-colors ${
                active ? "text-primary" : "text-ink-muted-48"
              }`}
            >
              <span className="text-[20px] leading-none">{tab.icon}</span>
              <span className={`font-body text-[12px] tracking-[-0.12px] ${active ? "font-semibold" : "font-normal"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
