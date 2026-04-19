"use client";

import { useMemo, useState } from "react";
import { useSim } from "../sim-provider";
import { formatRelativeSim } from "@/lib/format";
import type { ActivityKind } from "@/lib/sim/types";
import { cn } from "@/lib/cn";

const kindFilters: { key: "all" | ActivityKind; label: string; color: string }[] = [
  { key: "all", label: "الكل", color: "text-zinc-400" },
  { key: "decision", label: "قرارات", color: "text-emerald-400" },
  { key: "success", label: "إنجازات", color: "text-emerald-400" },
  { key: "warning", label: "تحذيرات", color: "text-amber-400" },
  { key: "error", label: "فشل/أزمات", color: "text-rose-400" },
  { key: "info", label: "عام", color: "text-zinc-400" },
];

const kindDot: Record<ActivityKind, string> = {
  info: "bg-zinc-600",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  decision: "bg-emerald-400",
};

const kindTextColor: Record<ActivityKind, string> = {
  info: "text-zinc-300",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-rose-400",
  decision: "text-emerald-300",
};

export function ActivityPage() {
  const { state } = useSim();
  const [filter, setFilter] = useState<"all" | ActivityKind>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!state) return [];
    let list = state.activityLog;
    if (filter !== "all") list = list.filter((e) => e.kind === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q)
      );
    }
    return list;
  }, [state, filter, search]);

  if (!state) return <div className="text-sm text-zinc-500">يحمّل...</div>;

  const counts: Record<"all" | ActivityKind, number> = {
    all: state.activityLog.length,
    info: 0,
    success: 0,
    warning: 0,
    error: 0,
    decision: 0,
  };
  for (const e of state.activityLog) counts[e.kind]++;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">النشاط</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {state.activityLog.length} حدث · يتحدث مباشرة
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {kindFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                filter === f.key
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              )}
            >
              {f.label}
              <span className="mr-1.5 tabular-nums text-zinc-600">
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في الأحداث..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
        <ul className="divide-y divide-zinc-800/60">
          {filtered.length === 0 ? (
            <li className="px-5 py-12 text-center text-sm text-zinc-600">
              ما فيه أحداث تطابق
            </li>
          ) : (
            filtered.slice(0, 100).map((e) => (
              <li
                key={e.id}
                className="px-5 py-3 text-sm transition hover:bg-zinc-800/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        kindDot[e.kind]
                      )}
                    />
                    <span className={cn("min-w-0", kindTextColor[e.kind])}>
                      <span className="text-zinc-500">{e.actor}: </span>
                      {e.message}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-600 tabular-nums">
                    {formatRelativeSim(e.at, state.simTime)}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
        {filtered.length > 100 && (
          <div className="border-t border-zinc-800 px-5 py-2 text-center text-[11px] text-zinc-600">
            يعرض أول 100 حدث من {filtered.length}
          </div>
        )}
      </div>
    </div>
  );
}
