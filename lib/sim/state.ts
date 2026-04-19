import type {
  ActivityEntry,
  ActivityKind,
  Agent,
  Project,
  ProjectPriority,
  Seniority,
  SimEvent,
  SimState,
  Transaction,
} from "./types";
import {
  AGENT_NAMES,
  ARCHETYPE_TRAITS,
  BASE_SALARY_BY_ROLE,
  CLIENT_POOL,
  PROJECT_TEMPLATES,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPES,
} from "./data";

const SIM_START = Date.UTC(2026, 3, 1, 8, 0, 0);

interface SimGlobal {
  state: SimState;
  subscribers: Set<(event: SimEvent) => void>;
  tickHandle: NodeJS.Timeout | null;
}

// Bumped to v4 for hiring/capacity system additions.
const g = globalThis as unknown as {
  __sim_v3__?: SimGlobal;
  __sim_v4__?: SimGlobal;
};

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Seniority of seed employees — established staff.
const SEED_SENIORITY: Record<string, Seniority> = {
  efficient: "mid",
  perfectionist: "senior",
  inconsistent: "mid",
  burnout_prone: "mid",
  lazy: "junior",
  rookie: "junior",
};

function seedAgents(now: number): Agent[] {
  return AGENT_NAMES.map((def) => ({
    id: uid("agt"),
    name: def.name,
    role: def.role,
    archetype: def.archetype,
    traits: { ...ARCHETYPE_TRAITS[def.archetype] },
    morale: 80,
    loyalty: 70,
    salaryMonthly: BASE_SALARY_BY_ROLE[def.role],
    status: "idle" as const,
    currentTaskId: null,
    stats: { tasksCompleted: 0, tasksFailed: 0, tasksReworked: 0 },
    hiredAt: now - 30 * 24 * 60 * 60 * 1000,
    active: true,
    absentUntil: null,
    xpTasks: 0,
    onReview: false,
    seniority: SEED_SENIORITY[def.archetype] ?? "mid",
    productivity: 1,
    onboardingProgress: 1,
  }));
}

function pickPriority(): ProjectPriority {
  const r = Math.random();
  if (r < 0.12) return "urgent";
  if (r < 0.25) return "low";
  return "normal";
}

export function createProject(now: number): Project {
  const type = randomChoice(PROJECT_TYPES);
  const tpl = PROJECT_TEMPLATES[type];
  const client = randomChoice(CLIENT_POOL);
  const titlePattern = randomChoice(tpl.titlePatterns);
  const title = titlePattern.replace("{client}", client);
  const budget = Math.round(randomInRange(tpl.minBudget, tpl.maxBudget) / 500) * 500;
  const costEstimate = Math.round(budget * tpl.costRatio);
  const priority = pickPriority();
  const durationDays =
    priority === "urgent"
      ? Math.max(2, Math.floor(tpl.durationDays[0] * 0.6))
      : tpl.durationDays[0] +
        Math.floor(Math.random() * (tpl.durationDays[1] - tpl.durationDays[0] + 1));
  const projectId = uid("prj");
  return {
    id: projectId,
    client,
    title,
    type,
    budget,
    costEstimate,
    actualCost: 0,
    status: "active",
    priority,
    createdAt: now,
    deadline: now + durationDays * 24 * 60 * 60 * 1000,
    completedAt: null,
    tasks: tpl.tasks.map((t) => ({
      id: uid("tsk"),
      projectId,
      title: t.title,
      requiredRole: t.role,
      assigneeId: null,
      estimatedHours: t.hours,
      remainingHours: t.hours,
      status: "todo" as const,
      reworkCount: 0,
      revisionCount: 0,
      hoursLogged: 0,
      addedLate: false,
    })),
    scopeChanges: 0,
    clientRevisions: 0,
    crisisCount: 0,
    clientSatisfaction: 80,
  };
}

function seedTransactions(now: number): Transaction[] {
  const txs: Transaction[] = [];
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < 8; i++) {
    txs.push({
      id: uid("tx"),
      at: thirtyDaysAgo + i * 3 * 24 * 60 * 60 * 1000,
      kind: "income",
      amount: Math.round(randomInRange(20000, 80000) / 500) * 500,
      note: "مشروع سابق",
    });
  }
  txs.push({
    id: uid("tx"),
    at: now - 24 * 60 * 60 * 1000,
    kind: "salary",
    amount: -92000,
    note: "رواتب الشهر الماضي",
  });
  txs.push({
    id: uid("tx"),
    at: now - 12 * 60 * 60 * 1000,
    kind: "tool",
    amount: -3500,
    note: "اشتراكات الأدوات",
  });
  return txs.sort((a, b) => a.at - b.at);
}

function seedActivity(now: number): ActivityEntry[] {
  return [
    {
      id: uid("act"),
      at: now - 60000,
      actor: "النظام",
      message: "بدأت المحاكاة · جاهز للقرارات",
      kind: "info",
    },
  ];
}

function createInitialState(): SimState {
  const now = SIM_START;
  const agents = seedAgents(now);
  const projects: Project[] = [
    createProject(now - 3 * 24 * 60 * 60 * 1000),
    createProject(now - 24 * 60 * 60 * 1000),
  ];
  return {
    simTime: now,
    startedAt: now,
    speedMultiplier: 10,
    paused: false,
    agents,
    projects,
    transactions: seedTransactions(now),
    activityLog: seedActivity(now),
    scenarios: [],
    decisionLog: [],
    actionLog: [],
    settings: { hiringPaused: false, autoScenarios: true },
    counters: {
      projectsCompleted: 4,
      projectsFailed: 1,
      agentsQuit: 0,
      crisesHandled: 0,
      decisionsMade: 0,
      missedOpportunities: 0,
    },
  };
}

function getOrInit(): SimGlobal {
  // Clean up older-version global if present (HMR into a newer schema).
  if (g.__sim_v3__ && g.__sim_v3__.tickHandle) {
    clearInterval(g.__sim_v3__.tickHandle);
    delete g.__sim_v3__;
  }
  if (!g.__sim_v4__) {
    g.__sim_v4__ = {
      state: createInitialState(),
      subscribers: new Set(),
      tickHandle: null,
    };
  }
  return g.__sim_v4__;
}

export function getSim(): SimGlobal {
  return getOrInit();
}

export function getState(): SimState {
  return getOrInit().state;
}

export function subscribe(fn: (event: SimEvent) => void): () => void {
  const s = getOrInit().subscribers;
  s.add(fn);
  return () => s.delete(fn);
}

export function broadcast(event: SimEvent): void {
  const subs = getOrInit().subscribers;
  subs.forEach((fn) => {
    try {
      fn(event);
    } catch {
      // ignore broken subscribers
    }
  });
}

export function logActivity(
  actor: string,
  message: string,
  kind: ActivityKind = "info"
): void {
  const state = getState();
  const entry: ActivityEntry = {
    id: uid("act"),
    at: state.simTime,
    actor,
    message,
    kind,
  };
  state.activityLog.unshift(entry);
  if (state.activityLog.length > 150) state.activityLog.length = 150;
  broadcast({ type: "activity", payload: entry });
}

export function postTransaction(tx: Omit<Transaction, "id" | "at">): void {
  const state = getState();
  const full: Transaction = {
    ...tx,
    id: uid("tx"),
    at: state.simTime,
  };
  state.transactions.push(full);
  if (state.transactions.length > 500) {
    state.transactions.splice(0, state.transactions.length - 500);
  }
}

export function resetSim(): void {
  const sim = getOrInit();
  sim.state = createInitialState();
  broadcast({ type: "activity", payload: sim.state.activityLog[0] });
}

export { PROJECT_TYPE_LABELS, randomChoice, randomInRange, uid };
