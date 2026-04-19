import type { Agent, Archetype, Project, Seniority, SimState, Task } from "./types";
import { ROLE_LABELS } from "./data";
import { logActivity, postTransaction, randomChoice, uid } from "./state";
import { INITIAL_PRODUCTIVITY, ONBOARDING_HOURS } from "./actions";

const MS_PER_HOUR = 60 * 60 * 1000;

function defaultSeniority(agent: Agent): Seniority {
  return agent.seniority ?? "mid";
}

/** Advance onboarding by one sim hour, updating productivity. */
function advanceOnboarding(agent: Agent) {
  const seniority = defaultSeniority(agent);
  const duration = ONBOARDING_HOURS[seniority];
  // Backward-compat: if missing, treat as fully ramped (legacy seed agents).
  let progress = agent.onboardingProgress;
  if (progress === undefined) {
    agent.onboardingProgress = 1;
    agent.productivity = 1;
    return;
  }
  if (progress >= 1) return;
  progress = Math.min(1, progress + 1 / duration);
  agent.onboardingProgress = progress;
  const base = INITIAL_PRODUCTIVITY[seniority];
  agent.productivity = base + (1 - base) * progress;
  if (progress === 1) {
    logActivity(
      agent.name,
      `خلّص فترة التأهيل · إنتاجيته الكاملة ${Math.round((agent.productivity ?? 1) * 100)}%`,
      "success"
    );
  }
}

function findTask(state: SimState, taskId: string): Task | undefined {
  for (const p of state.projects) {
    const t = p.tasks.find((x) => x.id === taskId);
    if (t) return t;
  }
  return undefined;
}

function findProject(state: SimState, projectId: string): Project | undefined {
  return state.projects.find((p) => p.id === projectId);
}

function projectWeight(project: Project): number {
  if (project.priority === "urgent") return 3;
  if (project.priority === "low") return 1;
  return 2;
}

function findAssignableTask(state: SimState, agent: Agent): Task | undefined {
  const candidates: { task: Task; project: Project; score: number }[] = [];
  for (const project of state.projects) {
    if (project.status !== "active" && project.status !== "delayed") continue;
    const projectTasks = project.tasks;
    for (let i = 0; i < projectTasks.length; i++) {
      const task = projectTasks[i];
      if (task.status !== "todo" || task.requiredRole !== agent.role) continue;
      const blocked = projectTasks.some(
        (prior, idx) =>
          idx < i &&
          prior.status !== "done" &&
          prior.status !== "failed" &&
          !prior.addedLate
      );
      if (blocked) continue;
      const weight = projectWeight(project);
      const ageDays = (state.simTime - project.createdAt) / (24 * MS_PER_HOUR);
      const score = weight * 10 + ageDays;
      candidates.push({ task, project, score });
    }
  }
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].task;
}

function moraleMultiplier(morale: number): number {
  return 0.5 + (morale / 100) * 0.8;
}

function archetypeVariance(archetype: Archetype): number {
  switch (archetype) {
    case "inconsistent":
      return 0.4 + Math.random() * 1.4;
    case "perfectionist":
      return 1.1 + Math.random() * 0.4;
    case "lazy":
      return 1.0 + Math.random() * 0.8;
    case "efficient":
      return 0.85 + Math.random() * 0.3;
    case "rookie":
      return 0.9 + Math.random() * 0.6;
    default:
      return 0.8 + Math.random() * 0.6;
  }
}

function assignTaskToAgent(agent: Agent, task: Task) {
  const speedFactor = 100 / Math.max(agent.traits.speed, 20);
  const variance = archetypeVariance(agent.archetype);
  task.remainingHours = Math.max(1, Math.round(task.estimatedHours * speedFactor * variance));
  task.status = "in_progress";
  task.assigneeId = agent.id;
  agent.status = "working";
  agent.currentTaskId = task.id;
}

function accumulateHourlyCost(state: SimState, agent: Agent, task: Task) {
  const project = findProject(state, task.projectId);
  if (!project) return;
  const hourlyCost = agent.salaryMonthly / 160;
  project.actualCost += hourlyCost;
  task.hoursLogged += 1;
}

function onProjectCompleted(state: SimState, project: Project) {
  project.status = "completed";
  project.completedAt = state.simTime;
  state.counters.projectsCompleted++;

  const overrunRatio = project.actualCost / Math.max(1, project.costEstimate);
  const penalty = overrunRatio > 1.3 ? 0.1 : 0;
  const paid = Math.round(project.budget * (1 - penalty));

  postTransaction({
    kind: "income",
    amount: paid,
    projectId: project.id,
    note: project.title,
  });

  const suffix = overrunRatio > 1.3
    ? ` (تجاوز ميزانية ${Math.round((overrunRatio - 1) * 100)}%)`
    : "";
  logActivity(
    "النظام",
    `تم تسليم "${project.title}" · +${paid.toLocaleString("en-US")} ر.ق${suffix}`,
    "success"
  );
}

function onProjectFailed(state: SimState, project: Project) {
  project.status = "failed";
  project.completedAt = state.simTime;
  state.counters.projectsFailed++;

  const loss = Math.round(project.actualCost * 0.5);
  if (loss > 0) {
    postTransaction({
      kind: "refund",
      amount: -loss,
      projectId: project.id,
      note: `خسارة مشروع: ${project.title}`,
    });
  }

  logActivity(
    "النظام",
    `فشل مشروع "${project.title}" · −${loss.toLocaleString("en-US")} ر.ق`,
    "error"
  );
}

function maybeFinalizeProject(state: SimState, projectId: string) {
  const project = findProject(state, projectId);
  if (!project || project.status === "completed" || project.status === "failed") return;

  const failedCount = project.tasks.filter((t) => t.status === "failed").length;
  const doneCount = project.tasks.filter((t) => t.status === "done").length;
  const total = project.tasks.length;

  if (failedCount >= Math.ceil(total / 2)) {
    onProjectFailed(state, project);
    return;
  }

  if (doneCount + failedCount === total && failedCount < total) {
    if (failedCount === 0) {
      onProjectCompleted(state, project);
    } else {
      onProjectFailed(state, project);
    }
  }
}

function handleTaskFailure(state: SimState, agent: Agent, task: Task) {
  agent.stats.tasksFailed++;
  agent.morale = Math.max(0, agent.morale - 8);

  const reworkable = task.reworkCount < 2;
  const reworkChance = agent.archetype === "perfectionist" ? 0.8 : 0.5;

  if (reworkable && Math.random() < reworkChance) {
    task.reworkCount++;
    task.status = "in_progress";
    task.remainingHours = Math.max(
      2,
      Math.round(task.estimatedHours * 0.6 * archetypeVariance(agent.archetype))
    );
    agent.stats.tasksReworked++;
    logActivity(
      `${agent.name} (${ROLE_LABELS[agent.role]})`,
      `فشل في "${task.title}" · بيعيد الشغل (محاولة ${task.reworkCount + 1})`,
      "warning"
    );
  } else {
    task.status = "failed";
    agent.status = "idle";
    agent.currentTaskId = null;
    logActivity(
      `${agent.name} (${ROLE_LABELS[agent.role]})`,
      `فشل نهائي في "${task.title}" · ما قبله العميل 😞`,
      "error"
    );
    maybeFinalizeProject(state, task.projectId);
  }
}

function handleTaskSuccess(state: SimState, agent: Agent, task: Task) {
  agent.stats.tasksCompleted++;
  agent.morale = Math.min(100, agent.morale + 2);
  agent.xpTasks++;

  if (agent.archetype === "rookie" && agent.xpTasks > 0 && agent.xpTasks % 6 === 0) {
    agent.traits.speed = Math.min(80, agent.traits.speed + 3);
    agent.traits.accuracy = Math.min(82, agent.traits.accuracy + 3);
    logActivity(
      `${agent.name}`,
      `تحسّن بعد الخبرة · السرعة والدقة زادت`,
      "success"
    );
  }

  if (agent.archetype === "perfectionist" && task.revisionCount === 0 && Math.random() < 0.25) {
    task.remainingHours = 2 + Math.floor(Math.random() * 4);
    logActivity(
      `${agent.name} (${ROLE_LABELS[agent.role]})`,
      `يشتغل على تحسينات إضافية على "${task.title}"`,
      "info"
    );
    return;
  }

  const revisionChance = task.revisionCount < 2 ? 0.15 : 0;
  if (Math.random() < revisionChance) {
    task.revisionCount++;
    task.status = "in_progress";
    task.remainingHours = Math.max(2, Math.round(task.estimatedHours * 0.3));
    const project = findProject(state, task.projectId);
    if (project) project.clientRevisions++;
    agent.morale = Math.max(0, agent.morale - 3);
    logActivity(
      "العميل",
      `طلب تعديلات على "${task.title}" (${task.revisionCount})`,
      "warning"
    );
    return;
  }

  task.status = "done";
  agent.status = "idle";
  agent.currentTaskId = null;
  logActivity(
    `${agent.name} (${ROLE_LABELS[agent.role]})`,
    `خلّص "${task.title}"`,
    "success"
  );

  maybeFinalizeProject(state, task.projectId);

  if (agent.archetype === "efficient" && agent.status === "idle" && Math.random() < 0.55) {
    const next = findAssignableTask(state, agent);
    if (next) {
      assignTaskToAgent(agent, next);
      logActivity(
        `${agent.name} (${ROLE_LABELS[agent.role]})`,
        `بدأ "${next.title}" مباشرة`,
        "info"
      );
    }
  }
}

function maybeGoAbsent(agent: Agent, state: SimState) {
  if (agent.status !== "idle") return;
  const baseChance = agent.archetype === "burnout_prone" ? 0.0008 : 0.0003;
  const lowMoraleBoost = agent.morale < 40 ? 2 : 1;
  if (Math.random() < baseChance * lowMoraleBoost) {
    const durationHours = 6 + Math.floor(Math.random() * 24);
    agent.status = "absent";
    agent.absentUntil = state.simTime + durationHours * MS_PER_HOUR;
    logActivity(
      `${agent.name}`,
      `غايب اليوم · ${durationHours < 12 ? "ظروف شخصية" : "إجازة مرضية"}`,
      "warning"
    );
  }
}

function maybeQuit(agent: Agent, state: SimState) {
  if (agent.archetype !== "burnout_prone") return;
  if (agent.morale > 10) return;
  if (Math.random() < 0.008) {
    agent.active = false;
    agent.status = "idle";
    agent.currentTaskId = null;
    state.counters.agentsQuit++;
    logActivity(
      `${agent.name}`,
      `قدّم استقالته · "ما عاد أقدر"`,
      "error"
    );
  }
}

export function tickAgents(state: SimState) {
  for (const agent of state.agents) {
    if (!agent.active) continue;

    // Advance onboarding each sim hour.
    advanceOnboarding(agent);

    if (agent.status === "absent" && agent.absentUntil && state.simTime >= agent.absentUntil) {
      agent.status = "idle";
      agent.absentUntil = null;
      logActivity(`${agent.name}`, `رجع من الغياب`, "info");
    }
    if (agent.status === "absent") continue;

    if (agent.status === "working" && agent.currentTaskId) {
      const task = findTask(state, agent.currentTaskId);
      if (!task) {
        agent.status = "idle";
        agent.currentTaskId = null;
        continue;
      }

      if (Math.random() * 100 > agent.traits.reliability) {
        if (agent.archetype === "lazy" && Math.random() < 0.03) {
          logActivity(agent.name, "يسوّف · استراحة قهوة طويلة ☕", "info");
        }
        continue;
      }

      accumulateHourlyCost(state, agent, task);
      // Productivity: new hires work slower during onboarding (0.4–1.0).
      task.remainingHours -= agent.productivity ?? 1;

      if (task.remainingHours <= 0) {
        const accuracyRoll = Math.random() * 100;
        const effectiveAccuracy = agent.traits.accuracy * moraleMultiplier(agent.morale);
        const success = accuracyRoll < effectiveAccuracy;

        if (success) {
          handleTaskSuccess(state, agent, task);
        } else {
          handleTaskFailure(state, agent, task);
        }
      }
    }

    if (agent.status === "idle" && agent.morale > 15) {
      const task = findAssignableTask(state, agent);
      if (task) {
        assignTaskToAgent(agent, task);
        logActivity(
          `${agent.name} (${ROLE_LABELS[agent.role]})`,
          `بدأ "${task.title}"`,
          "info"
        );
      }
    }

    maybeGoAbsent(agent, state);

    if (agent.archetype === "burnout_prone" && agent.stats.tasksCompleted > 0) {
      const loadFactor = Math.min(agent.stats.tasksCompleted, 30) / 30;
      if (Math.random() < 0.002 * loadFactor) {
        agent.morale = Math.max(0, agent.morale - 2);
      }
    }

    if (agent.archetype === "lazy" && agent.morale > 50 && Math.random() < 0.003) {
      agent.morale = Math.max(0, agent.morale - 1);
    }

    maybeQuit(agent, state);

    if (agent.morale < 100 && Math.random() < 0.006 && agent.status === "idle") {
      agent.morale = Math.min(100, agent.morale + 1);
    }
  }
}

export { uid as _uid };
