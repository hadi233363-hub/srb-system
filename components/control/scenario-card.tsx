"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DecisionChoice, Scenario, Urgency, RiskLevel } from "@/lib/sim/types";
import { formatQAR, formatRelativeSim } from "@/lib/format";
import { useSim } from "../sim-provider";

const urgencyMeta: Record<Urgency, { label: string; color: string; ring: string }> = {
  low: { label: "منخفض", color: "text-zinc-400", ring: "border-zinc-800" },
  medium: { label: "متوسط", color: "text-amber-400", ring: "border-amber-900/40" },
  high: { label: "عاجل", color: "text-rose-400", ring: "border-rose-900/50" },
};

const riskMeta: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: "منخفضة", color: "text-emerald-400 bg-emerald-500/10" },
  medium: { label: "متوسطة", color: "text-amber-400 bg-amber-500/10" },
  high: { label: "مرتفعة", color: "text-rose-400 bg-rose-500/10" },
  critical: { label: "حرجة", color: "text-rose-300 bg-rose-600/20" },
};

interface Props {
  scenario: Scenario;
  simTime: number;
}

export function ScenarioCard({ scenario, simTime }: Props) {
  const { decide } = useSim();
  const [expandedChoice, setExpandedChoice] = useState<string | null>(
    scenario.recommendedChoiceKey ?? scenario.choices[0]?.key ?? null
  );
  const [confirming, setConfirming] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hoursLeft = Math.max(0, Math.floor((scenario.expiresAt - simTime) / (60 * 60 * 1000)));
  const urgency = urgencyMeta[scenario.urgency];

  const onConfirm = async (choiceKey: string) => {
    setSubmitting(true);
    await decide(scenario.id, choiceKey);
    setSubmitting(false);
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-zinc-900/60 transition",
        urgency.ring,
        scenario.urgency === "high" && "shadow-[0_0_0_1px_rgba(244,63,94,0.2)]"
      )}
    >
      <div className="border-b border-zinc-800 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <AlertCircle className={cn("h-3.5 w-3.5", urgency.color)} />
              <span className={urgency.color}>{urgency.label}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-500">ينتهي خلال {hoursLeft}س</span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-zinc-100">
              {scenario.title}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">{scenario.description}</p>
            {scenario.reviewBullets && scenario.reviewBullets.length > 0 && (
              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
                  ملف الموظف
                </div>
                <ul className="grid grid-cols-1 gap-1.5 text-xs text-zinc-400 sm:grid-cols-2">
                  {scenario.reviewBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-700" />
                      <span className="min-w-0">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="divide-y divide-zinc-800/60">
        {scenario.choices.map((choice) => {
          const expanded = expandedChoice === choice.key;
          const isRecommended = scenario.recommendedChoiceKey === choice.key;
          return (
            <div key={choice.key}>
              <button
                onClick={() => setExpandedChoice(expanded ? null : choice.key)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-right transition hover:bg-zinc-800/20"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {isRecommended && (
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  )}
                  <span className="truncate text-sm text-zinc-200">
                    {choice.label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px]",
                      riskMeta[choice.riskLevel].color
                    )}
                  >
                    مخاطرة {riskMeta[choice.riskLevel].label}
                  </span>
                </div>
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                )}
              </button>

              {expanded && (
                <div className="space-y-4 bg-zinc-950/40 px-5 py-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                      <div>
                        <div className="text-[10px] text-zinc-500">رأي المدير</div>
                        <div className="mt-0.5 text-sm text-zinc-300">
                          {choice.managerOpinion}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] text-zinc-500">
                      النتائج المحتملة
                    </div>
                    <ul className="space-y-1.5">
                      {choice.probabilities.map((p, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <div className="w-10 shrink-0 text-left">
                            <span
                              className={cn(
                                "tabular-nums font-medium",
                                p.tone === "positive" && "text-emerald-400",
                                p.tone === "negative" && "text-rose-400",
                                p.tone === "neutral" && "text-zinc-400"
                              )}
                            >
                              {p.pct}%
                            </span>
                          </div>
                          <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={cn(
                                "h-full",
                                p.tone === "positive" && "bg-emerald-500/60",
                                p.tone === "negative" && "bg-rose-500/60",
                                p.tone === "neutral" && "bg-zinc-500/60"
                              )}
                              style={{ width: `${p.pct}%` }}
                            />
                          </div>
                          <span className="min-w-0 flex-1 text-zinc-400">
                            {p.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="text-[10px] text-zinc-500">الأثر المالي</div>
                      <div className="mt-1 font-semibold tabular-nums text-zinc-200">
                        {choice.financialImpact.min === 0 &&
                        choice.financialImpact.max === 0
                          ? "لا يوجد"
                          : `${formatQAR(choice.financialImpact.min, true)} → ${formatQAR(choice.financialImpact.max, true)}`}
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="text-[10px] text-zinc-500">الأثر على الفريق</div>
                      <div className="mt-1 text-zinc-200">{choice.teamImpact}</div>
                    </div>
                  </div>

                  {choice.alternativeHint && (
                    <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-300">
                      💡 {choice.alternativeHint}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {confirming === choice.key ? (
                      <>
                        <button
                          onClick={() => setConfirming(null)}
                          disabled={submitting}
                          className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800"
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={() => onConfirm(choice.key)}
                          disabled={submitting}
                          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
                        >
                          {submitting ? "يطبّق..." : "متأكد · نفذ القرار"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirming(choice.key)}
                        disabled={submitting}
                        className="rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                      >
                        اختر هذا الخيار
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function _timeLabel(at: number, now: number): string {
  return formatRelativeSim(at, now);
}
