"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSim } from "../sim-provider";
import { ROLES, ROLE_LABELS } from "@/lib/sim/data";
import type { Role, Seniority } from "@/lib/sim/types";
import { analyzeHire } from "@/lib/sim/hiring-advisor";
import { computeGrowthStats } from "@/lib/sim/growth";
import { formatQAR } from "@/lib/format";
import { cn } from "@/lib/cn";

const SENIORITIES: Seniority[] = ["junior", "mid", "senior"];
const SENIORITY_LABEL: Record<Seniority, string> = {
  junior: "مبتدئ",
  mid: "متوسط",
  senior: "خبير",
};
const SENIORITY_BLURB: Record<Seniority, string> = {
  junior: "أقل راتب · يبدي بـ 40% إنتاجية · 60 يوم تأهيل",
  mid: "توازن كلفة/قيمة · يبدي بـ 65% · 21 يوم تأهيل",
  senior: "أعلى راتب · يبدي بـ 80% · 7 أيام تأهيل",
};

const VERDICT_META: Record<
  "strongly_recommended" | "recommended" | "neutral" | "not_advised",
  { label: string; wrapper: string; Icon: LucideIcon }
> = {
  strongly_recommended: {
    label: "مطلوب بشدة",
    wrapper: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    Icon: CheckCircle2,
  },
  recommended: {
    label: "موصى به",
    wrapper: "border-emerald-500/25 bg-emerald-500/5 text-emerald-400",
    Icon: CheckCircle2,
  },
  neutral: {
    label: "محايد",
    wrapper: "border-zinc-700 bg-zinc-800/30 text-zinc-300",
    Icon: AlertCircle,
  },
  not_advised: {
    label: "غير موصى به",
    wrapper: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    Icon: AlertTriangle,
  },
};

interface Props {
  initialRole?: Role;
  initialSeniority?: Seniority;
  onClose: () => void;
  onConfirmed: (message: string) => void;
}

export function HireDialog({
  initialRole,
  initialSeniority,
  onClose,
  onConfirmed,
}: Props) {
  const { state, action } = useSim();
  const [role, setRole] = useState<Role>(initialRole ?? "designer");
  const [seniority, setSeniority] = useState<Seniority>(
    initialSeniority ?? "mid"
  );
  const [busy, setBusy] = useState(false);

  const impact = useMemo(() => {
    if (!state) return null;
    return analyzeHire(state, role, seniority);
  }, [state, role, seniority]);

  const growth = useMemo(
    () => (state ? computeGrowthStats(state, 30) : null),
    [state]
  );

  if (!state || !impact || !growth) return null;

  const verdict = VERDICT_META[impact.verdict];
  const VerdictIcon = verdict.Icon;
  const hiringPaused = state.settings.hiringPaused;

  const confirm = async () => {
    if (hiringPaused) return;
    setBusy(true);
    const res = await action("hire", { role, seniority });
    setBusy(false);
    if (res.ok) {
      onConfirmed(res.message);
      onClose();
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <Users className="h-4 w-4 text-emerald-400" />
          تحليل قرار التوظيف
        </h4>
        <button
          onClick={onClose}
          className="rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Role + Seniority */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">الدور</label>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition",
                  role === r
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                )}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">المستوى</label>
          <div className="flex gap-1.5">
            {SENIORITIES.map((s) => (
              <button
                key={s}
                onClick={() => setSeniority(s)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition",
                  seniority === s
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                )}
              >
                {SENIORITY_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-[10px] text-zinc-500">
            {SENIORITY_BLURB[seniority]}
          </div>
        </div>
      </div>

      {/* Historical context */}
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-[11px] sm:grid-cols-4">
        <ContextCell
          label="وظفت (30 يوم)"
          value={`${growth.hiresInWindow}`}
        />
        <ContextCell
          label="الإيراد"
          value={formatQAR(growth.revenueInWindow)}
          delta={growth.revenueDeltaPct}
        />
        <ContextCell
          label="الرواتب"
          value={formatQAR(growth.payrollInWindow)}
          delta={growth.payrollDeltaPct}
          invertDeltaTone
        />
        <ContextCell
          label="Hire ROI"
          value={growth.hireROI === null ? "—" : `${growth.hireROI.toFixed(2)}×`}
          tone={
            growth.hireROI === null
              ? "neutral"
              : growth.hireROI >= 1
              ? "positive"
              : "negative"
          }
        />
      </div>

      {/* Verdict */}
      <div
        className={cn(
          "mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5",
          verdict.wrapper
        )}
      >
        <VerdictIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="text-xs font-semibold">
            توصية المدير: {verdict.label}
          </div>
          <div className="mt-0.5 text-xs opacity-90">{impact.reason}</div>
        </div>
      </div>

      {/* Impact grid */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ImpactCell
          icon={Users}
          label="سعة القسم (ساعات/أسبوع)"
          value={`${Math.round(impact.currentCapacity)} → ${Math.round(impact.projectedCapacityFull)}`}
          sub={`+${Math.round(impact.capacityDeltaPct)}% بعد التأهيل`}
          tone="neutral"
        />
        <ImpactCell
          icon={TrendingUp}
          label="Backlog (أسابيع)"
          value={`${impact.currentBacklogWeeks.toFixed(1)} → ${impact.projectedBacklogWeeks.toFixed(1)}`}
          sub={
            impact.projectedBacklogWeeks < impact.currentBacklogWeeks
              ? "الضغط ينخفض"
              : "لا يتأثر كثيراً"
          }
          tone={
            impact.projectedBacklogWeeks < impact.currentBacklogWeeks
              ? "positive"
              : "neutral"
          }
        />
        <ImpactCell
          icon={DollarSign}
          label="التكلفة الشهرية"
          value={`−${impact.monthlySalary.toLocaleString("en-US")} ر.ق`}
          sub={`مرة واحدة: ${impact.hiringCost.toLocaleString("en-US")} ر.ق`}
          tone="negative"
        />
        <ImpactCell
          icon={Calendar}
          label="Break-even"
          value={
            impact.breakEvenMonths
              ? `${impact.breakEvenMonths} شهور`
              : "بعيد/غير مجدٍ"
          }
          sub={
            impact.monthlyProfitGain > 0
              ? `ربح متوقع +${impact.monthlyProfitGain.toLocaleString("en-US")}/شهر`
              : "ما يغطي الراتب"
          }
          tone={impact.monthlyProfitGain > 0 ? "positive" : "negative"}
        />
      </div>

      {/* Revenue opp */}
      <div className="mb-4 rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-[11px] text-emerald-500/80">
              فرصة الإيراد الشهرية
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-emerald-400">
              +{formatQAR(impact.monthlyRevenueGain)}
            </div>
          </div>
          <div className="text-left">
            <div className="text-[11px] text-emerald-500/80">
              مشاريع إضافية متوقعة/شهر
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-zinc-200">
              +{impact.additionalProjectsPerMonth.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        {hiringPaused ? (
          <span className="text-xs text-amber-400">
            ⚠ التوظيف موقوف حالياً — شغّله من "الإجراءات المباشرة"
          </span>
        ) : (
          <span className="text-xs text-zinc-500">
            الاتفاق: راتب شهري متكرر + تكلفة توظيف لمرة واحدة
          </span>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800"
          >
            إلغاء
          </button>
          <button
            onClick={confirm}
            disabled={busy || hiringPaused}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "يوظف..." : `وظّف ${SENIORITY_LABEL[seniority]} ${ROLE_LABELS[role]}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextCell({
  label,
  value,
  delta,
  tone,
  invertDeltaTone,
}: {
  label: string;
  value: string;
  delta?: number;
  tone?: "positive" | "negative" | "neutral";
  invertDeltaTone?: boolean;
}) {
  const deltaTone =
    delta === undefined
      ? "neutral"
      : invertDeltaTone
      ? delta > 5
        ? "negative"
        : delta < -5
        ? "positive"
        : "neutral"
      : delta > 5
      ? "positive"
      : delta < -5
      ? "negative"
      : "neutral";
  const effectiveTone = tone ?? deltaTone;
  const toneClass =
    effectiveTone === "positive"
      ? "text-emerald-400"
      : effectiveTone === "negative"
      ? "text-rose-400"
      : "text-zinc-300";
  return (
    <div>
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-sm font-semibold tabular-nums", toneClass)}>
          {value}
        </span>
        {delta !== undefined && (
          <span className={cn("text-[10px] tabular-nums", toneClass)}>
            {delta > 0 ? "+" : ""}
            {Math.round(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

function ImpactCell({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
      ? "text-rose-400"
      : "text-zinc-200";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">{label}</span>
        <Icon className="h-3 w-3 text-zinc-600" />
      </div>
      <div
        className={cn("mt-1 text-sm font-semibold tabular-nums", toneClass)}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>
    </div>
  );
}
