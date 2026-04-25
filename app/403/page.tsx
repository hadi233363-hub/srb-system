// 403 — shown when an authed user hits a route the proxy reserves for admins.
// Public to the proxy (no auth-loop): listed in PUBLIC_PATHS so it renders
// regardless of role.

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

export default async function ForbiddenPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(key, locale);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
        <div className="space-y-1 border-b border-zinc-800 bg-gradient-to-b from-rose-950/30 to-zinc-900/40 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">
            {t("admin.denied.title")}
          </h1>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-zinc-400">{t("admin.denied.desc")}</p>
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-emerald-500/30 hover:text-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {locale === "ar" ? "رجوع للرئيسية" : "Back to home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
