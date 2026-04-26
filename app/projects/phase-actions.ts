"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import {
  requireActiveUser,
  requireDeptLeadOrAbove,
} from "@/lib/auth-guards";
import { isOwner } from "@/lib/auth/roles";
import { createNotificationMany, createNotification } from "@/lib/db/notifications";
import {
  safeString,
  MAX_LONG_TEXT,
  MAX_TITLE_LEN,
} from "@/lib/input-limits";
import { saveUploadedFile, sanitizeLinkUrl } from "@/lib/uploads";
import {
  findTemplate,
  templatePhaseNames,
  type Locale,
} from "@/lib/projects/phase-templates";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createPhaseAction(
  projectId: string,
  formData: FormData
) {
  await requireDeptLeadOrAbove();

  let name: string | null;
  let description: string | null;
  try {
    name = safeString(formData.get("name"), MAX_TITLE_LEN);
    description = safeString(formData.get("description"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  if (!name) return { ok: false, message: "اسم المرحلة مطلوب" };

  const deadlineRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt = deadlineRaw ? new Date(deadlineRaw) : null;

  const last = await prisma.projectPhase.findFirst({
    where: { projectId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = last ? last.order + 1 : 1;

  // First phase starts active; subsequent phases land locked until the prior
  // is approved.
  const initialStatus = nextOrder === 1 ? "active" : "locked";

  const phase = await prisma.projectPhase.create({
    data: {
      projectId,
      name,
      description,
      deadlineAt,
      order: nextOrder,
      status: initialStatus,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: name },
    metadata: { event: "phase.create", phaseId: phase.id, order: nextOrder },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: phase.id };
}

export async function updatePhaseAction(
  phaseId: string,
  formData: FormData
) {
  await requireDeptLeadOrAbove();
  const before = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
  if (!before) return { ok: false, message: "المرحلة غير موجودة" };

  let name: string | null | undefined;
  let description: string | null | undefined;
  try {
    const rawName = formData.get("name");
    name = rawName === null ? undefined : safeString(rawName, MAX_TITLE_LEN);
    const rawDesc = formData.get("description");
    description =
      rawDesc === null ? undefined : safeString(rawDesc, MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const deadlineRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt =
    deadlineRaw === null
      ? undefined
      : deadlineRaw === ""
      ? null
      : new Date(deadlineRaw);

  await prisma.projectPhase.update({
    where: { id: phaseId },
    data: {
      ...(name !== undefined && name !== null ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(deadlineAt !== undefined ? { deadlineAt } : {}),
    },
  });

  revalidatePath(`/projects/${before.projectId}`);
  return { ok: true };
}

export async function deletePhaseAction(phaseId: string) {
  await requireDeptLeadOrAbove();
  const before = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
  if (!before) return { ok: false, message: "المرحلة غير موجودة" };

  await prisma.$transaction([
    // Detach tasks (don't delete them — they may still be relevant outside the phase).
    prisma.task.updateMany({
      where: { phaseId },
      data: { phaseId: null },
    }),
    prisma.projectPhase.delete({ where: { id: phaseId } }),
  ]);

  await logAudit({
    action: "project.update",
    target: { type: "project", id: before.projectId, label: before.name },
    metadata: { event: "phase.delete", phaseId },
  });

  revalidatePath(`/projects/${before.projectId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function applyPhaseTemplateAction(
  projectId: string,
  templateKey: string,
  locale: Locale = "ar"
) {
  await requireDeptLeadOrAbove();
  const tpl = findTemplate(templateKey);
  if (!tpl) return { ok: false, message: "قالب غير معروف" };

  // Refuse if the project already has phases — the template is for new projects.
  const existing = await prisma.projectPhase.count({ where: { projectId } });
  if (existing > 0) {
    return { ok: false, message: "المشروع فيه مراحل أصلاً — احذفها أولاً" };
  }

  const names = templatePhaseNames(tpl, locale);
  await prisma.$transaction(
    names.map((name, idx) =>
      prisma.projectPhase.create({
        data: {
          projectId,
          name,
          order: idx + 1,
          status: idx === 0 ? "active" : "locked",
        },
      })
    )
  );

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: `template:${templateKey}` },
    metadata: { event: "phase.template_applied", templateKey, count: names.length },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lock / unlock — owner-only override
// ---------------------------------------------------------------------------

export async function unlockPhaseAction(phaseId: string) {
  const user = await requireActiveUser();
  if (!isOwner(user.role)) {
    return { ok: false, message: "فك القفل للرئيس فقط" };
  }
  const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
  if (!phase) return { ok: false, message: "المرحلة غير موجودة" };
  if (phase.status === "completed") {
    return { ok: false, message: "المرحلة مكتملة أصلاً" };
  }

  await prisma.projectPhase.update({
    where: { id: phaseId },
    data: { status: "active" },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: phase.projectId, label: phase.name },
    metadata: { event: "phase.unlocked", phaseId },
  });

  revalidatePath(`/projects/${phase.projectId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase delivery — employee submits proof, owner approves to unlock the next.
// ---------------------------------------------------------------------------

export async function submitPhaseCompletionAction(
  phaseId: string,
  formData: FormData
) {
  const user = await requireActiveUser();

  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId },
    include: { project: { select: { id: true, title: true } } },
  });
  if (!phase) return { ok: false, message: "المرحلة غير موجودة" };
  if (phase.status === "locked") {
    return { ok: false, message: "المرحلة مقفولة — لازم الرئيس يفكها" };
  }
  if (phase.status === "completed") {
    return { ok: false, message: "المرحلة مكتملة" };
  }

  let linkUrl: string | null;
  try {
    linkUrl = sanitizeLinkUrl(formData.get("linkUrl"));
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }

  const fileEntry = formData.get("file");
  let saved = null as null | Awaited<ReturnType<typeof saveUploadedFile>>;
  if (fileEntry && typeof fileEntry !== "string") {
    const f = fileEntry as File;
    if (f.size > 0) {
      try {
        saved = await saveUploadedFile(f, "phases");
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "فشل رفع الملف" };
      }
    }
  }

  if (!linkUrl && !saved) {
    return { ok: false, message: "أرفق دليل تسليم — رابط أو ملف" };
  }

  await prisma.projectPhase.update({
    where: { id: phaseId },
    data: {
      proofLinkUrl: linkUrl,
      proofFileUrl: saved?.url ?? null,
      proofFileName: saved?.fileName ?? null,
      proofFileType: saved?.fileType ?? null,
      submittedAt: new Date(),
      submittedById: user.id,
      reviewNotes: null,
      reviewedAt: null,
    },
  });

  // Notify owners.
  const owners = await prisma.user.findMany({
    where: { role: "admin", active: true },
    select: { id: true },
  });
  if (owners.length > 0) {
    await createNotificationMany(
      owners.map((o) => o.id),
      {
        kind: "phase.submitted",
        severity: "info",
        title: `${user.name ?? "موظف"} سلّم مرحلة "${phase.name}"`,
        body: `المشروع: ${phase.project.title}`,
        linkUrl: `/projects/${phase.projectId}`,
        refType: "project",
        refId: phase.projectId,
      }
    );
  }

  await logAudit({
    action: "project.update",
    target: { type: "project", id: phase.projectId, label: phase.name },
    metadata: { event: "phase.submitted", phaseId },
  });

  revalidatePath(`/projects/${phase.projectId}`);
  return { ok: true };
}

export async function approvePhaseAction(phaseId: string) {
  const user = await requireActiveUser();
  if (!isOwner(user.role)) {
    return { ok: false, message: "الموافقة للرئيس فقط" };
  }

  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId },
    include: { project: { select: { id: true, title: true } } },
  });
  if (!phase) return { ok: false, message: "المرحلة غير موجودة" };
  if (phase.status === "completed") {
    return { ok: false, message: "مكتملة أصلاً" };
  }

  const now = new Date();
  await prisma.projectPhase.update({
    where: { id: phaseId },
    data: {
      status: "completed",
      reviewedAt: now,
      approvedById: user.id,
    },
  });

  // Unlock the next phase (if any).
  const next = await prisma.projectPhase.findFirst({
    where: {
      projectId: phase.projectId,
      order: { gt: phase.order },
      status: "locked",
    },
    orderBy: { order: "asc" },
  });
  if (next) {
    await prisma.projectPhase.update({
      where: { id: next.id },
      data: { status: "active" },
    });
  }

  if (phase.submittedById && phase.submittedById !== user.id) {
    await createNotification({
      recipientId: phase.submittedById,
      kind: "phase.approved",
      severity: "success",
      title: `تمت الموافقة على المرحلة "${phase.name}"`,
      body: next ? `تم فتح المرحلة التالية: ${next.name}` : null,
      linkUrl: `/projects/${phase.projectId}`,
      refType: "project",
      refId: phase.projectId,
    }).catch(() => null);
  }

  await logAudit({
    action: "project.update",
    target: { type: "project", id: phase.projectId, label: phase.name },
    metadata: {
      event: "phase.approved",
      phaseId,
      nextUnlocked: next?.id ?? null,
    },
  });

  revalidatePath(`/projects/${phase.projectId}`);
  return { ok: true };
}

export async function rejectPhaseAction(
  phaseId: string,
  formData: FormData
) {
  const user = await requireActiveUser();
  if (!isOwner(user.role)) {
    return { ok: false, message: "الإجراء للرئيس فقط" };
  }

  let reason: string | null;
  try {
    reason = safeString(formData.get("reason"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  if (!reason) return { ok: false, message: "اكتب سبب طلب التعديل" };

  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId },
    include: { project: { select: { id: true, title: true } } },
  });
  if (!phase) return { ok: false, message: "المرحلة غير موجودة" };
  if (phase.status === "completed") {
    return { ok: false, message: "المرحلة مكتملة" };
  }

  await prisma.projectPhase.update({
    where: { id: phaseId },
    data: {
      reviewNotes: reason,
      reviewedAt: new Date(),
      // Stay active so the employee can resubmit.
      status: "active",
      submittedAt: null,
    },
  });

  if (phase.submittedById) {
    await createNotification({
      recipientId: phase.submittedById,
      kind: "phase.changes_requested",
      severity: "warning",
      title: `طُلب تعديل على المرحلة "${phase.name}"`,
      body: reason,
      linkUrl: `/projects/${phase.projectId}`,
      refType: "project",
      refId: phase.projectId,
    }).catch(() => null);
  }

  await logAudit({
    action: "project.update",
    target: { type: "project", id: phase.projectId, label: phase.name },
    metadata: { event: "phase.changes_requested", phaseId },
  });

  revalidatePath(`/projects/${phase.projectId}`);
  return { ok: true };
}
