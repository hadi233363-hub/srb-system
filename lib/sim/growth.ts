// Growth analytics — makes the hiring → capacity → projects → revenue chain measurable.
//
// The simulator keeps historical transactions + agent.hiredAt + project.createdAt.
// We derive windowed deltas and a simple bottleneck diagnosis from those.

import type { Agent, SimState } from "./types";
import {
  SENIORITY_CAPACITY_MULT,
  computeCompanyCapacity,
} from "./capacity";

const MS_DAY = 24 * 60 * 60 * 1000;

export type Bottleneck =
  | "team"        // not hiring enough
  | "capacity"    // hired but productivity not materializing (onboarding)
  | "projects"    // capacity built but no new work coming in
  | "revenue"     // projects accepted but not converting
  | "profitability" // revenue growing slower than payroll (overhire)
  | "none";       // healthy chain

export interface GrowthStats {
  windowDays: number;

  // Raw window counts
  teamNow: number;
  teamThen: number;
  hiresInWindow: number;

  capacityNow: number;      // hrs/week today
  capacityThen: number;     // hrs/week ~windowDays ago (approx)

  projectsAcceptedInWindow: number;
  projectsAcceptedPrev: number;
  projectsCompletedInWindow: number;

  revenueInWindow: number;
  revenuePrev: number;

  payrollInWindow: number;
  payrollPrev: number;

  netInWindow: number;
  netPrev: number;

  missedInWindow: number;   // approx — missed counter is cumulative; we use total for now

  // Deltas (%)
  teamDeltaPct: number;
  capacityDeltaPct: number;
  projectsDeltaPct: number;
  revenueDeltaPct: number;
  payrollDeltaPct: number;
  netDeltaPct: number;

  // Derived metrics
  /** Revenue per hr of weekly capacity (how well capacity converts to money). */
  revenuePerCapacityHour: number;
  /** Delta revenue / delta payroll. >1 = healthy growth, <1 = overhire. */
  hireROI: number | null;
  /** "Pipeline pressure" — project acceptance rate vs capacity available. */
  intakeConversion: number; // 0..1+

  // Diagnosis
  bottleneck: Bottleneck;
  bottleneckReason: string;
  narrative: string;
}

function pctDelta(now: number, then: number): number {
  if (then === 0) return now > 0 ? 100 : 0;
  return ((now - then) / then) * 100;
}

function sumTx(
  state: SimState,
  kinds: string[] | "income" | "expense",
  fromTime: number,
  toTime: number = Infinity
): number {
  let total = 0;
  for (const tx of state.transactions) {
    if (tx.at < fromTime || tx.at >= toTime) continue;
    if (kinds === "income") {
      if (tx.amount > 0) total += tx.amount;
    } else if (kinds === "expense") {
      if (tx.amount < 0) total += Math.abs(tx.amount);
    } else if (Array.isArray(kinds) && kinds.includes(tx.kind)) {
      total += Math.abs(tx.amount);
    }
  }
  return total;
}

/** Approximate capacity at a past point in time, assuming agents hired by then were ramped. */
function approximateCapacityAt(state: SimState, time: number): number {
  let cap = 0;
  for (const agent of state.agents) {
    if (agent.hiredAt > time) continue;
    if (!agent.active) continue; // approximation: assume current-active were active then
    const sen = agent.seniority ?? "mid";
    const speed = agent.traits.speed / 100;
    // Assume they were ramped by `time` if they had enough runway.
    cap += 40 * SENIORITY_CAPACITY_MULT[sen] * speed;
  }
  return cap;
}

export function computeGrowthStats(
  state: SimState,
  windowDays: number = 30
): GrowthStats {
  const now = state.simTime;
  const windowStart = now - windowDays * MS_DAY;
  const prevStart = now - 2 * windowDays * MS_DAY;

  const activeAgents = state.agents.filter((a) => a.active);
  const teamNow = activeAgents.length;
  const teamThen = state.agents.filter(
    (a) => a.hiredAt < windowStart && a.active
  ).length;
  const hiresInWindow = state.agents.filter((a) => a.hiredAt >= windowStart).length;

  const capNow = computeCompanyCapacity(state);
  const capacityNow = capNow.totalCapacity;
  const capacityThen = approximateCapacityAt(state, windowStart);

  const projectsAcceptedInWindow = state.projects.filter(
    (p) => p.createdAt >= windowStart
  ).length;
  const projectsAcceptedPrev = state.projects.filter(
    (p) => p.createdAt >= prevStart && p.createdAt < windowStart
  ).length;
  const projectsCompletedInWindow = state.projects.filter(
    (p) =>
      p.status === "completed" &&
      p.completedAt !== null &&
      p.completedAt >= windowStart
  ).length;

  const revenueInWindow = sumTx(state, "income", windowStart, now);
  const revenuePrev = sumTx(state, "income", prevStart, windowStart);

  const payrollKinds = ["salary", "bonus", "hiring_cost", "severance"];
  const payrollInWindow = sumTx(state, payrollKinds, windowStart, now);
  const payrollPrev = sumTx(state, payrollKinds, prevStart, windowStart);

  const expenseInWindow = sumTx(state, "expense", windowStart, now);
  const expensePrev = sumTx(state, "expense", prevStart, windowStart);
  const netInWindow = revenueInWindow - expenseInWindow;
  const netPrev = revenuePrev - expensePrev;

  // Deltas
  const teamDeltaPct = pctDelta(teamNow, teamThen);
  const capacityDeltaPct = pctDelta(capacityNow, capacityThen);
  const projectsDeltaPct = pctDelta(projectsAcceptedInWindow, projectsAcceptedPrev);
  const revenueDeltaPct = pctDelta(revenueInWindow, revenuePrev);
  const payrollDeltaPct = pctDelta(payrollInWindow, payrollPrev);
  const netDeltaPct = pctDelta(netInWindow, netPrev);

  const revenuePerCapacityHour =
    capacityNow > 0 ? revenueInWindow / (capacityNow * (windowDays / 7)) : 0;

  const revenueDelta = revenueInWindow - revenuePrev;
  const payrollDelta = payrollInWindow - payrollPrev;
  const hireROI =
    payrollDelta > 0 ? revenueDelta / payrollDelta : null;

  const intakeConversion =
    capacityThen > 0
      ? projectsAcceptedInWindow / (capacityThen / 40)
      : projectsAcceptedInWindow;

  // Diagnose bottleneck — walk the chain, find where growth drops.
  let bottleneck: Bottleneck = "none";
  let bottleneckReason = "";

  // Profitability check first (most important)
  if (hiresInWindow > 0 && revenueDeltaPct < payrollDeltaPct - 10) {
    bottleneck = "profitability";
    bottleneckReason = `الرواتب +${Math.round(payrollDeltaPct)}% لكن الإيراد +${Math.round(revenueDeltaPct)}% فقط`;
  } else if (
    hiresInWindow > 0 &&
    capacityDeltaPct < teamDeltaPct / 2 &&
    teamDeltaPct > 10
  ) {
    bottleneck = "capacity";
    bottleneckReason = `الفريق +${Math.round(teamDeltaPct)}% لكن السعة +${Math.round(capacityDeltaPct)}% فقط (onboarding لسا ما اكتمل)`;
  } else if (
    capacityDeltaPct > 15 &&
    projectsDeltaPct < capacityDeltaPct - 10 &&
    state.counters.missedOpportunities > 0
  ) {
    bottleneck = "projects";
    bottleneckReason = `سعة +${Math.round(capacityDeltaPct)}% لكن المشاريع +${Math.round(projectsDeltaPct)}% — فرص ضائعة`;
  } else if (
    projectsDeltaPct > 10 &&
    revenueDeltaPct < projectsDeltaPct - 10
  ) {
    bottleneck = "revenue";
    bottleneckReason = `مشاريع +${Math.round(projectsDeltaPct)}% لكن الإيراد +${Math.round(revenueDeltaPct)}% — جودة التنفيذ`;
  } else if (teamDeltaPct === 0 && capNow.worstBacklogWeeks > 2.5) {
    bottleneck = "team";
    bottleneckReason = `الفريق ثابت والـ backlog ${capNow.worstBacklogWeeks.toFixed(1)} أسبوع — وقت التوظيف`;
  }

  // Narrative
  let narrative: string;
  if (bottleneck === "none") {
    if (hiresInWindow > 0 && revenueDeltaPct > 10) {
      narrative = `النمو صحي · وظفت ${hiresInWindow} في ${windowDays} يوم والإيراد +${Math.round(revenueDeltaPct)}%.`;
    } else if (hiresInWindow === 0 && revenueDeltaPct > 0) {
      narrative = `ثابت — الفريق الحالي يشتغل بكفاءة.`;
    } else {
      narrative = `حركة عادية · لا فيه نمو واضح ولا خطر.`;
    }
  } else if (bottleneck === "profitability") {
    narrative = `⚠ الربحية تنضغط · التوظيف الجديد ما عاد يغطي تكلفته بعد. انتظر قبل توظيف ثاني.`;
  } else if (bottleneck === "capacity") {
    narrative = `الموظفين الجدد لسا في onboarding · السعة الفعلية أقل من المتوقع. صبر ${windowDays} يوم.`;
  } else if (bottleneck === "projects") {
    narrative = `عندك سعة زائدة لكن الفرص ما تكفي · سوّق أكثر أو خفف التوظيف.`;
  } else if (bottleneck === "revenue") {
    narrative = `المشاريع تتقبل لكن التسليم مب كامل · راجع جودة الفريق والمشاريع المفشلة.`;
  } else {
    narrative = `الفريق ثابت والضغط عالي · التوظيف يفتح السد.`;
  }

  return {
    windowDays,
    teamNow,
    teamThen,
    hiresInWindow,
    capacityNow,
    capacityThen,
    projectsAcceptedInWindow,
    projectsAcceptedPrev,
    projectsCompletedInWindow,
    revenueInWindow,
    revenuePrev,
    payrollInWindow,
    payrollPrev,
    netInWindow,
    netPrev,
    missedInWindow: state.counters.missedOpportunities ?? 0,
    teamDeltaPct,
    capacityDeltaPct,
    projectsDeltaPct,
    revenueDeltaPct,
    payrollDeltaPct,
    netDeltaPct,
    revenuePerCapacityHour,
    hireROI,
    intakeConversion,
    bottleneck,
    bottleneckReason,
    narrative,
  };
}
