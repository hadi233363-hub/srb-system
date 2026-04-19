import type { Project, SimState, Task } from "./types";
import { CRISIS_TEMPLATES, EXTRA_TASK_TEMPLATES, ROLES } from "./data";
import { createProject, logActivity, randomChoice, uid } from "./state";
import { intakeAcceptanceFactor, computeCompanyCapacity } from "./capacity";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function weightedCrisisPick() {
  const total = CRISIS_TEMPLATES.reduce((s, c) => s + c.weight, 0);
  let roll = Math.random() * total;
  for (const c of CRISIS_TEMPLATES) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return CRISIS_TEMPLATES[0];
}

function addExtraTaskToProject(project: Project, label: string): Task {
  const availableRoles = ROLES.filter((r) => EXTRA_TASK_TEMPLATES[r]?.length);
  const role = randomChoice(availableRoles);
  const title = randomChoice(EXTRA_TASK_TEMPLATES[role]);
  const hours = 4 + Math.floor(Math.random() * 10);
  const task: Task = {
    id: uid("tsk"),
    projectId: project.id,
    title: `[${label}] ${title}`,
    requiredRole: role,
    assigneeId: null,
    estimatedHours: hours,
    remainingHours: hours,
    status: "todo",
    reworkCount: 0,
    revisionCount: 0,
    hoursLogged: 0,
    addedLate: true,
  };
  project.tasks.push(task);
  return task;
}

export function maybeGenerateProject(state: SimState) {
  const activeCount = state.projects.filter(
    (p) => p.status === "active" || p.status === "delayed"
  ).length;

  // Client-interest rate (an opportunity arrives).
  let interestChance = 0;
  if (activeCount < 2) interestChance = 0.6;
  else if (activeCount < 4) interestChance = 0.35;
  else if (activeCount < 6) interestChance = 0.18;
  else interestChance = 0.08;

  const salesAgent = state.agents.find((a) => a.role === "sales" && a.active);
  if (salesAgent) {
    const factor = (salesAgent.traits.accuracy / 100) * (salesAgent.morale / 80);
    interestChance *= factor;
  } else {
    interestChance *= 0.3;
  }

  if (Math.random() >= interestChance) return;

  // An opportunity landed. Can we accept it given current capacity?
  const acceptance = intakeAcceptanceFactor(state);

  if (acceptance === 0 || Math.random() >= acceptance) {
    // Missed opportunity — we don't have capacity.
    state.counters.missedOpportunities =
      (state.counters.missedOpportunities ?? 0) + 1;
    const cap = computeCompanyCapacity(state);
    const worst = cap.worstRole;
    const worstLoad = cap.worstBacklogWeeks;
    logActivity(
      "المبيعات",
      worst
        ? `فرصة ضاعت · الفريق مختنق (${worst} · ${worstLoad.toFixed(1)} أسبوع backlog)`
        : `فرصة ضاعت · السعة الإنتاجية مافيها فاضي`,
      "warning"
    );
    return;
  }

  // We have capacity — close the deal.
  const project = createProject(state.simTime);
  state.projects.push(project);
  const priorityBadge = project.priority === "urgent" ? " · عاجل ⚡" : "";
  logActivity(
    salesAgent ? `${salesAgent.name} (مبيعات)` : "المبيعات",
    `قفل صفقة · "${project.title}" · ${project.budget.toLocaleString("en-US")} ر.ق${priorityBadge}`,
    "success"
  );
}

export function tickProjectDeadlines(state: SimState) {
  for (const project of state.projects) {
    if (project.status !== "active") continue;
    const pendingTasks = project.tasks.filter(
      (t) => t.status !== "done" && t.status !== "failed"
    );
    if (pendingTasks.length === 0) continue;

    const hoursToDeadline = (project.deadline - state.simTime) / MS_PER_HOUR;
    if (hoursToDeadline < 0) {
      project.status = "delayed";
      logActivity(
        "النظام",
        `مشروع "${project.title}" تأخر عن deadline ⚠`,
        "warning"
      );
    }
  }
}

export function maybeScopeCreep(state: SimState) {
  for (const project of state.projects) {
    if (project.status !== "active") continue;
    if (project.scopeChanges >= 2) continue;
    const daysSinceStart = (state.simTime - project.createdAt) / MS_PER_DAY;
    if (daysSinceStart < 2) continue;
    if (Math.random() < 0.003) {
      const task = addExtraTaskToProject(project, "نطاق جديد");
      project.scopeChanges++;
      logActivity(
        "العميل",
        `وسّع نطاق "${project.title}" · مهمة جديدة (${task.title})`,
        "warning"
      );
    }
  }
}

export function maybeTriggerCrisis(state: SimState) {
  const active = state.projects.filter(
    (p) => p.status === "active" || p.status === "delayed"
  );
  if (active.length === 0) return;
  if (Math.random() > 0.02) return;

  const project = randomChoice(active);
  const crisis = weightedCrisisPick();
  project.crisisCount++;
  state.counters.crisesHandled++;

  switch (crisis.apply) {
    case "add_task": {
      const task = addExtraTaskToProject(project, "أزمة");
      logActivity("أزمة", `${crisis.message(project.title)} → مهمة جديدة (${task.title})`, "error");
      break;
    }
    case "pull_deadline": {
      const newDeadline = Math.max(
        state.simTime + 2 * MS_PER_DAY,
        project.deadline - 7 * MS_PER_DAY
      );
      project.deadline = newDeadline;
      if (project.priority !== "urgent") project.priority = "urgent";
      logActivity("أزمة", crisis.message(project.title), "error");
      break;
    }
    case "scope_change": {
      for (const task of project.tasks) {
        if (task.status === "todo" || task.status === "in_progress") {
          task.remainingHours = Math.round(
            task.remainingHours * (1.2 + Math.random() * 0.4)
          );
        }
      }
      project.scopeChanges++;
      logActivity("أزمة", crisis.message(project.title), "error");
      break;
    }
    case "reject_delivery": {
      const doneTasks = project.tasks.filter((t) => t.status === "done");
      if (doneTasks.length > 0) {
        const rejected = randomChoice(doneTasks);
        rejected.status = "in_progress";
        rejected.remainingHours = Math.max(4, Math.round(rejected.estimatedHours * 0.5));
        rejected.revisionCount++;
        project.clientRevisions++;
        logActivity("أزمة", `${crisis.message(project.title)} (مهمة: ${rejected.title})`, "error");
      }
      break;
    }
  }
}

export function pruneOldProjects(state: SimState) {
  const cutoff = state.simTime - 30 * MS_PER_DAY;
  state.projects = state.projects.filter((p) => {
    if (p.status === "active" || p.status === "delayed") return true;
    return (p.completedAt ?? p.createdAt) > cutoff;
  });
}
