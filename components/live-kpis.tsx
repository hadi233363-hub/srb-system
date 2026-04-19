"use client";

import {
  Briefcase,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useSim } from "./sim-provider";
import { KpiCard } from "./kpi-card";
import { formatQAR, formatPercent } from "@/lib/format";

const MS_30D = 30 * 24 * 60 * 60 * 1000;

export function LiveKpis() {
  const { state } = useSim();

  if (!state) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[110px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>
    );
  }

  const cutoff = state.simTime - MS_30D;
  let revenue = 0;
  let expenses = 0;
  for (const tx of state.transactions) {
    if (tx.at < cutoff) continue;
    if (tx.amount > 0) revenue += tx.amount;
    else expenses += Math.abs(tx.amount);
  }
  const net = revenue - expenses;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;

  const activeProjects = state.projects.filter(
    (p) => p.status === "active" || p.status === "delayed"
  );
  const delayedCount = activeProjects.filter(
    (p) => p.status === "delayed"
  ).length;

  const working = state.agents.filter((a) => a.status === "working").length;
  const utilization = (working / state.agents.length) * 100;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        label="الإيرادات (30 يوم)"
        value={formatQAR(revenue)}
        sublabel={`${state.counters.projectsCompleted} مشروع مسلّم`}
        icon={TrendingUp}
        tone="positive"
      />
      <KpiCard
        label="المصروفات (30 يوم)"
        value={formatQAR(expenses)}
        sublabel="رواتب + أدوات + عامة"
        icon={TrendingDown}
      />
      <KpiCard
        label="صافي الربح"
        value={formatQAR(net, true)}
        sublabel={`هامش ${formatPercent(margin, 0)}`}
        icon={DollarSign}
        tone={net >= 0 ? "positive" : "negative"}
      />
      <KpiCard
        label="المشاريع"
        value={String(activeProjects.length)}
        sublabel={
          delayedCount > 0
            ? `${delayedCount} متأخرة ⚠`
            : "كل شي على الوقت"
        }
        icon={Briefcase}
      />
      <KpiCard
        label="استغلال الفريق"
        value={formatPercent(utilization, 0)}
        sublabel={`${working} من ${state.agents.length} شغّالين`}
        icon={Users}
      />
    </div>
  );
}
