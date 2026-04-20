import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopbarReal } from "@/components/topbar-real";
import { PendingGate } from "@/components/pending-gate";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SRB — Internal Management",
  description: "SRB internal management system",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const user = session?.user;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isActive = user?.active === true;

  return (
    <html lang={locale} dir={dir} className={cairo.variable}>
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        <LocaleProvider locale={locale}>
          {user ? (
            isActive ? (
              <div className="flex min-h-screen">
                <Sidebar
                  userRole={user.role}
                  userName={user.name ?? user.email ?? "User"}
                  userEmail={user.email ?? ""}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <TopbarReal />
                  <main className="flex-1 overflow-auto p-6">{children}</main>
                </div>
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
