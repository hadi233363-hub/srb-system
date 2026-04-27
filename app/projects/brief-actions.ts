"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireActiveUser } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { upsertBrief } from "@/lib/db/brief";
import { prisma } from "@/lib/db/prisma";

function pickString(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function saveBriefAction(projectId: string, formData: FormData) {
  await requirePermission("brief", "edit");
  await requireActiveUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  await upsertBrief({
    projectId,
    patch: {
      objective: pickString(formData, "objective"),
      targetAudience: pickString(formData, "targetAudience"),
      styleNotes: pickString(formData, "styleNotes"),
      refs: pickString(formData, "refs"),
      deliverables: pickString(formData, "deliverables"),
      platforms: pickString(formData, "platforms"),
      sizes: pickString(formData, "sizes"),
      notes: pickString(formData, "notes"),
    },
  });

  // Brief edits aren't catastrophic but we still log them so the audit trail
  // captures who tweaked the brief on the eve of a delivery deadline.
  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: { surface: "brief" },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function setBriefStageAction(
  projectId: string,
  stage: "draft" | "pending_review" | "approved"
) {
  // Only brief:approve can flip to "approved". Anyone with brief:edit can
  // move between draft and pending_review.
  if (stage === "approved") {
    await requirePermission("brief", "approve");
  } else {
    await requirePermission("brief", "edit");
  }
  const actor = await requireActiveUser();

  const brief = await prisma.projectBrief.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!brief) {
    // Auto-create an empty draft so there's something to update.
    await upsertBrief({ projectId, patch: {} });
  }

  await prisma.projectBrief.update({
    where: { projectId },
    data: {
      approvalStage: stage,
      approvedById: stage === "approved" ? actor.id : null,
      approvedAt: stage === "approved" ? new Date() : null,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId },
    metadata: { surface: "brief", stage },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}
