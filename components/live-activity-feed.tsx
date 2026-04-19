"use client";

import { cn } from "@/lib/cn";
import { useSim } from "./sim-provider";
import { formatRelativeSim } from "@/lib/format";
import type { ActivityKind } from "@/lib/sim/types";

const kindColor: Record<ActivityKind, string> = {
  info: "text-zinc-300",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-rose-400",
  decision: "text-violet-300",
};

const kindDot: Record<ActivityKind, string> = {
  info: "bg-zinc-600",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  decision: "bg-violet-500",
};

export function LiveActivityFeed() {
  const { state } = useSim();

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <h3 className="text-sm font-semibold">النشاط المباشر</h3>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          مباشر
        </div>
      </div>
      <ul className="max-h-[480px] divide-y divide-zinc-800/60 overflow-auto">
        {!state && (
          <li className="px-5 py-8 text-center text-sm text-zinc-600">
            ينتظر الأحداث...
          </li>
        )}
        {state?.activityLog.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-zinc-600">
            ما صار شي بعد
          </li>
        )}
        {state?.activityLog.map((e) => (
          <li
            key={e.id}
            className="animate-in fade-in slide-in-from-top-1 px-5 py-3 text-sm transition hover:bg-zinc-800/20 duration-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    kindDot[e.kind]
                  )}
                />
                <span className={cn("min-w-0", kindColor[e.kind])}>
                  <span className="text-zinc-500">{e.actor}: </span>
                  {e.message}
                </span>
              </div>
              <span className="shrink-0 text-xs text-zinc-600 tabular-nums">
                {state && formatRelativeSim(e.at, state.simTime)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
