// 404 — Next.js renders this for any route that doesn't match.
// Outside the proxy's RBAC layer, so we don't reveal whether a route is
// admin-only vs. truly missing — the 403 redirect handles the former.

import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";

export default async function NotFound() {
  const locale = await getLocale();
  const isAr = locale === "ar";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
        <div className="space-y-1 border-b border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400">
            <Compass className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">404</h1>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-zinc-400">
            {isAr ? "الصفحة اللي تدور عليها مو موجودة." : "The page you’re looking for doesn’t exist."}
          </p>
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-emerald-500/30 hover:text-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {isAr ? "رجوع للرئيسية" : "Back to home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
