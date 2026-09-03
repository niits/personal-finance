"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNavigation } from "@/components/organisms/BottomNavigation";

const iconClassName = "size-lg stroke-current";

const tabs = [
  {
    href: "/",
    label: "Tổng quan",
    matches: ["/"],
    icon: <svg viewBox="0 0 24 24" fill="none" className={iconClassName}><path d="M4 11.5 12 5l8 6.5V20H4v-8.5Z" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9.5 20v-5h5v5" strokeWidth="1.8" /></svg>,
  },
  {
    href: "/statistics",
    label: "Thống kê",
    matches: ["/statistics"],
    icon: <svg viewBox="0 0 24 24" fill="none" className={iconClassName}><path d="M5 19V9m7 10V5m7 14v-7" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  },
  {
    href: "/cards",
    label: "Tài chính",
    matches: ["/cards", "/debts"],
    icon: <svg viewBox="0 0 24 24" fill="none" className={iconClassName}><path d="M4 7.5h16v10H4z" strokeWidth="1.8" strokeLinejoin="round" /><path d="M7 14h4" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  },
  {
    href: "/account",
    label: "Tài khoản",
    matches: ["/account"],
    icon: <svg viewBox="0 0 24 24" fill="none" className={iconClassName}><circle cx="12" cy="8" r="3" strokeWidth="1.8" /><path d="M5.5 19c.8-3.1 3-4.7 6.5-4.7s5.7 1.6 6.5 4.7" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  },
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

  const destinations = tabs.map((tab) => ({
    ...tab,
    active: tab.matches.some((route) =>
      route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`),
    ),
  }));

  return (
    <div className="min-h-svh bg-canvas-parchment">
      <main className="pb-[calc(72px+env(safe-area-inset-bottom))]">{children}</main>
      <BottomNavigation destinations={destinations} />
    </div>
  );
}
