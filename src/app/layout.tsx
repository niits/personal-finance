import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Personal Finance",
  description: "Track your spending, own your story.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Personal Finance",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <meta name="theme-color" content="#0066cc" />
      </head>
      <body>
        <Navbar />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
