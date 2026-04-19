"use client";

import { useSim } from "../sim-provider";
import { formatQAR, formatRelativeSim } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { DecisionRecord } from "@/lib/sim/types";

export function DecisionLog() {
  const { state } = useSim();
  if (!state) return null;

  const records = state.decisionLog.slice(0, 15);

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-600">
        ما اتخذت قرارات بعد · انتظر سيناريو أو اضغط على زر "فرصة مبيعات"
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-800/60 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      {records.map((r) => (
        <DecisionRow key={r.id} record={r} simTime={state.simTime} />
      ))}
    </ul>
  );
}

function DecisionRow({ record, simTime }: { record: DecisionRecord; simTime: number }) {
  const expectedHappened = record.actualOutcomes.filter((o) => o.happened).length;
  const positiveHappened = record.actualOutcomes.filter(
    (o) => o.happened && o.tone === "positive"
  ).length;
  const negativeHappened = record.actualOutcomes.filter(
    (o) => o.happened && o.tone === "negative"
  ).length;

  const net = positiveHappened - negativeHappened;
  const summaryColor =
    net > 0 ? "text-emerald-400" : net < 0 ? "text-rose-400" : "text-zinc-400";

  return (
    <li className="px-5 py-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-zinc-300">{record.scenarioTitle}</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            القرار: <span className="text-zinc-300">{record.chosenLabel}</span>
          </div>
        </div>
        <div className="shrink-0 text-left">
          <div className={cn("text-sm font-semibold", summaryColor)}>
            {record.summary}
          </div>
          <div className="text-xs text-zinc-600 tabular-nums">
            {formatRelativeSim(record.at, simTime)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 items-center gap-3 rounded-md bg-zinc-950/60 p-2.5">
        <div className="flex flex-wrap gap-1">
          {record.actualOutcomes.map((o, i) => (
            <span
              key={i}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px]",
                o.happened
                  ? o.tone === "positive"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : o.tone === "negative"
                    ? "bg-rose-500/10 text-rose-400"
                    : "bg-zinc-700/50 text-zinc-300"
                  : "bg-zinc-800/40 text-zinc-600 line-through"
              )}
              title={o.happened ? "حصل" : "ما حصل"}
            >
              {o.label}
            </span>
          ))}
        </div>
        {record.financialImpact !== 0 && (
          <div className="text-left">
            <div className="text-[10px] text-zinc-500">الأثر المالي الفعلي</div>
            <div
              className={cn(
                "tabular-nums text-sm font-semibold",
                record.financialImpact >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {formatQAR(record.financialImpact, true)}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
