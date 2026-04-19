"use client";

import { useMemo } from "react";
import { Award, Heart, TrendingUp, Users } from "lucide-react";
import { useSim } from "../sim-provider";
import { KpiCard } from "../kpi-card";
import { BarChart } from "../charts/bar-chart";
import { RadarChart } from "../charts/radar-chart";
import { ARCHETYPE_LABELS, ROLE_LABELS } from "@/lib/sim/data";
import type { Agent } from "@/lib/sim/types";
import { cn } from "@/lib/cn";
import { formatQAR } from "@/lib/format";

function performanceScore(a: Agent): number {
  const total = a.stats.tasksCompleted + a.stats.tasksFailed;
  if (total === 0) return 0;
  const successRate = a.stats.tasksCompleted / total;
  const moraleFactor = a.morale / 100;
  const volume = Math.min(a.stats.tasksCompleted, 30) / 30;
  return Math.round((successRate * 50 + moraleFactor * 20 + volume * 30) * 10) / 10;
}

const ARCHETYPE_COLORS: Record<string, string> = {
  efficient: "rgb(16 185 129)",
  lazy: "rgb(251 146 60)",
  perfectionist: "rgb(59 130 246)",
  burnout_prone: "rgb(244 63 94)",
  rookie: "rgb(113 113 122)",
  inconsistent: "rgb(168 85 247)",
};

export function TeamPage() {
  const { state } = useSim();

  const data = useMemo(() => {
    if (!state) return null;
    const active = state.agents.filter((a) => a.active);
    const working = active.filter((a) => a.status === "working").length;
    const absent = active.filter((a) => a.status === "absent").length;
    const totalCompleted = active.reduce((s, a) => s + a.stats.tasksCompleted, 0);
    const totalFailed = active.reduce((s, a) => s + a.stats.tasksFailed, 0);
    const avgMorale =
      active.reduce((s, a) => s + a.morale, 0) / Math.max(1, active.length);
    const totalSalary = active.reduce((s, a) => s + a.salaryMonthly, 0);
    const utilization = active.length > 0 ? (working / active.length) * 100 : 0;

    const ranked = [...state.agents]
      .map((a) => ({ agent: a, score: performanceScore(a) }))
      .sort((a, b) => b.score - a.score);

    return {
      active,
      working,
      absent,
      totalCompleted,
      totalFailed,
      avgMorale,
      totalSalary,
      utilization,
      ranked,
    };
  }, [state]);

  if (!state || !data) {
    return <div className="text-sm text-zinc-500">يحمّل...</div>;
  }

  const {
    active,
    totalCompleted,
    avgMorale,
    totalSalary,
    utilization,
    ranked,
  } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الفريق</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {active.length} موظف نشط · الرواتب الشهرية {formatQAR(totalSalary)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="الموظفون النشطون"
          value={String(active.length)}
          sublabel={
            state.counters.agentsQuit > 0
              ? `${state.counters.agentsQuit} استقال`
              : "الكل موجود"
          }
          icon={Users}
        />
        <KpiCard
          label="الاستغلال"
          value={`${utilization.toFixed(0)}%`}
          sublabel={`${data.working} شغّالين · ${data.absent} غايبين`}
          icon={TrendingUp}
          tone={utilization > 60 ? "positive" : "default"}
        />
        <KpiCard
          label="متوسط المعنويات"
          value={`${avgMorale.toFixed(0)}/100`}
          sublabel={
            avgMorale < 50
              ? "يحتاج رفع الروح المعنوية"
              : "أجواء زينة"
          }
          icon={Heart}
          tone={avgMorale < 50 ? "negative" : "positive"}
        />
        <KpiCard
          label="مهام منجزة"
          value={String(totalCompleted)}
          sublabel={
            data.totalFailed > 0
              ? `${data.totalFailed} فشل · ${Math.round(
                  (totalCompleted / (totalCompleted + data.totalFailed)) * 100
                )}% نجاح`
              : "صفر فشل"
          }
          icon={Award}
          tone="positive"
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">ترتيب الأداء</h3>
          <p className="text-xs text-zinc-500">
            النقاط = نسبة النجاح × 50 + المعنويات × 20 + الحجم × 30
          </p>
        </div>
        <BarChart
          rows={ranked.map((r) => ({
            label: r.agent.name,
            value: r.score,
            sublabel: `${r.agent.stats.tasksCompleted} ✓ · ${r.agent.stats.tasksFailed} ✗ · ${r.agent.stats.tasksReworked} ↺ · ${ROLE_LABELS[r.agent.role]}`,
            color: ARCHETYPE_COLORS[r.agent.archetype],
            accent: !r.agent.active,
          }))}
          valueFormat={(v) => v.toFixed(1)}
          maxOverride={100}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">بطاقات الموظفين</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.agents.map((a) => (
            <AgentDetailCard key={a.id} agent={a} simTime={state.simTime} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentDetailCard({ agent, simTime }: { agent: Agent; simTime: number }) {
  const traits = [
    { label: "سرعة", value: agent.traits.speed },
    { label: "دقة", value: agent.traits.accuracy },
    { label: "التزام", value: agent.traits.reliability },
    { label: "إبداع", value: agent.traits.creativity },
  ];

  const total = agent.stats.tasksCompleted + agent.stats.tasksFailed;
  const successRate = total > 0 ? (agent.stats.tasksCompleted / total) * 100 : 0;
  const moraleColor =
    agent.morale >= 70 ? "bg-emerald-500" : agent.morale >= 40 ? "bg-amber-500" : "bg-rose-500";

  const statusLabel =
    !agent.active
      ? "استقال"
      : agent.status === "absent"
      ? "غايب"
      : agent.status === "working"
      ? "شغّال"
      : agent.status === "blocked"
      ? "عالق"
      : "فاضي";

  const statusColor =
    !agent.active
      ? "bg-zinc-700 text-zinc-500"
      : agent.status === "absent"
      ? "bg-amber-500/10 text-amber-400"
      : agent.status === "working"
      ? "bg-emerald-500/10 text-emerald-400"
      : "bg-zinc-800 text-zinc-400";

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700",
        !agent.active && "opacity-60"
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-medium"
          style={{
            background: `${ARCHETYPE_COLORS[agent.archetype]}22`,
            color: ARCHETYPE_COLORS[agent.archetype],
          }}
        >
          {agent.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-zinc-100">{agent.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span>{ROLE_LABELS[agent.role]}</span>
            <span className="text-zinc-700">·</span>
            <span style={{ color: ARCHETYPE_COLORS[agent.archetype] }}>
              {ARCHETYPE_LABELS[agent.archetype]}
            </span>
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px]", statusColor)}>
          {statusLabel}
        </span>
      </div>

      <RadarChart
        data={traits}
        size={160}
        color={ARCHETYPE_COLORS[agent.archetype]}
      />

      <div className="mt-3 space-y-2.5">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">المعنويات</span>
            <span className="tabular-nums text-zinc-400">{agent.morale}/100</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn("h-full transition-all duration-500", moraleColor)}
              style={{ width: `${agent.morale}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md bg-zinc-950/60 p-2.5 text-center">
          <div>
            <div className="text-[9px] text-zinc-500">مكتملة</div>
            <div className="text-sm font-semibold tabular-nums text-emerald-400">
              {agent.stats.tasksCompleted}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-500">فاشلة</div>
            <div className="text-sm font-semibold tabular-nums text-rose-400">
              {agent.stats.tasksFailed}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-500">نسبة النجاح</div>
            <div className="text-sm font-semibold tabular-nums text-zinc-300">
              {total > 0 ? `${successRate.toFixed(0)}%` : "—"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>راتب</span>
          <span className="tabular-nums">{formatQAR(agent.salaryMonthly)}/شهر</span>
        </div>
      </div>
    </div>
  );
}
