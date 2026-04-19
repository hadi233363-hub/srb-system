import type { Agent, ManualActionRecord, Role, Seniority, SimState } from "./types";
import {
  ARCHETYPE_TRAITS,
  BASE_SALARY_BY_ROLE,
  ROLE_LABELS,
} from "./data";
import { logActivity, postTransaction, randomChoice, uid } from "./state";

type AgentSeniority = Seniority;

const JUNIOR_MULT = 0.75;
const SENIOR_MULT = 1.4;
const HIRING_COST_MULT = 0.5;

// Starting productivity — new hires ramp up.
export const INITIAL_PRODUCTIVITY: Record<Seniority, number> = {
  junior: 0.4,
  mid: 0.65,
  senior: 0.8,
};

// Onboarding duration in sim hours.
export const ONBOARDING_HOURS: Record<Seniority, number> = {
  junior: 60 * 24, // 60 days
  mid: 21 * 24, // 21 days
  senior: 7 * 24, // 7 days
};

const FIRST_NAMES = [
  "سلطان", "مريم", "عائشة", "يوسف", "بدر", "شيخة", "علي", "هيا",
  "راشد", "موزة", "عبدالرحمن", "حصة", "ناصر", "دانة", "حمد",
];
const LAST_NAMES = [
  "السليطي", "المهندي", "الهاجري", "النعيمي", "المناعي",
  "الكبيسي", "الفضالة", "الجفيري", "المسند", "الأحمد",
];

function randomName(): string {
  return `${randomChoice(FIRST_NAMES)} ${randomChoice(LAST_NAMES)}`;
}

function logAction(
  state: SimState,
  actionType: string,
  label: string,
  financialImpact: number,
  note: string
) {
  const record: ManualActionRecord = {
    id: uid("act"),
    at: state.simTime,
    actionType,
    label,
    financialImpact,
    note,
  };
  state.actionLog.unshift(record);
  if (state.actionLog.length > 100) state.actionLog.length = 100;
}

export interface HireParams {
  role: Role;
  seniority: AgentSeniority;
}

export function hireAgent(state: SimState, p: HireParams): { ok: boolean; message: string } {
  if (state.settings.hiringPaused) {
    return { ok: false, message: "التوظيف موقوف حالياً. افتحه أولاً." };
  }

  const baseSalary = BASE_SALARY_BY_ROLE[p.role];
  const salary = Math.round(
    baseSalary * (p.seniority === "junior" ? JUNIOR_MULT : p.seniority === "senior" ? SENIOR_MULT : 1)
  );
  const hiringCost = Math.round(salary * HIRING_COST_MULT);
  const name = randomName();
  const archetype =
    p.seniority === "junior"
      ? "rookie"
      : p.seniority === "senior"
      ? "efficient"
      : randomChoice(["efficient", "perfectionist", "inconsistent"] as const);

  state.agents.push({
    id: uid("agt"),
    name,
    role: p.role,
    archetype,
    traits: { ...ARCHETYPE_TRAITS[archetype] },
    morale: 85,
    loyalty: 70,
    salaryMonthly: salary,
    status: "idle",
    currentTaskId: null,
    stats: { tasksCompleted: 0, tasksFailed: 0, tasksReworked: 0 },
    hiredAt: state.simTime,
    active: true,
    absentUntil: null,
    xpTasks: 0,
    onReview: false,
    seniority: p.seniority,
    productivity: INITIAL_PRODUCTIVITY[p.seniority],
    onboardingProgress: 0,
  });

  postTransaction({ kind: "hiring_cost", amount: -hiringCost, note: `تكلفة توظيف ${name}` });
  const seniorityLabel =
    p.seniority === "junior" ? "junior" : p.seniority === "senior" ? "senior" : "mid";
  const label = `توظيف ${seniorityLabel} ${ROLE_LABELS[p.role]}`;
  const onboardingDays = ONBOARDING_HOURS[p.seniority] / 24;
  logActivity(
    "المدير",
    `${label} · ${name} · راتب ${salary.toLocaleString("en-US")} ر.ق · بيبدي بـ ${Math.round(INITIAL_PRODUCTIVITY[p.seniority] * 100)}% إنتاجية (onboarding ${onboardingDays}ي)`,
    "decision"
  );
  logAction(state, "hire", label, -hiringCost, `${name} · شهري ${salary.toLocaleString("en-US")}`);
  return { ok: true, message: `تم توظيف ${name}` };
}

export function fireAgent(state: SimState, agentId: string): { ok: boolean; message: string } {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent || !agent.active) return { ok: false, message: "الموظف مب موجود أو سبق غادر" };
  agent.active = false;
  const severance = Math.round(agent.salaryMonthly * 1.5);
  postTransaction({ kind: "severance", amount: -severance, agentId: agent.id, note: `مكافأة نهاية خدمة: ${agent.name}` });
  for (const a of state.agents) {
    if (!a.active) continue;
    a.morale = Math.max(0, a.morale - 6);
    a.loyalty = Math.max(0, a.loyalty - 3);
  }
  logActivity("المدير", `فصل ${agent.name} من الفريق`, "decision");
  logAction(state, "fire", `فصل ${agent.name}`, -severance, `معنويات الفريق −6`);
  return { ok: true, message: `تم فصل ${agent.name}` };
}

export function raiseSalary(
  state: SimState,
  agentId: string,
  pctIncrease: number
): { ok: boolean; message: string } {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent || !agent.active) return { ok: false, message: "الموظف مب موجود" };
  const pct = Math.max(5, Math.min(50, pctIncrease));
  const oldSalary = agent.salaryMonthly;
  const delta = Math.round(oldSalary * (pct / 100));
  agent.salaryMonthly += delta;
  agent.morale = Math.min(100, agent.morale + 15);
  agent.loyalty = Math.min(100, agent.loyalty + 10);
  logActivity("المدير", `رفع راتب ${agent.name} بـ ${pct}% · +${delta.toLocaleString("en-US")} ر.ق/شهر`, "decision");
  logAction(state, "raise_salary", `رفع راتب ${agent.name}`, -delta, `+${pct}%`);
  return { ok: true, message: `تم رفع الراتب ${pct}%` };
}

export function giveBonus(state: SimState): { ok: boolean; message: string } {
  const total = state.agents.reduce((s, a) => s + (a.active ? a.salaryMonthly : 0), 0);
  const cost = Math.round(total * 0.1);
  postTransaction({ kind: "bonus", amount: -cost, note: "بونص جماعي 10%" });
  for (const a of state.agents) {
    if (!a.active) continue;
    a.morale = Math.min(100, a.morale + 18);
    a.loyalty = Math.min(100, a.loyalty + 10);
  }
  logActivity("المدير", `صرف بونص جماعي · −${cost.toLocaleString("en-US")} ر.ق`, "decision");
  logAction(state, "bonus", "بونص جماعي", -cost, "معنويات +18 · ولاء +10");
  return { ok: true, message: "تم صرف البونص" };
}

export function teamRetreat(state: SimState): { ok: boolean; message: string } {
  const cost = 20000;
  postTransaction({ kind: "overhead", amount: -cost, note: "يوم ترفيهي للفريق" });
  for (const a of state.agents) {
    if (!a.active) continue;
    a.morale = Math.min(100, a.morale + 12);
    a.loyalty = Math.min(100, a.loyalty + 5);
  }
  logActivity("المدير", "يوم ترفيهي للفريق · −20,000 ر.ق", "decision");
  logAction(state, "retreat", "يوم ترفيهي", -cost, "معنويات +12");
  return { ok: true, message: "تم تنظيم اليوم الترفيهي" };
}

export function setHiringPause(state: SimState, paused: boolean): { ok: boolean; message: string } {
  state.settings.hiringPaused = paused;
  logActivity("المدير", paused ? "إيقاف التوظيف" : "استئناف التوظيف", "decision");
  logAction(state, "hiring_toggle", paused ? "إيقاف التوظيف" : "استئناف التوظيف", 0, "");
  return { ok: true, message: paused ? "تم الإيقاف" : "تم الاستئناف" };
}

export function cancelProject(state: SimState, projectId: string): { ok: boolean; message: string } {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return { ok: false, message: "المشروع مب موجود" };
  if (project.status === "completed" || project.status === "failed" || project.status === "cancelled") {
    return { ok: false, message: "المشروع منتهي أصلاً" };
  }
  project.status = "cancelled";
  project.completedAt = state.simTime;
  const loss = Math.round(project.actualCost * 0.5);
  if (loss > 0) {
    postTransaction({ kind: "refund", amount: -loss, projectId, note: `إلغاء مشروع: ${project.title}` });
  }
  logActivity("المدير", `إلغاء مشروع "${project.title}" · خسارة ${loss.toLocaleString("en-US")} ر.ق`, "decision");
  logAction(state, "cancel_project", `إلغاء "${project.title}"`, -loss, "");
  return { ok: true, message: "تم الإلغاء" };
}

export function boostProjectPriority(state: SimState, projectId: string): { ok: boolean; message: string } {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return { ok: false, message: "مب موجود" };
  if (project.status !== "active" && project.status !== "delayed") {
    return { ok: false, message: "غير قابل للتعديل" };
  }
  project.priority = "urgent";
  logActivity("المدير", `ترقية أولوية "${project.title}" إلى عاجل ⚡`, "decision");
  logAction(state, "priority_boost", `ترقية "${project.title}"`, 0, "");
  return { ok: true, message: "تمت الترقية" };
}
