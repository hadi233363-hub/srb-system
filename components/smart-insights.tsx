// Server component — renders the Smart Insights panel on the home page.
// Wraps lib/insights/smart-insights.ts for the UI. Locale-aware: picks the
// AR / EN text from each insight at render time.

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { computeSmartInsights, type SmartInsight } from "@/lib/insights/smart-insights";
import type { Role } from "@/lib/auth/roles";
import type { Locale } from "@/lib/i18n/dict";
import { translate } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";

interface Props {
  userRole: Role | undefined;
  locale: Locale;
}

const SEVERITY_ICON: Record<SmartInsight["severity"], LucideIcon> = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: Lightbulb,
  success: TrendingUp,
};

const SEVERITY_BORDER: Record<SmartInsight["severity"], string> = {
  danger: "border-rose-500/30 hover:border-rose-500/60",
  warning: "border-amber-500/30 hover:border-amber-500/60",
  info: "border-sky-500/30 hover:border-sky-500/60",
  success: "border-emerald-500/30 hover:border-emerald-500/60",
};

const SEVERITY_TEXT: Record<SmartInsight["severity"], string> = {
  danger: "text-rose-400",
  warning: "text-amber-400",
  info: "text-sky-400",
  success: "text-emerald-400",
};

export async function SmartInsightsPanel({ userRole, locale }: Props) {
  const insights = await computeSmartInsights(userRole);

  const t = (key: string) => translate(key, locale);

  // Hide the panel entirely if nothing actionable — the home page shouldn't
  // have a giant "all clear" block when there's nothing to surface.
  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4">
        <div className="flex items-center gap-2 text-sm text-emerald-300">
          <Sparkles className="h-4 w-4" />
          <span className="font-semibold">{t("insights.allClear.title")}</span>
        </div>
        <p className="mt-1 text-xs text-emerald-300/70">{t("insights.allClear.desc")}</p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-fuchsia-400" />
        <h2 className="text-sm font-semibold text-zinc-300">
          {t("insights.heading")}
        </h2>
        <span className="text-[10px] text-zinc-600">{t("insights.subheading")}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {insights.map((ins) => {
          const Icon = SEVERITY_ICON[ins.severity];
          const title = locale === "ar" ? ins.titleAr : ins.titleEn;
          const detail = locale === "ar" ? ins.detailAr : ins.detailEn;
          const card = (
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-zinc-900/40 p-3.5 transition",
                SEVERITY_BORDER[ins.severity]
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-950",
                  SEVERITY_TEXT[ins.severity]
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-100">{title}</div>
                <div className="mt-0.5 text-[11px] text-zinc-500">{detail}</div>
              </div>
              {ins.href && (
                <ArrowRight
                  className={cn(
                    "mt-1 h-3.5 w-3.5 shrink-0 opacity-50",
                    locale === "ar" && "rotate-180"
                  )}
                />
              )}
            </div>
          );
          return ins.href ? (
            <Link key={ins.key} href={ins.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={ins.key}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}
