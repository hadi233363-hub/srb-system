import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { TopbarReal } from "@/components/topbar-real";
import { PendingGate } from "@/components/pending-gate";
import { MeetingReminder } from "@/components/meeting-reminder";
import { InvoiceReminder } from "@/components/invoice-reminder";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { getUserOverrides } from "@/lib/db/permissions";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SRB — Internal Management",
  description: "SRB internal management system",
  manifest: "/manifest.json",
  applicationName: "SRB",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SRB",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
  // viewportFit=cover tells iOS to render under the notch/safe-area so we can
  // position the hamburger + drawer correctly via env(safe-area-inset-*).
  viewportFit: "cover" as const,
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale, settings] = await Promise.all([
    auth(),
    getLocale(),
    prisma.appSetting.findUnique({ where: { id: 1 } }).catch(() => null),
  ]);
  const user = session?.user;
  const userOverrides = user?.id ? await getUserOverrides(user.id) : [];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isActive = user?.active === true;

  const brand = settings?.brandColor ?? "#10b981";
  const accent = settings?.accentColor ?? "#0ea5e9";
  const themeStyle: CSSProperties = {
    "--color-brand": brand,
    "--color-brand-dim": hexToRgba(brand, 0.1),
    "--color-brand-border": hexToRgba(brand, 0.3),
    "--color-accent": accent,
    "--color-accent-dim": hexToRgba(accent, 0.1),
  } as CSSProperties;

  return (
    <html lang={locale} dir={dir} className={cairo.variable} style={themeStyle}>
      <body className="min-h-dvh bg-zinc-950 text-zinc-50 antialiased">
        <LocaleProvider locale={locale}>
          {user ? (
            isActive ? (
              <div className="flex min-h-dvh">
                <Sidebar
                  userRole={user.role}
                  userName={user.name ?? user.email ?? "User"}
                  userEmail={user.email ?? ""}
                  logoPath={settings?.logoPath ?? "/srb-logo-white.png"}
                  overrides={userOverrides}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <TopbarReal />
                  {/*
                    Bottom-nav clearance: pad the main scrolling area so the
                    last item isn't trapped under the 64px bottom-nav on
                    mobile. md: removes the padding once the sidebar takes
                    over.
                  */}
                  <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
                    {children}
                  </main>
                </div>
                {/* Mobile bottom nav — visible <md only. */}
                <MobileBottomNav
                  role={user.role}
                  hasExtraPerms={userOverrides.some((o) => o.allowed)}
                />
                {/* Background reminder pollers — fire desktop notifications. */}
                <MeetingReminder />
                <InvoiceReminder />
              </div>
            ) : (
              <PendingGate
                userName={user.name ?? user.email ?? "User"}
                userEmail={user.email ?? ""}
                wasPreviouslyApproved={user.approved === true}
              />
            )
          ) : (
            children
          )}
        </LocaleProvider>
      </body>
    </html>
  );
}
