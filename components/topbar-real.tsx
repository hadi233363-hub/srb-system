// Top bar for real-mode. Renders company name, date, and language switcher.

import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { LanguageSwitcher } from "./language-switcher";

export async function TopbarReal() {
  const [settings, locale] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: 1 } }),
    getLocale(),
  ]);
  const companyName = settings?.companyName ?? "SRB";
  const dateLocale = locale === "ar" ? "ar-QA" : "en-US";

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/30 px-6 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 text-emerald-400" />
        <span className="font-semibold text-zinc-100">{companyName}</span>
        <span className="text-zinc-700">·</span>
        <span className="text-zinc-500">{translate("brand.system", locale)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-[11px] text-zinc-500 sm:block">
          {new Date().toLocaleDateString(dateLocale, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
