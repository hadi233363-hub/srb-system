"use client";

import { useMemo } from "react";
import { useSim } from "../sim-provider";
import { formatQAR, formatPercent } from "@/lib/format";
import type { SimState } from "@/lib/sim/types";
import { cn } from "@/lib/cn";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface PeriodReport {
  label: string;
  days: number;
  revenue: number;
  expenses: number;
  net: number;
  projectsCompleted: number;
  projectsFailed: number;
  decisionsMade: number;
  crisesHandled: number;
  tasksCompleted: number;
  tasksFailed: number;
}

function periodReport(state: SimState, days: number, label: string): PeriodReport {
  const now = state.simTime;
  const start = now - days * MS_PER_DAY;
  let revenue = 0;
  let expenses = 0;
  for (const tx of state.transactions) {
    if (tx.at < start) continue;
    if (tx.amount > 0) revenue += tx.amount;
    else expenses += Math.abs(tx.amount);
  }
  const projectsCompleted = state.projects.filter(
    (p) => p.status === "completed" && (p.completedAt ?? 0) >= start
  ).length;
  const projectsFailed = state.projects.filter(
    (p) => p.status === "failed" && (p.completedAt ?? 0) >= start
  ).length;
  const decisionsMade = state.decisionLog.filter((d) => d.at >= start).length;
  const tasksCompleted = state.agents.reduce((s, a) => s + a.stats.tasksCompleted, 0);
  const tasksFailed = state.agents.reduce((s, a) => s + a.stats.tasksFailed, 0);

  return {
    label,
    days,
    revenue,
    expenses,
    net: revenue - expenses,
    projectsCompleted,
    projectsFailed,
    decisionsMade,
    crisesHandled: state.counters.crisesHandled,
    tasksCompleted,
    tasksFailed,
  };
}

export function ReportsPage() {
  const { state } = useSim();

  const reports = useMemo(() => {
    if (!state) return null;
    return {
      daily: periodReport(state, 1, "آخر 24 ساعة"),
      weekly: periodReport(state, 7, "آخر أسبوع"),
      monthly: periodReport(state, 30, "آخر شهر"),
    };
  }, [state]);

  const insights = useMemo(() => {
    if (!state) return [];
    const items: { title: string; body: string; tone: "positive" | "negative" | "neutral" }[] = [];

    const active = state.agents.filter((a) => a.active);
    const avgMorale = active.length
      ? active.reduce((s, a) => s + a.morale, 0) / active.length
      : 100;
    if (avgMorale < 50) {
      items.push({
        title: "معنويات الفريق منخفضة",
        body: `متوسط ${avgMorale.toFixed(0)}/100 · فكر في بونص أو يوم ترفيهي`,
        tone: "negative",
      });
    }

    const delayed = state.projects.filter((p) => p.status === "delayed").length;
    if (delayed >= 2) {
      items.push({
        title: `${delayed} مشاريع متأخرة`,
        body: "الأولوية تتعلق بتعيين موارد إضافية أو تفاوض مع العملاء",
        tone: "negative",
      });
    }

    if (state.counters.agentsQuit > 0) {
      items.push({
        title: `استقال ${state.counters.agentsQuit} موظف`,
        body: "راجع أسلوب الحفاظ على المواهب",
        tone: "negative",
      });
    }

    const successRate =
      state.counters.projectsCompleted + state.counters.projectsFailed > 0
        ? state.counters.projectsCompleted /
          (state.counters.projectsCompleted + state.counters.projectsFailed)
        : 1;
    if (successRate >= 0.8) {
      items.push({
        title: "معدل نجاح ممتاز",
        body: `${Math.round(successRate * 100)}% من المشاريع تُسلّم بنجاح`,
        tone: "positive",
      });
    }

    if (state.counters.decisionsMade === 0 && state.scenarios.length > 0) {
      items.push({
        title: "سيناريوهات معلّقة بدون قرار",
        body: "ادخل غرفة القرارات واتخذ إجراء قبل ما تنتهي الفرصة",
        tone: "negative",
      });
    }

    if (items.length === 0) {
      items.push({
        title: "كل المؤشرات طبيعية",
        body: "الشركة في وضع صحي · استمر في المراقبة",
        tone: "positive",
      });
    }

    return items;
  }, [state]);

  if (!state || !reports) {
    return <div className="text-sm text-zinc-500">يحمّل...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">التقارير</h1>
        <p className="mt-1 text-sm text-zinc-500">
          ملخصات أداء يومية وأسبوعية وشهرية
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ReportCard report={reports.daily} />
        <ReportCard report={reports.weekly} />
        <ReportCard report={reports.monthly} />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="mb-4 text-lg font-semibold">أبرز الملاحظات</h2>
        <ul className="space-y-3">
          {insights.map((ins, i) => (
            <li
              key={i}
              className={cn(
                "rounded-lg border p-4",
                ins.tone === "positive" && "border-emerald-900/40 bg-emerald-950/20",
                ins.tone === "negative" && "border-rose-900/40 bg-rose-950/20",
                ins.tone === "neutral" && "border-zinc-800 bg-zinc-900/30"
              )}
            >
              <div className={cn(
                "text-sm font-semibold",
                ins.tone === "positive" && "text-emerald-400",
                ins.tone === "negative" && "text-rose-400",
                ins.tone === "neutral" && "text-zinc-300"
              )}>
                {ins.title}
              </div>
              <div className="mt-1 text-sm text-zinc-400">{ins.body}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="mb-4 text-lg font-semibold">سجل الإجراءات المباشرة</h2>
        {state.actionLog.length === 0 ? (
          <p className="text-sm text-zinc-600">ما نفّذت إجراءات بعد</p>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {state.actionLog.slice(0, 20).map((a) => (
              <li key={a.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <div className="text-zinc-200">{a.label}</div>
                    {a.note && <div className="text-xs text-zinc-500">{a.note}</div>}
                  </div>
                  {a.financialImpact !== 0 && (
                    <div
                      className={cn(
                        "shrink-0 tabular-nums",
                        a.financialImpact >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {formatQAR(a.financialImpact, true)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: PeriodReport }) {
  const margin = report.revenue > 0 ? (report.net / report.revenue) * 100 : 0;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="mb-4 text-sm font-semibold">{report.label}</h3>
      <div className="space-y-3 text-sm">
        <Row label="إيرادات" value={formatQAR(report.revenue)} color="text-emerald-400" />
        <Row label="مصروفات" value={formatQAR(report.expenses)} color="text-rose-400" />
        <Row
          label="صافي"
          value={formatQAR(report.net, true)}
          color={report.net >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}
        />
        <Row
          label="هامش"
          value={formatPercent(margin, 0)}
          color={margin >= 0 ? "text-zinc-300" : "text-rose-400"}
        />
        <div className="my-3 border-t border-zinc-800" />
        <Row label="مشاريع مكتملة" value={String(report.projectsCompleted)} />
        <Row label="مشاريع فاشلة" value={String(report.projectsFailed)} color={report.projectsFailed > 0 ? "text-rose-400" : undefined} />
        <Row label="قرارات متخذة" value={String(report.decisionsMade)} color="text-emerald-400" />
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("tabular-nums", color ?? "text-zinc-300")}>{value}</span>
    </div>
  );
}
