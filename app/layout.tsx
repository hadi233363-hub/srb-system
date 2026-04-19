import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { LiveTopbar } from "@/components/live-topbar";
import { SimProvider } from "@/components/sim-provider";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SRB — محاكاة الشركة",
  description: "نظام محاكاة داخلي لوكالة التسويق SRB",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        <SimProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <LiveTopbar />
              <main className="flex-1 overflow-auto p-6">{children}</main>
            </div>
          </div>
        </SimProvider>
      </body>
    </html>
  );
}
