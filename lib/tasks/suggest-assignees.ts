// Smart assignee suggestion engine — v2 (badge-aware).
//
// When a manager creates a task they can either:
//   (a) explicitly pick required badges (e.g. "صور" + "ديزاينر"), or
//   (b) just type a title — we detect the badges automatically from keywords.
//
// Either way, candidates are scored on four signals:
//
//   1. Badge match (50%)        — % of required badges the user holds.
//                                  When badges are in play this dominates;
//                                  no badge match = filtered out entirely.
//   2. Workload (25%)           — fewer open tasks = more available
//   3. Project membership (15%) — already on the project gets a boost
//   4. Track record (10%)       — % of recent tasks completed
//
// If neither user-picked nor auto-detected badges exist, we fall back to
// the old text-similarity scoring so the suggester still works for one-off
// "buy office supplies" type tasks.

import { prisma } from "@/lib/db/prisma";
import { detectBadgesFromText } from "@/lib/db/badges";

const MAX_PAST_TASKS_PER_USER = 50;
const MAX_OPEN_TASKS_FLOOR = 3;

export interface AssigneeSuggestion {
  user: {
    id: string;
    name: string;
    nickname: string | null;
    jobTitle: string | null;
    department: string | null;
    role: string;
  };
  /** Skill badges the user holds — exposed so the UI can render chips. */
  badges: Array<{
    slug: string;
    labelAr: string;
    labelEn: string;
    icon: string;
    colorHex: string;
    matched: boolean;
  }>;
  score: number; // 0..1
  reasons: SuggestionReason[];
  openTaskCount: number;
  completionRate: number | null;
  topicMatchCount: number;
  isProjectMember: boolean;
}

export interface SuggestionReason {
  kind: "badge" | "free" | "topic" | "project" | "track_record" | "department";
  ar: string;
  en: string;
}

export async function suggestAssignees(opts: {
  title: string;
  description?: string | null;
  projectId?: string | null;
  /** Slugs of badges the manager explicitly required. */
  requiredBadgeSlugs?: string[];
  limit?: number;
}): Promise<{
  suggestions: AssigneeSuggestion[];
  /** Badges we either auto-detected (no explicit picks) or echoed back from the request. */
  inferredBadgeSlugs: string[];
  /** True iff we actually filtered out users who had no matching badge. */
  filteredByBadge: boolean;
}> {
  const { title, description, projectId } = opts;
  const limit = opts.limit ?? 3;
  const explicitBadges = (opts.requiredBadgeSlugs ?? []).filter(Boolean);

  // Auto-detect when the user didn't pick any. Detected badges hint the
  // ranking but don't filter anyone out — we want to surface alternatives.
  const detected = explicitBadges.length === 0
    ? detectBadgesFromText(`${title} ${description ?? ""}`)
    : [];
  const inferredBadgeSlugs = explicitBadges.length > 0 ? explicitBadges : detected;
  const isExplicit = explicitBadges.length > 0;

  // Pull every active employee with their badges in one shot.
  const users = await prisma.user.findMany({
    where: { active: true, approvedAt: { not: null } },
    select: {
      id: true,
      name: true,
      nickname: true,
      role: true,
      jobTitle: true,
      department: true,
      badges: {
        include: { badge: true },
      },
    },
  });

  if (users.length === 0) {
    return { suggestions: [], inferredBadgeSlugs, filteredByBadge: false };
  }

  const userIds = users.map((u) => u.id);
  const [openCounts, recentTasks, projectMembers, project] = await Promise.all([
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
    projectId
      ? prisma.project.findUnique({
          where: { id: projectId },
          select: { type: true, title: true, description: true },
        })
      : Promise.resolve(null),
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

  const newKeywords = tokenize(`${title} ${description ?? ""} ${project?.title ?? ""}`);

  let maxOpen = MAX_OPEN_TASKS_FLOOR;
  for (const c of openByUser.values()) {
    if (c > maxOpen) maxOpen = c;
  }

  // Eligibility filter: when the manager explicitly required badges, hide
  // anyone who has zero of them. With auto-detected badges we keep everyone
  // (the badge match still boosts ranking).
  const filteredByBadge = isExplicit && inferredBadgeSlugs.length > 0;

  const requiredSet = new Set(inferredBadgeSlugs);

  const candidates: AssigneeSuggestion[] = [];
  for (const user of users) {
    const userBadgeSlugs = new Set(user.badges.map((ub) => ub.badge.slug));
    const matchedBadges = inferredBadgeSlugs.filter((slug) => userBadgeSlugs.has(slug));

    if (filteredByBadge && matchedBadges.length === 0) continue;

    const open = openByUser.get(user.id) ?? 0;
    const past = tasksByUser.get(user.id) ?? [];

    const workloadScore = 1 - open / maxOpen;

    // Badge match score — fraction of required badges the user holds.
    const badgeScore =
      inferredBadgeSlugs.length > 0
        ? matchedBadges.length / inferredBadgeSlugs.length
        : 0;

    // Topic similarity from past task titles — used as fallback signal when
    // there are no badges in play, and as a tiny bonus otherwise.
    let topicMatchCount = 0;
    for (const p of past) {
      if (hasOverlap(newKeywords, tokenize(p.title))) topicMatchCount++;
    }
    const topicScore = Math.min(topicMatchCount / 5, 1);

    const projectBonus = projectMemberIds.has(user.id) ? 1 : 0;

    const finished = past.filter((t) => t.status === "done").length;
    const trackRecordRate = past.length >= 3 ? finished / past.length : null;
    const trackRecordScore = trackRecordRate ?? 0.5;

    let score: number;
    if (inferredBadgeSlugs.length > 0) {
      // Badge-driven mode: badges dominate.
      score =
        badgeScore * 0.5 +
        workloadScore * 0.25 +
        projectBonus * 0.15 +
        trackRecordScore * 0.1;
    } else {
      // Free-text mode: fall back to text similarity (old algorithm).
      score =
        workloadScore * 0.4 +
        topicScore * 0.3 +
        projectBonus * 0.2 +
        trackRecordScore * 0.1;
    }

    candidates.push({
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        jobTitle: user.jobTitle,
        department: user.department,
        role: user.role,
      },
      badges: user.badges.map((ub) => ({
        slug: ub.badge.slug,
        labelAr: ub.badge.labelAr,
        labelEn: ub.badge.labelEn,
        icon: ub.badge.icon,
        colorHex: ub.badge.colorHex,
        matched: requiredSet.has(ub.badge.slug),
      })),
      score,
      reasons: buildReasons({
        matchedBadges,
        userBadgesAr: user.badges.map((ub) => ub.badge.labelAr),
        open,
        topicMatchCount,
        isProjectMember: projectBonus > 0,
        completionRate: trackRecordRate,
      }),
      openTaskCount: open,
      completionRate: trackRecordRate,
      topicMatchCount,
      isProjectMember: projectBonus > 0,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return {
    suggestions: candidates.slice(0, limit),
    inferredBadgeSlugs,
    filteredByBadge,
  };
}

function tokenize(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, " ")
    .trim();
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

function hasOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const word of a) {
    if (b.has(word)) return true;
  }
  return false;
}

const STOP_WORDS = new Set([
  "في","من","إلى","على","هذا","هذه","ذلك","تلك","التي","الذي","كان","يكون","هل","ما","لا","نعم","مع","عن","بعد","قبل","خلال","أو","ثم","لكن","كل","بعض","جدا","اي","وش","شنو",
  "the","and","for","with","that","this","these","those","from","into","about","have","has","had","will","would","should","could","can","may","any","all","some","new",
]);

function buildReasons(input: {
  matchedBadges: string[];
  userBadgesAr: string[];
  open: number;
  topicMatchCount: number;
  isProjectMember: boolean;
  completionRate: number | null;
}): SuggestionReason[] {
  const reasons: SuggestionReason[] = [];

  if (input.matchedBadges.length > 0) {
    const labels = input.userBadgesAr.slice(0, 2).join(" + ");
    reasons.push({
      kind: "badge",
      ar: `يحمل شارة: ${labels}`,
      en: `Has badge: ${labels}`,
    });
  }

  if (input.isProjectMember) {
    reasons.push({
      kind: "project",
      ar: "عضو في نفس المشروع",
      en: "Already on this project",
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

  if (input.topicMatchCount > 0) {
    const word = input.topicMatchCount === 1 ? "مهمة مشابهة" : "مهام مشابهة";
    reasons.push({
      kind: "topic",
      ar: `سوّى ${input.topicMatchCount} ${word} قبل`,
      en: `Did ${input.topicMatchCount} similar task${input.topicMatchCount === 1 ? "" : "s"} before`,
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

  return reasons;
}
