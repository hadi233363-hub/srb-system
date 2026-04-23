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

  // On mobile the sidebar drawer is triggered by a fixed hamburger button that
  // sits in the top corner. Add horizontal padding matching the button size so
  // the topbar content doesn't slide under it.
  const mobilePadClass = locale === "ar" ? "pe-14 md:pe-6" : "ps-14 md:ps-6";

  return (
    <header
      className={`flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/30 pe-4 ps-4 py-3 md:pe-6 md:ps-6 ${mobilePadClass}`}
    >
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 text-emerald-400" />
        <span className="font-semibold text-zinc-100">{companyName}</span>
        <span className="hidden text-zinc-700 sm:inline">·</span>
        <span className="hidden text-zinc-500 sm:inline">
          {translate("brand.system", locale)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-[11px] text-zinc-500 md:block">
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
