"use client";

import { useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useSim } from "../sim-provider";
import { KpiCard } from "../kpi-card";
import { DonutChart } from "../charts/donut-chart";
import { formatQAR, formatRelativeSim } from "@/lib/format";
import { PROJECT_TYPE_LABELS } from "@/lib/sim/data";
import type { Project, ProjectStatus } from "@/lib/sim/types";
import { cn } from "@/lib/cn";

type Filter = "all" | "urgent" | "delayed" | "at_risk" | "completed" | "failed";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "نشط",
  delayed: "متأخر",
  completed: "مكتمل",
  failed: "فاشل",
  cancelled: "ملغى",
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: "rgb(16 185 129)",
  delayed: "rgb(251 146 60)",
  completed: "rgb(59 130 246)",
  failed: "rgb(244 63 94)",
  cancelled: "rgb(113 113 122)",
};

function progressOf(p: Project): number {
  if (p.tasks.length === 0) return 0;
  const doneOrFailed = p.tasks.filter(
    (t) => t.status === "done" || t.status === "failed"
  ).length;
  return (doneOrFailed / p.tasks.length) * 100;
}

export function ProjectsPage() {
  const { state } = useSim();
  const [filter, setFilter] = useState<Filter>("all");

  const stats = useMemo(() => {
    if (!state) return null;
    const byStatus: Record<ProjectStatus, number> = {
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const p of state.projects) byStatus[p.status]++;
    const active = byStatus.active + byStatus.delayed;
    return { byStatus, active };
  }, [state]);

  const filtered = useMemo(() => {
    if (!state) return [];
    const now = state.simTime;
    let list = state.projects;
    switch (filter) {
      case "urgent":
        list = list.filter(
          (p) => p.priority === "urgent" && (p.status === "active" || p.status === "delayed")
        );
        break;
      case "delayed":
        list = list.filter((p) => p.status === "delayed");
        break;
      case "at_risk":
        list = list.filter(
          (p) =>
            (p.status === "active" || p.status === "delayed") &&
            (p.tasks.filter((t) => t.status === "failed").length > 0 ||
              p.crisisCount > 0 ||
              (p.deadline - now) / (24 * 60 * 60 * 1000) < 3 ||
              p.actualCost / Math.max(1, p.costEstimate) > 1.15)
        );
        break;
      case "completed":
        list = list.filter((p) => p.status === "completed");
        break;
      case "failed":
        list = list.filter((p) => p.status === "failed");
        break;
      default:
        break;
    }
    return [...list].sort((a, b) => {
      const prio =
        (b.priority === "urgent" ? 1 : 0) - (a.priority === "urgent" ? 1 : 0);
      if (prio !== 0) return prio;
      return b.createdAt - a.createdAt;
    });
  }, [state, filter]);

  if (!state || !stats) {
    return <div className="text-sm text-zinc-500">يحمّل...</div>;
  }

  const { byStatus, active } = stats;

  const donutSlices = (Object.keys(byStatus) as ProjectStatus[])
    .filter((k) => byStatus[k] > 0 && k !== "cancelled")
    .map((k) => ({
      label: STATUS_LABELS[k],
      value: byStatus[k],
      color: STATUS_COLORS[k],
    }));

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "الكل", count: state.projects.length },
    { key: "urgent", label: "عاجل ⚡", count: state.projects.filter(
      (p) => p.priority === "urgent" && (p.status === "active" || p.status === "delayed")
    ).length },
    { key: "delayed", label: "متأخر", count: byStatus.delayed },
    { key: "at_risk", label: "في خطر" },
    { key: "completed", label: "مكتمل", count: byStatus.completed },
    { key: "failed", label: "فاشل", count: byStatus.failed },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المشاريع</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {state.projects.length} مشروع · يتحدث تلقائياً
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="نشطة"
          value={String(active)}
          sublabel={
            byStatus.delayed > 0
              ? `${byStatus.delayed} متأخرة ⚠`
              : "الكل على الوقت"
          }
          icon={ActivityIcon}
          tone={byStatus.delayed > 0 ? "negative" : "positive"}
        />
        <KpiCard
          label="مكتملة"
          value={String(byStatus.completed)}
          sublabel="تم تسليمها للعميل"
          icon={CheckCircle2}
          tone="positive"
        />
        <KpiCard
          label="فاشلة"
          value={String(byStatus.failed)}
          sublabel={
            byStatus.completed > 0
              ? `معدل نجاح ${Math.round(
                  (byStatus.completed / (byStatus.completed + byStatus.failed)) * 100
                )}%`
              : "—"
          }
          icon={XCircle}
          tone={byStatus.failed > 0 ? "negative" : "default"}
        />
        <KpiCard
          label="الأزمات"
          value={String(state.counters.crisesHandled)}
          sublabel="منذ بداية المحاكاة"
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">توزيع الحالات</h3>
          {donutSlices.length > 0 ? (
            <DonutChart
              slices={donutSlices}
              centerLabel="الإجمالي"
              centerValue={String(state.projects.length)}
            />
          ) : (
            <p className="text-sm text-zinc-600">لا مشاريع بعد</p>
          )}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-3">
          <h3 className="mb-4 text-sm font-semibold">مؤشرات الصحة</h3>
          <ul className="space-y-4 text-sm">
            <HealthRow
              label="معدل النجاح"
              value={
                byStatus.completed + byStatus.failed > 0
                  ? (byStatus.completed / (byStatus.completed + byStatus.failed)) * 100
                  : 0
              }
              unit="%"
              good={(v) => v >= 70}
            />
            <HealthRow
              label="نسبة المتأخرة"
              value={active > 0 ? (byStatus.delayed / active) * 100 : 0}
              unit="%"
              good={(v) => v <= 20}
              invert
            />
            <HealthRow
              label="تجاوز متوسط للميزانية"
              value={
                state.projects.filter((p) => p.actualCost > 0).length > 0
                  ? (state.projects
                      .filter((p) => p.actualCost > 0)
                      .reduce(
                        (s, p) => s + p.actualCost / Math.max(1, p.costEstimate),
                        0
                      ) /
                      state.projects.filter((p) => p.actualCost > 0).length -
                      1) *
                    100
                  : 0
              }
              unit="%"
              good={(v) => v <= 10}
              invert
            />
            <HealthRow
              label="إجمالي الأزمات"
              value={state.counters.crisesHandled}
              unit=""
              good={(v) => v < 5}
              invert
            />
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
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
              {typeof f.count === "number" && (
                <span className="mr-1.5 tabular-nums text-zinc-600">
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-600">
            ما فيه مشاريع تطابق هذا الفلتر
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} simTime={state.simTime} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthRow({
  label,
  value,
  unit,
  good,
  invert = false,
}: {
  label: string;
  value: number;
  unit: string;
  good: (v: number) => boolean;
  invert?: boolean;
}) {
  const isGood = good(value);
  const color = isGood
    ? "text-emerald-400"
    : invert
    ? "text-rose-400"
    : "text-amber-400";
  return (
    <li className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className={cn("font-semibold tabular-nums", color)}>
        {typeof value === "number" ? value.toFixed(unit === "%" ? 0 : 0) : value}
        {unit}
      </span>
    </li>
  );
}

function ProjectCard({ project, simTime }: { project: Project; simTime: number }) {
  const progress = progressOf(project);
  const pending = project.tasks.filter(
    (t) => t.status !== "done" && t.status !== "failed"
  ).length;
  const done = project.tasks.filter((t) => t.status === "done").length;
  const failed = project.tasks.filter((t) => t.status === "failed").length;
  const hoursToDeadline = (project.deadline - simTime) / (60 * 60 * 1000);
  const overrun = project.actualCost / Math.max(1, project.costEstimate);

  const statusBadge = (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px]",
        project.status === "active" && "bg-emerald-500/10 text-emerald-400",
        project.status === "delayed" && "bg-amber-500/10 text-amber-400",
        project.status === "completed" && "bg-blue-500/10 text-blue-400",
        project.status === "failed" && "bg-rose-500/10 text-rose-400",
        project.status === "cancelled" && "bg-zinc-800 text-zinc-500"
      )}
    >
      {STATUS_LABELS[project.status]}
    </span>
  );

  return (
    <div
      className={cn(
        "rounded-xl border bg-zinc-900/40 p-4 transition",
        project.priority === "urgent"
          ? "border-rose-900/40 hover:border-rose-800/60"
          : "border-zinc-800 hover:border-zinc-700"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {statusBadge}
            {project.priority === "urgent" && (
              <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400">
                عاجل ⚡
              </span>
            )}
            <span className="text-[10px] text-zinc-600">
              {PROJECT_TYPE_LABELS[project.type]}
            </span>
          </div>
          <div className="mt-1.5 truncate text-sm font-medium text-zinc-200">
            {project.title}
          </div>
          <div className="text-xs text-zinc-500">{project.client}</div>
        </div>
        <div className="shrink-0 text-left">
          <div className="text-sm font-semibold tabular-nums text-zinc-200">
            {formatQAR(project.budget)}
          </div>
          {project.status === "active" || project.status === "delayed" ? (
            <div className={cn(
              "text-xs tabular-nums",
              hoursToDeadline < 0
                ? "text-rose-400"
                : hoursToDeadline < 48
                ? "text-amber-400"
                : "text-zinc-500"
            )}>
              {hoursToDeadline < 0
                ? `متأخر ${Math.abs(Math.floor(hoursToDeadline / 24))}ي`
                : `${Math.floor(hoursToDeadline / 24)}ي متبقية`}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">
              {project.completedAt && formatRelativeSim(project.completedAt, simTime)}
            </div>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={cn(
              "h-full transition-all duration-500",
              project.status === "failed"
                ? "bg-rose-500"
                : project.status === "completed"
                ? "bg-blue-500"
                : "bg-emerald-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="tabular-nums text-zinc-500">{progress.toFixed(0)}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-zinc-400">
          {done}/{project.tasks.length} مهمة
        </span>
        {failed > 0 && (
          <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-400">
            {failed} فشل
          </span>
        )}
        {pending > 0 && project.status !== "completed" && project.status !== "failed" && (
          <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-zinc-500">
            {pending} معلّقة
          </span>
        )}
        {project.scopeChanges > 0 && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
            نطاق +{project.scopeChanges}
          </span>
        )}
        {project.clientRevisions > 0 && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
            مراجعات ×{project.clientRevisions}
          </span>
        )}
        {project.crisisCount > 0 && (
          <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-400">
            {project.crisisCount} أزمة
          </span>
        )}
        {overrun > 1.15 && (
          <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-400">
            تجاوز {Math.round((overrun - 1) * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}
