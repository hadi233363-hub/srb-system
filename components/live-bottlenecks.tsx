"use client";

import { useMemo } from "react";
import { useSim } from "./sim-provider";
import { detectBottlenecks, type Severity } from "@/lib/sim/insights";
import { cn } from "@/lib/cn";

const severityMeta: Record<Severity, { label: string; bar: string; text: string }> = {
  ok: { label: "تمام", bar: "bg-emerald-500/30", text: "text-emerald-500/70" },
  low: { label: "خفيف", bar: "bg-emerald-500/50", text: "text-emerald-400" },
  medium: { label: "متوسط", bar: "bg-amber-500", text: "text-amber-400" },
  high: { label: "مرتفع", bar: "bg-rose-500", text: "text-rose-400" },
  critical: { label: "حرج", bar: "bg-rose-600", text: "text-rose-300" },
};

export function LiveBottlenecks() {
  const { state } = useSim();

  const bottlenecks = useMemo(() => {
    if (!state) return [];
    return detectBottlenecks(state)
      .filter((b) => b.pendingTasks > 0)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5);
  }, [state]);

  if (!state) return null;

  if (bottlenecks.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h3 className="mb-2 text-sm font-semibold">اختناقات الفريق</h3>
        <p className="text-xs text-zinc-600">ما فيه ضغط على أي دور الحين.</p>
      </div>
    );
  }

  const worst = bottlenecks[0];
  const hasCritical = bottlenecks.some((b) => b.severity === "critical" || b.severity === "high");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border p-5",
        hasCritical
          ? "border-rose-900/40 bg-rose-950/20"
          : "border-zinc-800 bg-zinc-900/40"
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className={cn("text-sm font-semibold", hasCritical && "text-rose-300")}>
          اختناقات الفريق
        </h3>
        {hasCritical && (
          <span className="text-[10px] text-rose-400">⚠ يحتاج تدخل</span>
        )}
      </div>
      <ul className="space-y-3">
        {bottlenecks.map((b) => {
          const meta = severityMeta[b.severity];
          const displayRatio = Math.min(b.ratio, 5) / 5;
          return (
            <li key={b.role} className="text-sm">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-zinc-300">{b.roleLabel}</span>
                <span className={cn("text-xs", meta.text)}>{meta.label}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn("h-full transition-all duration-500", meta.bar)}
                  style={{ width: `${Math.max(displayRatio * 100, 8)}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="tabular-nums">
                  {b.pendingTasks} مهمة بانتظار · {b.availableAgents} موظف متاح
                </span>
                {b.urgentPendingTasks > 0 && (
                  <span className="text-rose-400">{b.urgentPendingTasks} عاجلة</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {worst.severity === "critical" && worst.availableAgents <= 1 && (
        <div className="mt-4 rounded-md border border-rose-900/40 bg-rose-950/30 p-3 text-xs text-rose-300">
          💡 يُقترح: توظيف {worst.roleLabel} إضافي — موظف واحد ما يكفي للضغط
          الحالي.
        </div>
      )}
    </div>
  );
}
