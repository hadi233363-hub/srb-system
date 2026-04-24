// Smart assignee suggestion engine.
//
// When a manager types a new task, we want the system to nudge them toward
// the *right* person — not just show every employee in alphabetical order.
//
// "Right" combines four signals (weights tuned for a small agency where
// availability matters more than past expertise):
//
//   1. Workload (40%)        — fewer open tasks = more available
//   2. Topic match (30%)     — keywords overlap with the user's past
//                              completed tasks
//   3. Project membership (20%) — already on the project gets a boost
//   4. Track record (10%)    — % of recent tasks completed (not failed/blocked)
//
// We compute a 0–1 fit score per active user, attach a small list of
// human-readable reasons, and return the top N.
//
// We don't filter anyone out — even a "0% match" employee shows up if
// asked for explicitly. Suggestions are advisory; the manager decides.

import { prisma } from "@/lib/db/prisma";

const MAX_PAST_TASKS_PER_USER = 50;
const MAX_OPEN_TASKS_FLOOR = 3; // workload normalization floor — fewer than this is "very free"

export interface AssigneeSuggestion {
  user: {
    id: string;
    name: string;
    email: string;
    jobTitle: string | null;
    department: string | null;
    role: string;
  };
  score: number; // 0..1
  reasons: SuggestionReason[];
  openTaskCount: number;
  completionRate: number | null; // 0..1, null if no history
  topicMatchCount: number; // raw count of past tasks with overlapping keywords
  isProjectMember: boolean;
}

export interface SuggestionReason {
  kind: "free" | "topic" | "project" | "track_record" | "department";
  /** Human-readable Arabic + English. The component picks the right one. */
  ar: string;
  en: string;
}

export async function suggestAssignees(opts: {
  title: string;
  description?: string | null;
  projectId?: string | null;
  limit?: number;
}): Promise<AssigneeSuggestion[]> {
  const { title, description, projectId } = opts;
  const limit = opts.limit ?? 3;

  // Pull every active employee — small agency, so this is a tiny query.
  const users = await prisma.user.findMany({
    where: { active: true, approvedAt: { not: null } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
      department: true,
    },
  });

  if (users.length === 0) return [];

  // Pull each user's open task count + recent task history in one shot.
  const userIds = users.map((u) => u.id);
  const [openCounts, recentTasks, projectMembers] = await Promise.all([
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: userIds },
        status: { in: ["todo", "in_progress", "in_review"] },
      },
      _count: { _all: true },
    }),
    prisma.task.findMany({
      where: { assigneeId: { in: userIds } },
      orderBy: { updatedAt: "desc" },
      take: MAX_PAST_TASKS_PER_USER * userIds.length,
      select: {
        assigneeId: true,
        title: true,
        status: true,
        completedAt: true,
      },
    }),
    projectId
      ? prisma.projectMember.findMany({
          where: { projectId, userId: { in: userIds } },
          select: { userId: true, role: true },
        })
      : Promise.resolve([] as { userId: string; role: string | null }[]),
  ]);

  const openByUser = new Map<string, number>();
  for (const row of openCounts) {
    if (row.assigneeId) openByUser.set(row.assigneeId, row._count._all);
  }

  const tasksByUser = new Map<
    string,
    Array<{ title: string; status: string; completedAt: Date | null }>
  >();
  for (const t of recentTasks) {
    if (!t.assigneeId) continue;
    const arr = tasksByUser.get(t.assigneeId) ?? [];
    if (arr.length < MAX_PAST_TASKS_PER_USER) {
      arr.push({ title: t.title, status: t.status, completedAt: t.completedAt });
      tasksByUser.set(t.assigneeId, arr);
    }
  }

  const projectMemberIds = new Set(projectMembers.map((m) => m.userId));

  // Project info — used for "department alignment" hint.
  const project = projectId
    ? await prisma.project.findUnique({
        where: { id: projectId },
        select: { type: true, title: true, description: true },
      })
    : null;

  // Tokenize the new task once.
  const newKeywords = tokenize(`${title} ${description ?? ""} ${project?.title ?? ""}`);

  // Find the maximum open-task count so we can normalize without dividing
  // by a tiny number (otherwise one super-busy person would skew everyone).
  let maxOpen = MAX_OPEN_TASKS_FLOOR;
  for (const c of openByUser.values()) {
    if (c > maxOpen) maxOpen = c;
  }

  const results: AssigneeSuggestion[] = users.map((user) => {
    const open = openByUser.get(user.id) ?? 0;
    const past = tasksByUser.get(user.id) ?? [];

    const workloadScore = 1 - open / maxOpen; // 1 = totally free, 0 = max busy

    // Topic match — how many past tasks share at least one keyword.
    let topicMatchCount = 0;
    for (const p of past) {
      const pastKeywords = tokenize(p.title);
      if (hasOverlap(newKeywords, pastKeywords)) topicMatchCount++;
    }
    // Normalize: 5+ matching past tasks = full score.
    const topicScore = Math.min(topicMatchCount / 5, 1);

    const projectBonus = projectMemberIds.has(user.id) ? 1 : 0;

    // Completion rate — pct of recent tasks that ended in "done".
    const finished = past.filter((t) => t.status === "done").length;
    const trackRecordRate = past.length >= 3 ? finished / past.length : null;
    const trackRecordScore = trackRecordRate ?? 0.5; // unknown = neutral

    const score =
      workloadScore * 0.4 +
      topicScore * 0.3 +
      projectBonus * 0.2 +
      trackRecordScore * 0.1;

    return {
      user,
      score,
      reasons: buildReasons({
        open,
        topicMatchCount,
        isProjectMember: projectBonus > 0,
        completionRate: trackRecordRate,
        userJobTitle: user.jobTitle,
        userDepartment: user.department,
        projectType: project?.type ?? null,
      }),
      openTaskCount: open,
      completionRate: trackRecordRate,
      topicMatchCount,
      isProjectMember: projectBonus > 0,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Turn a chunk of text into a set of normalized keywords. Strips punctuation,
 * lowercases, drops Arabic + English stop-words, and ignores very short tokens.
 */
function tokenize(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    // Replace any non-letter (Arabic + Latin) with whitespace.
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

function hasOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const word of a) {
    if (b.has(word)) return true;
  }
  return false;
}

const STOP_WORDS = new Set([
  // Arabic
  "في",
  "من",
  "إلى",
  "على",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
  "التي",
  "الذي",
  "كان",
  "يكون",
  "هل",
  "ما",
  "لا",
  "نعم",
  "مع",
  "عن",
  "بعد",
  "قبل",
  "خلال",
  "أو",
  "ثم",
  "لكن",
  "كل",
  "بعض",
  "جدا",
  "اي",
  "وش",
  "شنو",
  // English
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "these",
  "those",
  "from",
  "into",
  "about",
  "have",
  "has",
  "had",
  "will",
  "would",
  "should",
  "could",
  "can",
  "may",
  "any",
  "all",
  "some",
  "new",
]);

function buildReasons(input: {
  open: number;
  topicMatchCount: number;
  isProjectMember: boolean;
  completionRate: number | null;
  userJobTitle: string | null;
  userDepartment: string | null;
  projectType: string | null;
}): SuggestionReason[] {
  const reasons: SuggestionReason[] = [];

  if (input.isProjectMember) {
    reasons.push({
      kind: "project",
      ar: "عضو في نفس المشروع",
      en: "Already on this project",
    });
  }

  if (input.topicMatchCount > 0) {
    const word = input.topicMatchCount === 1 ? "مهمة مشابهة" : "مهام مشابهة";
    reasons.push({
      kind: "topic",
      ar: `سوّى ${input.topicMatchCount} ${word} قبل`,
      en: `Did ${input.topicMatchCount} similar task${input.topicMatchCount === 1 ? "" : "s"} before`,
    });
  }

  if (input.open === 0) {
    reasons.push({
      kind: "free",
      ar: "متفرّغ تماماً — ما عنده مهام مفتوحة",
      en: "Fully free — no open tasks",
    });
  } else if (input.open <= 2) {
    reasons.push({
      kind: "free",
      ar: `خفيف الجدول — ${input.open} مهام بس`,
      en: `Light load — only ${input.open} task${input.open === 1 ? "" : "s"}`,
    });
  }

  if (input.completionRate !== null && input.completionRate >= 0.8) {
    const pct = Math.round(input.completionRate * 100);
    reasons.push({
      kind: "track_record",
      ar: `نسبة إنجاز عالية: ${pct}%`,
      en: `Strong track record: ${pct}%`,
    });
  }

  if (
    input.userDepartment &&
    input.projectType &&
    departmentMatchesProjectType(input.userDepartment, input.projectType)
  ) {
    reasons.push({
      kind: "department",
      ar: `تخصصه ${input.userDepartment} يناسب نوع المشروع`,
      en: `${input.userDepartment} background fits the project type`,
    });
  }

  return reasons;
}

function departmentMatchesProjectType(dept: string, projectType: string): boolean {
  const d = dept.toLowerCase();
  const p = projectType.toLowerCase();
  if (p === "video" && (d.includes("video") || d.includes("فيديو") || d.includes("مونتاج"))) return true;
  if (p === "photo" && (d.includes("photo") || d.includes("تصوير"))) return true;
  if (p === "web" && (d.includes("dev") || d.includes("برمج") || d.includes("ويب"))) return true;
  if (p === "digital_campaign" && (d.includes("market") || d.includes("تسويق") || d.includes("ads"))) return true;
  if (p === "event" && (d.includes("event") || d.includes("فعاليات"))) return true;
  return false;
}
