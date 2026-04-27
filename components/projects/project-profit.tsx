// Owner-only project profit widget — costs / income / margin computed from
// the existing Transactions table. Intentionally pure presentation; the
// numbers are crunched server-side and passed in.

import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatQar } from "@/lib/db/helpers";

interface Props {
  totals: {
    income: number;
    expenses: number;
    net: number;
    marginPct: number | null; // null if income is 0 (margin undefined)
    transactionCount: number;
  };
  budgetQar: number;
  locale: "ar" | "en";
}

export function ProjectProfit({ totals, budgetQar, locale }: Props) {
  const isAr = locale === "ar";
  const netTone: "positive" | "danger" | "neutral" =
    totals.net > 0 ? "positive" : totals.net < 0 ? "danger" : "neutral";

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-amber-200">
            {isAr ? "ربحية المشروع (للرئيس فقط)" : "Project profit (Owner only)"}
          </h2>
        </div>
        <span className="text-[10px] text-amber-300/70">
          {totals.transactionCount}{" "}
          {isAr ? "معاملة مسجّلة" : "tracked transactions"}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={TrendingUp}
          label={isAr ? "الإيرادات" : "Income"}
          value={formatQar(totals.income, { locale })}
          tone="positive"
        />
        <Stat
          icon={TrendingDown}
          label={isAr ? "المصاريف" : "Expenses"}
          value={formatQar(totals.expenses, { locale })}
          tone="danger"
        />
        <Stat
          label={isAr ? "صافي الربح" : "Net profit"}
          value={formatQar(totals.net, { locale, sign: true })}
          tone={netTone}
          big
        />
        <Stat
          label={isAr ? "هامش الربح" : "Margin"}
          value={
            totals.marginPct === null
              ? "—"
              : `${totals.marginPct > 0 ? "+" : ""}${totals.marginPct.toFixed(1)}%`
          }
          tone={
            totals.marginPct === null
              ? "neutral"
              : totals.marginPct >= 0
              ? "positive"
              : "danger"
          }
        />
      </div>

      {budgetQar > 0 && (
        <div className="mt-3 text-[11px] text-amber-300/80">
          {isAr ? "الميزانية المتوقعة" : "Planned budget"}:{" "}
          <span className="font-semibold">{formatQar(budgetQar, { locale })}</span>
          {totals.income > 0 && (
            <>
              {" · "}
              {isAr ? "نسبة التحصيل" : "Collection"}:{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  totals.income >= budgetQar ? "text-emerald-300" : "text-amber-200"
                )}
              >
                {Math.round((totals.income / budgetQar) * 100)}%
              </span>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  big = false,
}: {
  icon?: typeof Wallet;
  label: string;
  value: string;
  tone: "positive" | "danger" | "neutral";
  big?: boolean;
}) {
  const t =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "danger"
      ? "text-rose-400"
      : "text-zinc-100";
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-amber-300/70">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-bold tabular-nums",
          big ? "text-base" : "text-sm",
          t
        )}
      >
        {value}
      </div>
    </div>
  );
}
