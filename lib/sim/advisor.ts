// Smart advisor — computes probabilities, risk, and recommendations
// from actual simulation state. No random values at the analysis layer.
// (Randomness is only rolled when an outcome is *resolved* in applyDecision.)

import type {
  Agent,
  DecisionChoice,
  Project,
  RiskLevel,
  SimState,
} from "./types";

const MS_DAY = 24 * 60 * 60 * 1000;

// ─── small helpers ─────────────────────────────────────────────

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Clamp to 5..95 so bars stay readable; full 0 or 100 is reserved for guaranteed outcomes. */
export function clampPct(n: number): number {
  return Math.max(5, Math.min(95, Math.round(n)));
}

// ─── company health ───────────────────────────────────────────

export interface CompanyHealth {
  /** 0..1 — income vs expenses last 30 sim-days */
  financialScore: number;
  /** 0..1 — avg team morale */
  teamMoraleScore: number;
  /** 0..1 — avg team loyalty */
  teamLoyaltyScore: number;
  /** 0..1 — fraction of active agents currently idle (higher = more capacity) */
  spareCapacityScore: number;
  /** 0..1 — avg client satisfaction across active projects */
  clientSatisfactionScore: number;
  /** Raw numbers for text labels */
  net30d: number;
  income30d: number;
  expenses30d: number;
  utilization: number;
  activeProjectCount: number;
  activeAgentCount: number;
  /** Human-readable tag */
  financialLabel: "ممتاز" | "مستقر" | "ضيق" | "خطر";
}

export function computeCompanyHealth(state: SimState): CompanyHealth {
  const now = state.simTime;
  const thirtyAgo = now - 30 * MS_DAY;
  let income = 0;
  let expenses = 0;
  for (const tx of state.transactions) {
    if (tx.at < thirtyAgo) continue;
    if (tx.amount > 0) income += tx.amount;
    else expenses += Math.abs(tx.amount);
  }
  const net30d = income - expenses;
  const ratio = expenses > 0 ? income / expenses : 2;

  let financialScore: number;
  let financialLabel: CompanyHealth["financialLabel"];
  if (ratio >= 1.5) {
    financialScore = 1;
    financialLabel = "ممتاز";
  } else if (ratio >= 1.2) {
    financialScore = 0.8;
    financialLabel = "مستقر";
  } else if (ratio >= 1.0) {
    financialScore = 0.55;
    financialLabel = "مستقر";
  } else if (ratio >= 0.8) {
    financialScore = 0.3;
    financialLabel = "ضيق";
  } else {
    financialScore = 0.1;
    financialLabel = "خطر";
  }

  const active = state.agents.filter((a) => a.active);
  const avgMorale = active.length
    ? active.reduce((s, a) => s + a.morale, 0) / active.length
    : 50;
  const avgLoyalty = active.length
    ? active.reduce((s, a) => s + a.loyalty, 0) / active.length
    : 50;

  const working = active.filter((a) => a.status === "working").length;
  const utilization = active.length > 0 ? working / active.length : 0;

  const activeProjects = state.projects.filter(
    (p) => p.status === "active" || p.status === "delayed"
  );
  const avgSat =
    activeProjects.length > 0
      ? activeProjects.reduce((s, p) => s + p.clientSatisfaction, 0) /
        activeProjects.length /
        100
      : 0.7;

  return {
    financialScore,
    teamMoraleScore: avgMorale / 100,
    teamLoyaltyScore: avgLoyalty / 100,
    spareCapacityScore: 1 - utilization,
    clientSatisfactionScore: avgSat,
    net30d,
    income30d: income,
    expenses30d: expenses,
    utilization,
    activeProjectCount: activeProjects.length,
    activeAgentCount: active.length,
    financialLabel,
  };
}

// ─── agent performance ────────────────────────────────────────

export interface AgentPerformance {
  /** 0..1 from speed trait */
  efficiency: number;
  /** 0..1 from reliability trait */
  reliability: number;
  /** 0..1 from stats (if enough history) or accuracy trait */
  successRate: number;
  /** 0..1 current morale */
  moraleHealth: number;
  /** 0..1 current loyalty */
  loyaltyHealth: number;
  /** 0..1 — 1 means agent is the only one in their role */
  criticalityInRole: number;
  /** 0..1 weighted composite */
  overall: number;
  /** Human-readable tag */
  tag: "نجم" | "قوي" | "معتدل" | "ضعيف";
}

export function computeAgentPerformance(
  state: SimState,
  agent: Agent
): AgentPerformance {
  const total = agent.stats.tasksCompleted + agent.stats.tasksFailed;
  const successRate =
    total >= 3
      ? agent.stats.tasksCompleted / total
      : agent.traits.accuracy / 100;
  const efficiency = agent.traits.speed / 100;
  const reliability = agent.traits.reliability / 100;
  const moraleHealth = agent.morale / 100;
  const loyaltyHealth = agent.loyalty / 100;

  const sameRole = state.agents.filter(
    (a) => a.active && a.role === agent.role
  );
  const criticalityInRole = 1 / Math.max(1, sameRole.length);

  const moralePenalty =
    agent.morale < 30 ? 0.6 : agent.morale < 50 ? 0.85 : 1;

  const raw =
    (successRate * 0.4 +
      efficiency * 0.2 +
      reliability * 0.25 +
      moraleHealth * 0.15) *
    moralePenalty;

  const overall = clamp01(raw);
  const tag: AgentPerformance["tag"] =
    overall >= 0.75 ? "نجم"
    : overall >= 0.55 ? "قوي"
    : overall >= 0.35 ? "معتدل"
    : "ضعيف";

  return {
    efficiency,
    reliability,
    successRate,
    moraleHealth,
    loyaltyHealth,
    criticalityInRole,
    overall,
    tag,
  };
}

// ─── project risk ────────────────────────────────────────────

export interface ProjectRisk {
  scheduleRisk: number;
  budgetRisk: number;
  qualityRisk: number;
  satisfactionRisk: number;
  /** 0..1 — avg team ability to finish this project's required roles */
  teamCapacityForProject: number;
  /** 0..1 overall */
  overall: number;
  /** Human-readable tag */
  tag: "صحي" | "مراقبة" | "خطر" | "أزمة";
}

export function computeProjectRisk(
  state: SimState,
  project: Project
): ProjectRisk {
  const now = state.simTime;
  const totalTasks = project.tasks.length;
  const doneTasks = project.tasks.filter((t) => t.status === "done").length;
  const failedTasks = project.tasks.filter((t) => t.status === "failed").length;
  const progress = totalTasks > 0 ? (doneTasks + failedTasks) / totalTasks : 0;
  const totalTime = project.deadline - project.createdAt;
  const elapsed = now - project.createdAt;
  const timeProgress = totalTime > 0 ? clamp01(elapsed / totalTime) : 1;

  const scheduleRisk = clamp01(
    timeProgress - progress + (project.status === "delayed" ? 0.3 : 0)
  );
  const budgetRisk =
    project.budget > 0 ? clamp01(project.actualCost / project.budget) : 0;
  const qualityRisk = totalTasks > 0 ? failedTasks / totalTasks : 0;
  const satisfactionRisk = 1 - project.clientSatisfaction / 100;

  // Team capacity for finishing this project (average perf of agents in required roles)
  const requiredRoles = new Set(project.tasks.map((t) => t.requiredRole));
  let capabilitySum = 0;
  let capabilityCount = 0;
  for (const role of requiredRoles) {
    const roleAgents = state.agents.filter((a) => a.active && a.role === role);
    if (roleAgents.length === 0) continue;
    const avg =
      roleAgents.reduce(
        (s, a) => s + computeAgentPerformance(state, a).overall,
        0
      ) / roleAgents.length;
    capabilitySum += avg;
    capabilityCount++;
  }
  const teamCapacityForProject =
    capabilityCount > 0 ? capabilitySum / capabilityCount : 0.3;

  const overall = clamp01(
    scheduleRisk * 0.3 +
      budgetRisk * 0.25 +
      qualityRisk * 0.2 +
      satisfactionRisk * 0.25
  );

  const tag: ProjectRisk["tag"] =
    overall >= 0.75 ? "أزمة"
    : overall >= 0.55 ? "خطر"
    : overall >= 0.3 ? "مراقبة"
    : "صحي";

  return {
    scheduleRisk,
    budgetRisk,
    qualityRisk,
    satisfactionRisk,
    teamCapacityForProject,
    overall,
    tag,
  };
}

// ─── role-level capability ────────────────────────────────────

export function averagePerformanceByRole(
  state: SimState,
  role: string
): number {
  const agents = state.agents.filter((a) => a.active && a.role === role);
  if (agents.length === 0) return 0.3;
  return (
    agents.reduce((s, a) => s + computeAgentPerformance(state, a).overall, 0) /
    agents.length
  );
}

// ─── recommendation picker (expected-value scoring) ────────────

const RISK_PENALTY: Record<RiskLevel, number> = {
  low: 0,
  medium: 10,
  high: 28,
  critical: 60,
};

/** Sum positive − (negative × 1.2) − riskPenalty. Higher = better. */
export function computeExpectedValue(choice: DecisionChoice): number {
  const positive = choice.probabilities
    .filter((p) => p.tone === "positive")
    .reduce((s, p) => s + p.pct, 0);
  const negative = choice.probabilities
    .filter((p) => p.tone === "negative")
    .reduce((s, p) => s + p.pct, 0);
  return positive - negative * 1.2 - RISK_PENALTY[choice.riskLevel];
}

/** Pick the choice with the highest expected value. Ties go to lower risk. */
export function pickRecommended(choices: DecisionChoice[]): string | undefined {
  let best: { key: string; score: number; riskRank: number } | null = null;
  const riskRank: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  for (const c of choices) {
    const score = computeExpectedValue(c);
    const r = riskRank[c.riskLevel];
    if (
      !best ||
      score > best.score ||
      (score === best.score && r < best.riskRank)
    ) {
      best = { key: c.key, score, riskRank: r };
    }
  }
  return best?.key;
}
