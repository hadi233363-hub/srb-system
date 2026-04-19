"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  TrendingDown,
  UserPlus,
} from "lucide-react";
import { useSim } from "../sim-provider";
import {
  computeAllDepartmentLoads,
  computeCompanyCapacity,
  type DepartmentLoad,
} from "@/lib/sim/capacity";
import { recommendHire } from "@/lib/sim/hiring-advisor";
import type { Role, Seniority } from "@/lib/sim/types";
import { cn } from "@/lib/cn";

const SEVERITY_META: Record<
  DepartmentLoad["severity"],
  { label: string; bar: string; dot: string; text: string }
> = {
  healthy: {
    label: "صحي",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-400",
  },
  busy: {
    label: "مشغول",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    text: "text-sky-400",
  },
  overloaded: {
    label: "محمّل زيادة",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-400",
  },
  critical: {
    label: "مختنق",
    bar: "bg-rose-500",
    dot: "bg-rose-500",
    text: "text-rose-400",
  },
};

const SENIORITY_LABEL: Record<Seniority, string> = {
  junior: "مبتدئ",
  mid: "متوسط",
  senior: "خبير",
};

interface Props {
  onOpenHire: (role?: Role, seniority?: Seniority) => void;
}

export function CapacityPanel({ onOpenHire }: Props) {
  const { state } = useSim();

  const loads = useMemo(
    () => (state ? computeAllDepartmentLoads(state) : []),
    [state]
  );
  const company = useMemo(
    () => (state ? computeCompanyCapacity(state) : null),
    [state]
  );
  const recommendation = useMemo(
    () => (state ? recommendHire(state) : null),
    [state]
  );

  if (!state || !company) {
    return (
      <div className="h-48 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
    );
  }

  const used = company.totalLoad;
  const total = company.totalCapacity;
  const utilPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const missed = state.counters.missedOpportunities ?? 0;

  return (
    <div className="space-y-4">
      {/* Company-wide capacity + missed opportunities */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Gauge className="h-4 w-4 text-emerald-400" />
                سعة الشركة الكلية
              </h4>
              <div className="mt-1 text-[11px] text-zinc-500">
                ساعات عمل فعّالة أسبوعياً
              </div>
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold tabular-nums text-zinc-100">
                {Math.round(used)} / {Math.round(total)}
              </div>
              <div className="text-[11px] text-zinc-500">استغلال {utilPct}%</div>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn(
                "h-full transition-all",
                utilPct < 70
                  ? "bg-emerald-500"
                  : utilPct < 90
                  ? "bg-amber-500"
                  : "bg-rose-500"
              )}
              style={{ width: `${utilPct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <MiniStat
              label="سعة متاحة"
              value={`${Math.max(0, Math.round(total - used))} س/أسبوع`}
              tone="positive"
            />
            <MiniStat
              label="متوسط backlog"
              value={`${company.avgBacklogWeeks.toFixed(1)} أسبوع`}
              tone="neutral"
            />
            <MiniStat
              label="أسوأ قسم"
              value={
                company.worstRole
                  ? `${company.worstBacklogWeeks.toFixed(1)} أسبوع`
                  : "—"
              }
              tone={
                company.worstBacklogWeeks > 2.5 ? "negative" : "neutral"
              }
            />
          </div>
        </div>

        {/* Recommendation card */}
        <RecommendationCard
          recommendation={recommendation}
          missedOpportunities={missed}
          onOpenHire={onOpenHire}
        />
      </div>

      {/* Per-department breakdown */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="border-b border-zinc-800 px-5 py-3">
          <h4 className="text-sm font-semibold text-zinc-100">
            السعة حسب الأقسام
          </h4>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            كل قسم: الموظفين، السعة الأسبوعية، والأسابيع المتراكمة من الشغل
          </div>
        </div>
        <ul className="divide-y divide-zinc-800/60">
          {loads.map((dept) => {
            const sev = SEVERITY_META[dept.severity];
            const utilPct = Math.min(100, Math.round(dept.utilization * 100));
            const showBacklog = dept.backlogWeeks > 0;
            return (
              <li
                key={dept.role}
                className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", sev.dot)} />
                    <span className="text-sm font-medium text-zinc-200">
                      {dept.roleLabel}
                    </span>
                    <span className={cn("text-[10px]", sev.text)}>
                      · {sev.label}
                    </span>
                    {dept.onboardingHeadcount > 0 && (
                      <span className="rounded-full border border-sky-900/40 bg-sky-950/30 px-1.5 py-0.5 text-[9px] text-sky-400">
                        {dept.onboardingHeadcount} في تأهيل
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {dept.headcount} موظف · {Math.round(dept.capacity)} س/أسبوع
                    {showBacklog && (
                      <span>
                        {" "}
                        · backlog {dept.backlogWeeks.toFixed(1)} أسبوع (
                        {Math.round(dept.load)} س)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:w-72">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={cn("h-full", sev.bar)}
                      style={{ width: `${utilPct}%` }}
                    />
                  </div>
                  <span className="w-12 text-left text-xs tabular-nums text-zinc-400">
                    {utilPct}%
                  </span>
                  {dept.severity === "overloaded" ||
                  dept.severity === "critical" ? (
                    <button
                      onClick={() => onOpenHire(dept.role)}
                      className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <UserPlus className="inline h-3 w-3 ml-1" />
                      وظّف
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
      ? "text-rose-400"
      : "text-zinc-200";
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  missedOpportunities,
  onOpenHire,
}: {
  recommendation: ReturnType<typeof recommendHire>;
  missedOpportunities: number;
  onOpenHire: (role?: Role, seniority?: Seniority) => void;
}) {
  if (!recommendation) {
    return (
      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-5">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          الفريق يغطي الحمل
        </h4>
        <p className="mt-1.5 text-xs text-emerald-500/80">
          ما فيه دافع عاجل للتوظيف — الاستغلال ضمن الآمن.
        </p>
        {missedOpportunities > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400">
            <TrendingDown className="h-3 w-3" />
            لكن ضاعت {missedOpportunities} فرصة سابقاً
          </div>
        )}
      </div>
    );
  }

  const { impact } = recommendation;
  const verdictColor =
    impact.verdict === "strongly_recommended"
      ? "rose"
      : impact.verdict === "recommended"
      ? "amber"
      : "zinc";

  const colors = {
    rose: "border-rose-500/40 bg-rose-500/5 text-rose-300",
    amber: "border-amber-500/40 bg-amber-500/5 text-amber-300",
    zinc: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
  }[verdictColor];

  return (
    <div className={cn("flex flex-col rounded-xl border p-5", colors)}>
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4" />
        توصية المدير
      </h4>
      <div className="mt-2 text-sm">
        وظّف <span className="font-bold">{SENIORITY_LABEL[recommendation.seniority]}</span>{" "}
        <span className="font-bold">{impact.roleLabel}</span>
      </div>
      <p className="mt-1.5 text-[11px] opacity-80">{impact.reason}</p>
      <div className="mt-3 space-y-1 text-[11px]">
        <div>سعة +{Math.round(impact.capacityDeltaPct)}%</div>
        <div>+{impact.additionalProjectsPerMonth.toFixed(1)} مشروع/شهر</div>
        <div>+{impact.monthlyRevenueGain.toLocaleString("en-US")} ر.ق إيراد متوقع/شهر</div>
        {impact.breakEvenMonths && (
          <div>Break-even: {impact.breakEvenMonths} شهور</div>
        )}
      </div>
      {missedOpportunities > 0 && (
        <div className="mt-3 text-[10px] opacity-70">
          فرص ضائعة بسبب السعة: {missedOpportunities}
        </div>
      )}
      <button
        onClick={() =>
          onOpenHire(recommendation.role, recommendation.seniority)
        }
        className="mt-auto mt-4 rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"
      >
        افتح تحليل التوظيف
      </button>
    </div>
  );
}
