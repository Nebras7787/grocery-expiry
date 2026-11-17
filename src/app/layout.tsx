import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import "@/lib/capacitor-init";
import { Providers } from "@/components/layout/Providers";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16a34a",
};

export const metadata: Metadata = {
  title: "مدير انتهاء الصلاحية",
  description: "تتبّع منتجات البقالة وتواريخ صلاحيتها، يعمل بدون إنترنت مع مزامنة تلقائية",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
      </head>
      <body className={`${cairo.className} min-h-screen bg-slate-50`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
