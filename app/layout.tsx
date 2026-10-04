import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/layout/AppProvider";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import { withBase } from "@/lib/basePath";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartDictation 智能默書",
  description: "SmartDictation 智能默書學習系統 — family dictation practice",
  applicationName: "SmartDictation",
  appleWebApp: {
    capable: true,
    title: "智能默書",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: withBase("/icons/icon-192.png"), sizes: "192x192", type: "image/png" }],
    apple: [{ url: withBase("/icons/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c2410c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-HK" data-theme="default" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <AppProvider>
          <AppShell>{children}</AppShell>
          <ServiceWorkerRegister />
        </AppProvider>
      </body>
    </html>
  );
}
