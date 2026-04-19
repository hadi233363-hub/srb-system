// Capacity model — how much effective work can each department deliver per week,
// and how much pending work it's facing. Drives project intake + hiring advice.

import type { Agent, Role, Seniority, SimState } from "./types";
import { ROLES, ROLE_LABELS } from "./data";

// Effective "hours per week of real output" per agent, before productivity.
const BASE_HOURS_PER_WEEK = 40;

// Seniority multiplies deliverable weekly hours (juniors ship less, seniors ship more).
export const SENIORITY_CAPACITY_MULT: Record<Seniority, number> = {
  junior: 0.75,
  mid: 1.0,
  senior: 1.3,
};

function seniorityOf(a: Agent): Seniority {
  return a.seniority ?? "mid";
}

function moraleMult(morale: number): number {
  if (morale < 30) return 0.55;
  if (morale < 50) return 0.8;
  if (morale < 70) return 0.95;
  return 1.0;
}

/** Effective weekly hours an agent can deliver right now (after productivity, morale, traits). */
export function agentWeeklyCapacity(agent: Agent): number {
  if (!agent.active || agent.status === "absent") return 0;
  const sen = seniorityOf(agent);
  const productivity = agent.productivity ?? 1;
  const speed = agent.traits.speed / 100;
  return (
    BASE_HOURS_PER_WEEK *
    SENIORITY_CAPACITY_MULT[sen] *
    speed *
    productivity *
    moraleMult(agent.morale)
  );
}

export interface DepartmentLoad {
  role: Role;
  roleLabel: string;
  /** Active agents in this role */
  headcount: number;
  /** Ramped-up agents (onboardingProgress >= 1) */
  rampedHeadcount: number;
  /** Onboarding agents */
  onboardingHeadcount: number;
  /** Deliverable hours per week (after productivity) */
  capacity: number;
  /** Potential capacity when everyone is fully ramped */
  potentialCapacity: number;
  /** Pending work hours across active+delayed projects */
  load: number;
  /** load / (capacity per week)  → weeks of backlog */
  backlogWeeks: number;
  /** 0..1 — how full the pipe is this week */
  utilization: number;
  severity: "healthy" | "busy" | "overloaded" | "critical";
}

export function computeDepartmentLoad(state: SimState, role: Role): DepartmentLoad {
  const roleAgents = state.agents.filter((a) => a.active && a.role === role);
  const rampedHeadcount = roleAgents.filter(
    (a) => (a.onboardingProgress ?? 1) >= 1
  ).length;
  const onboardingHeadcount = roleAgents.length - rampedHeadcount;
  const capacity = roleAgents.reduce((s, a) => s + agentWeeklyCapacity(a), 0);

  // Potential capacity if every agent finished onboarding (caps productivity at 1).
  const potentialCapacity = roleAgents.reduce((s, a) => {
    const sen = seniorityOf(a);
    const speed = a.traits.speed / 100;
    return (
      s +
      BASE_HOURS_PER_WEEK *
        SENIORITY_CAPACITY_MULT[sen] *
        speed *
        moraleMult(a.morale)
    );
  }, 0);

  let load = 0;
  for (const p of state.projects) {
    if (p.status !== "active" && p.status !== "delayed") continue;
    for (const t of p.tasks) {
      if (t.requiredRole !== role) continue;
      if (t.status === "todo" || t.status === "in_progress") {
        load += t.remainingHours;
      }
    }
  }

  const backlogWeeks = capacity > 0 ? load / capacity : load > 0 ? 99 : 0;
  const utilization = capacity > 0 ? Math.min(backlogWeeks, 1) : 0;

  let severity: DepartmentLoad["severity"];
  if (capacity === 0 && load > 0) severity = "critical";
  else if (backlogWeeks > 4) severity = "critical";
  else if (backlogWeeks > 2.5) severity = "overloaded";
  else if (backlogWeeks > 1.2) severity = "busy";
  else severity = "healthy";

  return {
    role,
    roleLabel: ROLE_LABELS[role],
    headcount: roleAgents.length,
    rampedHeadcount,
    onboardingHeadcount,
    capacity,
    potentialCapacity,
    load,
    backlogWeeks,
    utilization,
    severity,
  };
}

export function computeAllDepartmentLoads(state: SimState): DepartmentLoad[] {
  return ROLES.map((r) => computeDepartmentLoad(state, r));
}

export interface CompanyCapacity {
  totalCapacity: number;
  totalLoad: number;
  avgBacklogWeeks: number;
  worstBacklogWeeks: number;
  worstRole: Role | null;
  spareCapacityHours: number;
  departments: DepartmentLoad[];
  /** 0..1 — overall spare capacity fraction */
  spareCapacityScore: number;
}

export function computeCompanyCapacity(state: SimState): CompanyCapacity {
  const departments = computeAllDepartmentLoads(state);
  const totalCapacity = departments.reduce((s, d) => s + d.capacity, 0);
  const totalLoad = departments.reduce((s, d) => s + d.load, 0);
  const avgBacklogWeeks =
    departments.length > 0
      ? departments.reduce((s, d) => s + d.backlogWeeks, 0) / departments.length
      : 0;
  const worst = [...departments].sort((a, b) => b.backlogWeeks - a.backlogWeeks)[0];
  const spareCapacityHours = Math.max(0, totalCapacity - totalLoad);
  const spareCapacityScore =
    totalCapacity > 0 ? Math.max(0, 1 - totalLoad / totalCapacity) : 0;

  return {
    totalCapacity,
    totalLoad,
    avgBacklogWeeks,
    worstBacklogWeeks: worst ? worst.backlogWeeks : 0,
    worstRole: worst ? worst.role : null,
    spareCapacityHours,
    departments,
    spareCapacityScore,
  };
}

/**
 * Intake acceptance factor: how much of a new-project opportunity the company can absorb
 * right now. 1 = full intake, 0 = reject every offer.
 */
export function intakeAcceptanceFactor(state: SimState): number {
  const cap = computeCompanyCapacity(state);
  if (cap.worstBacklogWeeks > 5) return 0;
  if (cap.worstBacklogWeeks > 3.5) return 0.2;
  if (cap.worstBacklogWeeks > 2.5) return 0.45;
  if (cap.worstBacklogWeeks > 1.5) return 0.75;
  return 1;
}
