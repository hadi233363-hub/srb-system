"use client";

import { useMemo } from "react";
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  DollarSign,
  Gauge,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useSim } from "../sim-provider";
import { computeGrowthStats, type Bottleneck } from "@/lib/sim/growth";
import { formatQAR } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Props {
  windowDays?: number;
}

export function GrowthFunnel({ windowDays = 30 }: Props) {
  const { state } = useSim();
  const stats = useMemo(
    () => (state ? computeGrowthStats(state, windowDays) : null),
    [state, windowDays]
  );

  if (!state || !stats) {
    return (
      <div className="h-44 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
    );
  }

  // Which stage, if any, is the bottleneck? We highlight the transition.
  const bottleneckStage = bottleneckToStage(stats.bottleneck);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Gauge className="h-4 w-4 text-emerald-400" />
            سلسلة النمو · آخر {windowDays} يوم
          </h4>
          <p className="mt-1 text-[11px] text-zinc-500">
            توظيف → سعة → مشاريع → إيراد · كل مرحلة تغذي اللي بعدها
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
          <InlineStat
            label="Hire ROI"
            value={
              stats.hireROI === null
                ? "—"
                : `${stats.hireROI.toFixed(2)}×`
            }
            tone={
              stats.hireROI === null
                ? "neutral"
                : stats.hireROI >= 1.5
                ? "positive"
                : stats.hireROI < 1
                ? "negative"
                : "neutral"
            }
            hint={
              stats.hireROI === null
                ? "ما توظّف في النافذة"
                : stats.hireROI >= 1
                ? "توظيف صحي"
                : "خسارة"
            }
          />
          <InlineStat
            label="فرص ضائعة"
            value={`${stats.missedInWindow}`}
            tone={stats.missedInWindow > 0 ? "negative" : "positive"}
            hint={
              stats.missedInWindow > 0 ? "محتاج سعة" : "قبلت كل الفرص"
            }
          />
          <InlineStat
            label="صافي الربح"
            value={formatQAR(stats.netInWindow, true)}
            tone={
              stats.netDeltaPct > 0
                ? "positive"
                : stats.netDeltaPct < 0
                ? "negative"
                : "neutral"
            }
            hint={`${formatDelta(stats.netDeltaPct)} عن الفترة السابقة`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
        <Stage
          icon={Users}
          label="الفريق"
          valueNow={String(stats.teamNow)}
          valueThen={String(stats.teamThen)}
          deltaPct={stats.teamDeltaPct}
          badge={
            stats.hiresInWindow > 0 ? `${stats.hiresInWindow}+` : undefined
          }
          isBottleneck={bottleneckStage === "team"}
        />
        <ArrowCell
          active={stats.capacityDeltaPct > 0}
          isBottleneck={bottleneckStage === "capacity"}
          label={
            stats.hiresInWindow > 0
              ? "onboarding"
              : stats.capacityDeltaPct === 0
              ? "ثابت"
              : ""
          }
        />
        <Stage
          icon={Gauge}
          label="السعة (س/أسبوع)"
          valueNow={`${Math.round(stats.capacityNow)}`}
          valueThen={`${Math.round(stats.capacityThen)}`}
          deltaPct={stats.capacityDeltaPct}
          isBottleneck={bottleneckStage === "capacity"}
        />
        <ArrowCell
          active={stats.projectsDeltaPct > 0}
          isBottleneck={bottleneckStage === "projects"}
          label={
            stats.missedInWindow > 0
              ? `${stats.missedInWindow} ضائعة`
              : "client intake"
          }
        />
        <Stage
          icon={Briefcase}
          label="مشاريع مقبولة"
          valueNow={String(stats.projectsAcceptedInWindow)}
          valueThen={String(stats.projectsAcceptedPrev)}
          deltaPct={stats.projectsDeltaPct}
          isBottleneck={bottleneckStage === "projects"}
        />
        <ArrowCell
          active={stats.revenueDeltaPct > 0}
          isBottleneck={bottleneckStage === "revenue"}
          label={
            stats.projectsCompletedInWindow > 0
              ? `${stats.projectsCompletedInWindow} سلّمت`
              : "execution"
          }
        />
        <Stage
          icon={DollarSign}
          label="الإيراد"
          valueNow={formatQAR(stats.revenueInWindow)}
          valueThen={formatQAR(stats.revenuePrev)}
          deltaPct={stats.revenueDeltaPct}
          isBottleneck={bottleneckStage === "revenue"}
        />
      </div>

      {/* Diagnosis banner */}
      <div
        className={cn(
          "mt-4 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
          stats.bottleneck === "none"
            ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-300"
            : stats.bottleneck === "profitability"
            ? "border-rose-500/40 bg-rose-500/5 text-rose-300"
            : "border-amber-500/30 bg-amber-500/5 text-amber-300"
        )}
      >
        {stats.bottleneck === "none" ? (
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
        ) : stats.bottleneck === "profitability" ? (
          <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div>
          <div className="font-semibold">{stats.narrative}</div>
          {stats.bottleneckReason && (
            <div className="mt-0.5 text-[11px] opacity-80">
              {stats.bottleneckReason}
            </div>
          )}
        </div>
      </div>

      {/* Payroll ratio footer */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-500 sm:grid-cols-4">
        <FooterStat
          label="الرواتب"
          value={formatQAR(stats.payrollInWindow)}
          delta={stats.payrollDeltaPct}
          invertTone
        />
        <FooterStat
          label="مشاريع مسلّمة"
          value={String(stats.projectsCompletedInWindow)}
          delta={null}
        />
        <FooterStat
          label="إيراد / ساعة سعة"
          value={formatQAR(stats.revenuePerCapacityHour)}
          delta={null}
        />
        <FooterStat
          label="تحويل الفرص"
          value={`${Math.round(stats.intakeConversion * 100)}%`}
          delta={null}
        />
      </div>
    </div>
  );
}

function Stage({
  icon: Icon,
  label,
  valueNow,
  valueThen,
  deltaPct,
  badge,
  isBottleneck,
}: {
  icon: LucideIcon;
  label: string;
  valueNow: string;
  valueThen: string;
  deltaPct: number;
  badge?: string;
  isBottleneck?: boolean;
}) {
  const deltaTone =
    deltaPct > 5
      ? "text-emerald-400"
      : deltaPct < -5
      ? "text-rose-400"
      : "text-zinc-500";

  return (
    <div
      className={cn(
        "rounded-lg border bg-zinc-950/40 p-3 lg:col-span-1",
        isBottleneck
          ? "border-rose-500/40 shadow-[0_0_0_1px_rgba(244,63,94,0.15)]"
          : "border-zinc-800"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-[10px] text-zinc-500">{label}</span>
        </div>
        {badge && (
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-400">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[10px] text-zinc-600 line-through tabular-nums">
          {valueThen}
        </span>
        <span className="text-sm font-bold tabular-nums text-zinc-100">
          {valueNow}
        </span>
      </div>
      <div className={cn("mt-0.5 text-[11px] tabular-nums", deltaTone)}>
        {formatDelta(deltaPct)}
      </div>
    </div>
  );
}

function ArrowCell({
  active,
  isBottleneck,
  label,
}: {
  active: boolean;
  isBottleneck?: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 lg:col-span-1">
      <ArrowLeft
        className={cn(
          "h-4 w-4 transition",
          isBottleneck
            ? "text-rose-400"
            : active
            ? "text-emerald-400"
            : "text-zinc-700"
        )}
      />
      {label && (
        <span
          className={cn(
            "text-[10px] text-center",
            isBottleneck ? "text-rose-400" : "text-zinc-600"
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function InlineStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  hint?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
      ? "text-rose-400"
      : "text-zinc-300";
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1.5">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", toneClass)}>
        {value}
      </div>
      {hint && <div className="text-[9px] text-zinc-600">{hint}</div>}
    </div>
  );
}

function FooterStat({
  label,
  value,
  delta,
  invertTone,
}: {
  label: string;
  value: string;
  delta: number | null;
  invertTone?: boolean;
}) {
  let tone: "positive" | "negative" | "neutral" = "neutral";
  if (delta !== null) {
    if (invertTone) {
      tone = delta > 5 ? "negative" : delta < -5 ? "positive" : "neutral";
    } else {
      tone = delta > 5 ? "positive" : delta < -5 ? "negative" : "neutral";
    }
  }
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
      ? "text-rose-400"
      : "text-zinc-400";
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-zinc-800/60 pt-2">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <span className={cn("tabular-nums", toneClass)}>{value}</span>
        {delta !== null && (
          <span className={cn("text-[10px] tabular-nums", toneClass)}>
            {formatDelta(delta)}
          </span>
        )}
      </span>
    </div>
  );
}

function formatDelta(pct: number): string {
  const rounded = Math.round(pct);
  if (rounded === 0) return "±0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function bottleneckToStage(
  b: Bottleneck
): "team" | "capacity" | "projects" | "revenue" | null {
  switch (b) {
    case "team":
      return "team";
    case "capacity":
      return "capacity";
    case "projects":
      return "projects";
    case "revenue":
      return "revenue";
    case "profitability":
      return "revenue"; // visually highlight revenue stage
    default:
      return null;
  }
}
