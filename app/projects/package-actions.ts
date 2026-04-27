"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";

const TARGET_FIELDS = [
  "targetPosts",
  "targetReels",
  "targetVideos",
  "targetShoots",
  "targetStories",
] as const;
const COMPLETED_FIELDS = [
  "completedPosts",
  "completedReels",
  "completedVideos",
  "completedShoots",
  "completedStories",
] as const;

const ALL_FIELDS = [...TARGET_FIELDS, ...COMPLETED_FIELDS];
type PackageField = (typeof ALL_FIELDS)[number];

function clampInt(n: unknown): number {
  const num = typeof n === "string" ? Number(n) : typeof n === "number" ? n : NaN;
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(9999, Math.round(num)));
}

/**
 * Replace the project's package counters wholesale. Used by the "Save package"
 * form on the project page. We upsert because most projects start without a
 * package row.
 */
export async function savePackageAction(projectId: string, formData: FormData) {
  await requirePermission("package", "edit");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  const data: Partial<Record<PackageField, number>> = {};
  for (const field of ALL_FIELDS) {
    data[field] = clampInt(formData.get(field));
  }
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  await prisma.projectPackage.upsert({
    where: { projectId },
    create: { projectId, notes, ...data },
    update: { notes, ...data },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: { surface: "package" },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

/**
 * Quick-increment a single completed counter. Lets the project lead bump
 * "completedPosts" from 3 to 4 without opening the edit form. We never
 * decrement past 0.
 */
export async function bumpPackageCompletedAction(args: {
  projectId: string;
  field: string; // one of the completed* fields
  delta: number; // +1 or -1
}) {
  await requirePermission("package", "edit");

  if (!(COMPLETED_FIELDS as readonly string[]).includes(args.field)) {
    return { ok: false as const, message: "حقل غير صحيح" };
  }
  const field = args.field as (typeof COMPLETED_FIELDS)[number];
  const delta = args.delta === 1 ? 1 : args.delta === -1 ? -1 : 0;
  if (delta === 0) return { ok: false as const, message: "delta غير صحيح" };

  // Read → clamp → write inside a transaction so concurrent bumps don't race.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.projectPackage.findUnique({
      where: { projectId: args.projectId },
    });
    const current = existing?.[field] ?? 0;
    const next = Math.max(0, current + delta);
    if (existing) {
      await tx.projectPackage.update({
        where: { projectId: args.projectId },
        data: { [field]: next },
      });
    } else if (delta > 0) {
      // First-ever bump auto-creates the row.
      await tx.projectPackage.create({
        data: { projectId: args.projectId, [field]: next },
      });
    }
  });

  revalidatePath(`/projects/${args.projectId}`);
  return { ok: true as const };
}
