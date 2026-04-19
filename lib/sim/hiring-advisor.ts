// Hiring advisor — analyzes the business impact of hiring a specific role+seniority.
// Considers capacity, financial health, revenue opportunity, break-even.

import type { Role, Seniority, SimState } from "./types";
import { BASE_SALARY_BY_ROLE, ROLE_LABELS } from "./data";
import {
  SENIORITY_CAPACITY_MULT,
  computeAllDepartmentLoads,
  computeCompanyCapacity,
  computeDepartmentLoad,
  type DepartmentLoad,
} from "./capacity";
import { computeCompanyHealth } from "./advisor";
import { computeGrowthStats } from "./growth";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Salary multipliers — must match actions.ts.
const SENIORITY_SALARY_MULT: Record<Seniority, number> = {
  junior: 0.75,
  mid: 1.0,
  senior: 1.4,
};

// Approximate task-hours each role delivers per typical project.
// Tuned from PROJECT_TEMPLATES in data.ts (roughly).
const AVG_PROJECT_HOURS_BY_ROLE: Record<Role, number> = {
  account_manager: 14,
  designer: 22,
  video_editor: 26,
  developer: 30,
  sales: 12,
};

// Average budget midpoint across project types (≈).
const AVG_PROJECT_BUDGET = 55_000;
const AVG_PROJECT_MARGIN = 0.45; // revenue × margin = profit per project

export type HiringVerdict =
  | "strongly_recommended"
  | "recommended"
  | "neutral"
  | "not_advised";

export interface HireImpact {
  role: Role;
  roleLabel: string;
  seniority: Seniority;

  // Costs
  hiringCost: number;
  monthlySalary: number;

  // Capacity
  currentCapacity: number;
  projectedCapacityNow: number; // new agent starts partially productive
  projectedCapacityFull: number; // after onboarding
  capacityDeltaPct: number;
  currentBacklogWeeks: number;
  projectedBacklogWeeks: number; // with new agent at full ramp
  currentUtilizationPct: number;
  projectedUtilizationPct: number;

  // Revenue opportunity
  additionalProjectsPerMonth: number;
  monthlyRevenueGain: number;
  monthlyProfitGain: number;

  // Break-even
  breakEvenMonths: number | null;

  // Verdict
  verdict: HiringVerdict;
  reason: string;
}

export function analyzeHire(
  state: SimState,
  role: Role,
  seniority: Seniority
): HireImpact {
  const load = computeDepartmentLoad(state, role);
  const health = computeCompanyHealth(state);

  const baseSalary = BASE_SALARY_BY_ROLE[role];
  const monthlySalary = Math.round(baseSalary * SENIORITY_SALARY_MULT[seniority]);
  const hiringCost = Math.round(monthlySalary * 0.5);

  // New agent's weekly contribution:
  // Assume "decent trait" speed ~ average of archetypes used for that seniority.
  // Approximation: junior 0.6, mid 0.75, senior 0.85 speed.
  const assumedSpeed =
    seniority === "junior" ? 0.6 : seniority === "senior" ? 0.85 : 0.75;
  const baseWeekly = 40 * SENIORITY_CAPACITY_MULT[seniority] * assumedSpeed;

  const initialProductivity =
    seniority === "junior" ? 0.4 : seniority === "senior" ? 0.8 : 0.65;

  const newAgentCapacityAtStart = baseWeekly * initialProductivity;
  const newAgentCapacityAtFull = baseWeekly;

  const projectedCapacityNow = load.capacity + newAgentCapacityAtStart;
  const projectedCapacityFull = load.capacity + newAgentCapacityAtFull;

  const capacityDeltaPct =
    load.capacity > 0
      ? (newAgentCapacityAtFull / load.capacity) * 100
      : 100;

  const currentBacklogWeeks = load.backlogWeeks;
  const projectedBacklogWeeks =
    projectedCapacityFull > 0 ? load.load / projectedCapacityFull : 0;

  const currentUtilizationPct = Math.round(load.utilization * 100);
  const projectedUtilizationPct = Math.round(
    Math.min(1, load.load / projectedCapacityFull) * 100
  );

  // Additional monthly projects this agent unlocks.
  // Weekly added hours → monthly (×4.33) → divide by hours-per-project-for-this-role.
  const monthlyAddedHours = newAgentCapacityAtFull * 4.33;
  const hoursPerProjectForRole = AVG_PROJECT_HOURS_BY_ROLE[role] ?? 18;

  // If this role is currently the bottleneck, each added hour directly
  // unlocks new throughput. Otherwise, another role is limiting and the
  // benefit is smaller.
  const isBottleneck = load.backlogWeeks > 2;
  const isOnePersonTeam = load.headcount <= 1;
  const bottleneckMultiplier = isBottleneck || isOnePersonTeam ? 1 : 0.35;

  const additionalProjectsPerMonth =
    (monthlyAddedHours / hoursPerProjectForRole) * bottleneckMultiplier;

  // Revenue estimate — use recent actual income if we have enough history.
  const recentIncome = state.transactions.filter((t) => t.kind === "income").slice(-8);
  const avgIncomePerProject =
    recentIncome.length >= 3
      ? recentIncome.reduce((s, t) => s + t.amount, 0) / recentIncome.length
      : AVG_PROJECT_BUDGET;

  const monthlyRevenueGain = Math.round(
    additionalProjectsPerMonth * avgIncomePerProject
  );
  const monthlyProfitGain = Math.round(
    monthlyRevenueGain * AVG_PROJECT_MARGIN - monthlySalary
  );

  const breakEvenMonths =
    monthlyProfitGain > 0
      ? Math.ceil((hiringCost + monthlySalary) / monthlyProfitGain)
      : null;

  // Verdict logic
  let verdict: HiringVerdict;
  let reason: string;

  const cantAffordNow = health.financialLabel === "خطر";

  // Check for profitability risk from recent hiring history.
  const growth = computeGrowthStats(state, 30);
  const recentOverhire =
    growth.hiresInWindow > 0 &&
    growth.hireROI !== null &&
    growth.hireROI < 1;
  const payrollOutpacing =
    growth.payrollDeltaPct > growth.revenueDeltaPct + 15 &&
    growth.hiresInWindow > 0;

  if (load.backlogWeeks > 3.5 && !cantAffordNow) {
    verdict = "strongly_recommended";
    reason = `قسم ${load.roleLabel} مختنق بـ ${load.backlogWeeks.toFixed(1)} أسبوع من الشغل — التوظيف ضروري.`;
  } else if (load.backlogWeeks > 2 && monthlyProfitGain > 0) {
    verdict = "recommended";
    reason = `قسم ${load.roleLabel} محمّل — التوظيف يفتح ${additionalProjectsPerMonth.toFixed(1)} مشروع إضافي شهرياً.`;
  } else if (load.backlogWeeks < 1 && monthlyProfitGain <= 0) {
    verdict = "not_advised";
    reason = `قسم ${load.roleLabel} فاضي (backlog ${load.backlogWeeks.toFixed(1)} أسبوع). التوظيف يضيف راتب بلا عائد.`;
  } else if (cantAffordNow) {
    verdict = "not_advised";
    reason = `الوضع المالي خطر — التوظيف الآن يضغط الـ runway.`;
  } else if (monthlyProfitGain > 0) {
    verdict = "neutral";
    reason = `التوظيف ممكن — لكن الحاجة مب حرجة. break-even بعد ${breakEvenMonths ?? "—"} شهور.`;
  } else {
    verdict = "neutral";
    reason = `قرار محايد — الأثر على الأرباح محدود.`;
  }

  // Profitability-risk override: if recent hires aren't paying off,
  // downgrade and append context.
  if (payrollOutpacing && verdict !== "not_advised") {
    verdict =
      verdict === "strongly_recommended" ? "neutral" : "not_advised";
    reason += ` ⚠ الرواتب تزيد (${Math.round(growth.payrollDeltaPct)}%) أسرع من الإيراد (${Math.round(growth.revenueDeltaPct)}%) — انتظر تستقر.`;
  } else if (recentOverhire && verdict === "recommended") {
    verdict = "neutral";
    reason += ` ⚠ آخر ${growth.hiresInWindow} توظيف ما غطّى تكلفته بعد (ROI ${growth.hireROI!.toFixed(2)}×).`;
  }

  return {
    role,
    roleLabel: ROLE_LABELS[role],
    seniority,
    hiringCost,
    monthlySalary,
    currentCapacity: load.capacity,
    projectedCapacityNow,
    projectedCapacityFull,
    capacityDeltaPct,
    currentBacklogWeeks,
    projectedBacklogWeeks,
    currentUtilizationPct,
    projectedUtilizationPct,
    additionalProjectsPerMonth,
    monthlyRevenueGain,
    monthlyProfitGain,
    breakEvenMonths,
    verdict,
    reason,
  };
}

export interface HiringRecommendation {
  role: Role;
  seniority: Seniority;
  impact: HireImpact;
}

/**
 * Pick the best role+seniority to hire next, or return null if no hire is warranted.
 * Considers: worst backlog, financial health.
 */
export function recommendHire(state: SimState): HiringRecommendation | null {
  const loads = computeAllDepartmentLoads(state);
  const health = computeCompanyHealth(state);
  if (loads.length === 0) return null;

  const worst = [...loads].sort((a, b) => b.backlogWeeks - a.backlogWeeks)[0];
  // No hire needed if even the worst is healthy
  if (worst.backlogWeeks < 1.3) return null;

  let seniority: Seniority;
  if (worst.backlogWeeks > 3.5 && health.financialScore > 0.4) seniority = "senior";
  else if (health.financialScore < 0.3) seniority = "junior";
  else if (worst.backlogWeeks > 2) seniority = "mid";
  else seniority = "junior";

  const impact = analyzeHire(state, worst.role, seniority);
  return { role: worst.role, seniority, impact };
}

/** List all departments sorted by backlog (worst first). */
export function rankDepartmentsByLoad(state: SimState): DepartmentLoad[] {
  return computeAllDepartmentLoads(state).sort(
    (a, b) => b.backlogWeeks - a.backlogWeeks
  );
}

export function summarizeCompanyCapacity(state: SimState): {
  total: number;
  used: number;
  spare: number;
  avgBacklogWeeks: number;
  worstRole: Role | null;
  worstBacklogWeeks: number;
} {
  const cap = computeCompanyCapacity(state);
  return {
    total: cap.totalCapacity,
    used: cap.totalLoad,
    spare: cap.spareCapacityHours,
    avgBacklogWeeks: cap.avgBacklogWeeks,
    worstRole: cap.worstRole,
    worstBacklogWeeks: cap.worstBacklogWeeks,
  };
}
