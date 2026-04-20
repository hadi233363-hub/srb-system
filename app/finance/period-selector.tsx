"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Period } from "@/lib/db/finance-calc";
import { useT } from "@/lib/i18n/client";

const PERIODS: { value: Period; labelKey: string }[] = [
  { value: "week", labelKey: "finance.period.week" },
  { value: "month", labelKey: "finance.period.month" },
  { value: "quarter", labelKey: "finance.period.quarter" },
  { value: "year", labelKey: "finance.period.year" },
];

export function PeriodSelector({ current }: { current: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();

  const go = (p: Period) => {
    const params = new URLSearchParams();
    params.set("period", p);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1 w-fit">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => go(p.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs transition",
            current === p.value
              ? "bg-emerald-500/15 text-emerald-400"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          )}
        >
          {t(p.labelKey)}
        </button>
      ))}
    </div>
  );
}
