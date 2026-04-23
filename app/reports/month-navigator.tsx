"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";

interface Props {
  year: number;
  month: number; // 1..12
  label: string;
  hasNext: boolean;
  availableMonths: { year: number; month: number; label: string }[];
}

export function MonthNavigator({ year, month, label, hasNext, availableMonths }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = useT();

  const go = (y: number, m: number) => {
    const mm = String(m).padStart(2, "0");
    router.push(`${pathname}?month=${y}-${mm}`);
  };

  const prev = () => {
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() - 1);
    go(d.getFullYear(), d.getMonth() + 1);
  };
  const next = () => {
    if (!hasNext) return;
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() + 1);
    go(d.getFullYear(), d.getMonth() + 1);
  };

  // In RTL, ChevronLeft visually points right — use them for prev/next based on locale.
  const PrevIcon = locale === "ar" ? ChevronRight : ChevronLeft;
  const NextIcon = locale === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
        <button
          onClick={prev}
          className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          title={t("reports.prevMonth")}
        >
          <PrevIcon className="h-4 w-4" />
        </button>
        <div className="min-w-[140px] px-3 py-1 text-center text-sm font-semibold text-zinc-100">
          {label}
        </div>
        <button
          onClick={next}
          disabled={!hasNext}
          className={cn(
            "rounded-md p-1.5 transition",
            hasNext
              ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              : "cursor-not-allowed text-zinc-700"
          )}
          title={t("reports.nextMonth")}
        >
          <NextIcon className="h-4 w-4" />
        </button>
      </div>

      <select
        value={`${year}-${String(month).padStart(2, "0")}`}
        onChange={(e) => {
          const [y, m] = e.target.value.split("-").map(Number);
          go(y, m);
        }}
        className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 outline-none transition hover:border-zinc-700 focus:border-emerald-500/50"
      >
        {availableMonths.map((m) => (
          <option key={`${m.year}-${m.month}`} value={`${m.year}-${String(m.month).padStart(2, "0")}`}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
