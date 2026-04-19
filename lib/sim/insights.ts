import type { Role, SimState } from "./types";
import { ROLES, ROLE_LABELS } from "./data";

export type Severity = "ok" | "low" | "medium" | "high" | "critical";

export interface Bottleneck {
  role: Role;
  roleLabel: string;
  pendingTasks: number;
  urgentPendingTasks: number;
  availableAgents: number;
  workingAgents: number;
  severity: Severity;
  ratio: number;
}

export function detectBottlenecks(state: SimState): Bottleneck[] {
  const stats = Object.fromEntries(
    ROLES.map((r) => [
      r,
      {
        pending: 0,
        urgent: 0,
        available: 0,
        working: 0,
      },
    ])
  ) as Record<Role, { pending: number; urgent: number; available: number; working: number }>;

  for (const project of state.projects) {
    if (project.status !== "active" && project.status !== "delayed") continue;
    for (const task of project.tasks) {
      if (task.status === "todo" || task.status === "in_progress") {
        stats[task.requiredRole].pending++;
        if (project.priority === "urgent") stats[task.requiredRole].urgent++;
      }
    }
  }

  for (const agent of state.agents) {
    if (!agent.active) continue;
    stats[agent.role].available++;
    if (agent.status === "working") stats[agent.role].working++;
  }

  return ROLES.map((role) => {
    const s = stats[role];
    const available = Math.max(s.available, 0);
    const ratio = available > 0 ? s.pending / available : s.pending;
    let severity: Severity = "ok";
    if (available === 0 && s.pending > 0) severity = "critical";
    else if (ratio > 4) severity = "critical";
    else if (ratio > 2.5) severity = "high";
    else if (ratio > 1.5) severity = "medium";
    else if (ratio > 0.7) severity = "low";
    return {
      role,
      roleLabel: ROLE_LABELS[role],
      pendingTasks: s.pending,
      urgentPendingTasks: s.urgent,
      availableAgents: s.available,
      workingAgents: s.working,
      severity,
      ratio,
    };
  });
}

export interface Underperformer {
  agentId: string;
  name: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export function detectUnderperformers(state: SimState): Underperformer[] {
  const issues: Underperformer[] = [];
  for (const a of state.agents) {
    if (!a.active) continue;
    const total = a.stats.tasksCompleted + a.stats.tasksFailed;
    if (total < 3) continue;
    const failRate = a.stats.tasksFailed / total;
    if (failRate > 0.4) {
      issues.push({
        agentId: a.id,
        name: a.name,
        reason: `فشل ${Math.round(failRate * 100)}% من مهامه`,
        severity: failRate > 0.6 ? "high" : "medium",
      });
      continue;
    }
    if (a.morale < 30) {
      issues.push({
        agentId: a.id,
        name: a.name,
        reason: `معنويات منخفضة (${a.morale})`,
        severity: a.morale < 15 ? "high" : "medium",
      });
    }
  }
  return issues;
}
