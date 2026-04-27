// Project creative brief — single-record-per-project helper layer.

import { prisma } from "./prisma";

export interface BriefFields {
  objective: string | null;
  targetAudience: string | null;
  styleNotes: string | null;
  refs: string | null;
  deliverables: string | null;
  platforms: string | null;
  sizes: string | null;
  notes: string | null;
}

const FIELD_KEYS = [
  "objective",
  "targetAudience",
  "styleNotes",
  "refs",
  "deliverables",
  "platforms",
  "sizes",
  "notes",
] as const;

export function emptyBrief(): BriefFields {
  return {
    objective: null,
    targetAudience: null,
    styleNotes: null,
    refs: null,
    deliverables: null,
    platforms: null,
    sizes: null,
    notes: null,
  };
}

export async function getBrief(projectId: string) {
  return prisma.projectBrief.findUnique({
    where: { projectId },
    include: { approvedBy: { select: { id: true, name: true } } },
  });
}

export async function upsertBrief(args: {
  projectId: string;
  patch: Partial<BriefFields>;
}) {
  const data: Partial<BriefFields> = {};
  for (const key of FIELD_KEYS) {
    if (key in args.patch) {
      const val = args.patch[key];
      data[key] = val === null ? null : (val ?? "").trim() || null;
    }
  }

  return prisma.projectBrief.upsert({
    where: { projectId: args.projectId },
    create: {
      projectId: args.projectId,
      ...data,
    },
    update: data,
  });
}

/**
 * Generate a short Arabic + English summary of the brief, suitable for
 * pasting into a meeting agenda. We don't call out to an AI — the summary
 * is built mechanically from the populated fields.
 */
export function summarizeBrief(brief: BriefFields, locale: "ar" | "en"): string {
  const lines: string[] = [];
  const isAr = locale === "ar";
  const push = (label: string, value: string | null | undefined) => {
    if (!value) return;
    const cleaned = value.trim();
    if (!cleaned) return;
    lines.push(`${label}: ${cleaned.split("\n").join(" ")}`);
  };
  push(isAr ? "الهدف" : "Objective", brief.objective);
  push(isAr ? "الجمهور" : "Audience", brief.targetAudience);
  push(isAr ? "الستايل" : "Style", brief.styleNotes);
  push(isAr ? "المخرجات" : "Deliverables", brief.deliverables);
  push(isAr ? "المنصات" : "Platforms", brief.platforms);
  push(isAr ? "المقاسات" : "Sizes", brief.sizes);
  push(isAr ? "ملاحظات" : "Notes", brief.notes);
  if (lines.length === 0) {
    return isAr
      ? "لا يوجد بريف بعد — املأ الحقول المطلوبة على الأقل (الهدف، الجمهور، المخرجات)."
      : "No brief yet — fill at least objective, audience, and deliverables.";
  }
  return lines.join("\n");
}

/** Count how many fields are populated — used for the % completion ring. */
export function briefCompletion(brief: BriefFields): number {
  const total = FIELD_KEYS.length;
  let filled = 0;
  for (const k of FIELD_KEYS) {
    const v = brief[k];
    if (typeof v === "string" && v.trim().length > 0) filled++;
  }
  return Math.round((filled / total) * 100);
}
