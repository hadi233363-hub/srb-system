"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requireActiveUser } from "@/lib/auth-guards";
import { isOwner } from "@/lib/auth/roles";
import { createNotificationMany, createNotification } from "@/lib/db/notifications";
import { safeString, MAX_LONG_TEXT } from "@/lib/input-limits";
import { saveUploadedFile, sanitizeLinkUrl } from "@/lib/uploads";

/**
 * Employee submits work for a task. Accepts an optional link, an optional
 * file (JPG/PNG/GIF/PDF, ≤10 MB), or both. At least one MUST be present.
 *
 * Side effects:
 *   1. Creates a TaskSubmission row (audit + history).
 *   2. Flips the task to `in_review` (NOT `done`).
 *   3. Notifies every active owner so they can review.
 */
export async function submitTaskWorkAction(taskId: string, formData: FormData) {
  const user = await requireActiveUser();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      collaborators: { select: { userId: true } },
      project: { select: { id: true, title: true } },
    },
  });
  if (!task) return { ok: false, message: "المهمة غير موجودة" };

  const isAssignee = task.assigneeId === user.id;
  const isCollab = task.collaborators.some((c) => c.userId === user.id);
  if (!isAssignee && !isCollab) {
    return { ok: false, message: "ما تقدر تسلّم مهمة موب لك" };
  }

  let linkUrl: string | null;
  let note: string | null;
  try {
    linkUrl = sanitizeLinkUrl(formData.get("linkUrl"));
    note = safeString(formData.get("note"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }

  // Optional file
  const fileEntry = formData.get("file");
  let saved = null as null | Awaited<ReturnType<typeof saveUploadedFile>>;
  if (fileEntry && typeof fileEntry !== "string") {
    const f = fileEntry as File;
    if (f.size > 0) {
      try {
        saved = await saveUploadedFile(f, "tasks");
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "فشل رفع الملف" };
      }
    }
  }

  if (!linkUrl && !saved) {
    return { ok: false, message: "أرفق رابط أو ملف على الأقل" };
  }

  const submission = await prisma.taskSubmission.create({
    data: {
      taskId,
      submitterId: user.id,
      linkUrl: linkUrl ?? null,
      fileUrl: saved?.url ?? null,
      fileName: saved?.fileName ?? null,
      fileType: saved?.fileType ?? null,
      fileSize: saved?.fileSize ?? null,
      note,
      status: "pending",
    },
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "in_review",
      ...(task.startedAt ? {} : { startedAt: new Date() }),
    },
  });

  await prisma.taskUpdate.create({
    data: {
      taskId,
      actorId: user.id,
      type: "status_change",
      fromValue: task.status,
      toValue: "in_review",
    },
  });

  // Notify all active owners (admins).
  const owners = await prisma.user.findMany({
    where: { role: "admin", active: true },
    select: { id: true },
  });
  if (owners.length > 0) {
    await createNotificationMany(
      owners.map((o) => o.id),
      {
        kind: "task.submitted",
        severity: "info",
        title: `${user.name ?? "موظف"} سلّم مهمة "${task.title}" — راجعها`,
        body: task.project ? `المشروع: ${task.project.title}` : null,
        linkUrl: task.projectId ? `/projects/${task.projectId}` : "/tasks",
        refType: "task",
        refId: taskId,
      }
    );
  }

  await logAudit({
    action: "task.update",
    target: { type: "task", id: taskId, label: task.title },
    metadata: {
      event: "submission.created",
      submissionId: submission.id,
      hasLink: !!linkUrl,
      hasFile: !!saved,
    },
  });

  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true, id: submission.id };
}

/**
 * Owner approves the latest pending submission → task moves to `done`,
 * employee gets a notification.
 */
export async function approveTaskSubmissionAction(taskId: string) {
  const user = await requireActiveUser();
  if (!isOwner(user.role)) {
    return { ok: false, message: "الموافقة للرئيس فقط" };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, title: true } },
      submissions: {
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!task) return { ok: false, message: "المهمة غير موجودة" };

  const submission = task.submissions[0];
  if (!submission) {
    return { ok: false, message: "ما فيه تسليم بانتظار المراجعة" };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.taskSubmission.update({
      where: { id: submission.id },
      data: {
        status: "approved",
        reviewerId: user.id,
        reviewedAt: now,
      },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: {
        status: "done",
        completedAt: now,
      },
    }),
    prisma.taskUpdate.create({
      data: {
        taskId,
        actorId: user.id,
        type: "status_change",
        fromValue: task.status,
        toValue: "done",
      },
    }),
  ]);

  await createNotification({
    recipientId: submission.submitterId,
    kind: "task.approved",
    severity: "success",
    title: `تمت الموافقة على "${task.title}"`,
    body: "شغلك انعتمد ✅",
    linkUrl: task.projectId ? `/projects/${task.projectId}` : "/tasks",
    refType: "task",
    refId: taskId,
  }).catch(() => null);

  await logAudit({
    action: "task.update",
    target: { type: "task", id: taskId, label: task.title },
    metadata: { event: "submission.approved", submissionId: submission.id },
  });

  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true };
}

/**
 * Owner requests changes on the latest pending submission. Provides a reason,
 * task drops back to `in_progress`, employee receives a notification.
 */
export async function requestTaskChangesAction(taskId: string, formData: FormData) {
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
  if (!reason) {
    return { ok: false, message: "اكتب سبب طلب التعديل" };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, title: true } },
      submissions: {
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!task) return { ok: false, message: "المهمة غير موجودة" };

  const submission = task.submissions[0];
  if (!submission) {
    return { ok: false, message: "ما فيه تسليم بانتظار المراجعة" };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.taskSubmission.update({
      where: { id: submission.id },
      data: {
        status: "changes_requested",
        reviewerId: user.id,
        reviewedAt: now,
        reviewNotes: reason,
      },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: "in_progress" },
    }),
    prisma.taskUpdate.create({
      data: {
        taskId,
        actorId: user.id,
        type: "status_change",
        fromValue: task.status,
        toValue: "in_progress",
      },
    }),
  ]);

  await createNotification({
    recipientId: submission.submitterId,
    kind: "task.changes_requested",
    severity: "warning",
    title: `طُلب تعديل على "${task.title}"`,
    body: reason,
    linkUrl: task.projectId ? `/projects/${task.projectId}` : "/tasks",
    refType: "task",
    refId: taskId,
  }).catch(() => null);

  await logAudit({
    action: "task.update",
    target: { type: "task", id: taskId, label: task.title },
    metadata: {
      event: "submission.changes_requested",
      submissionId: submission.id,
    },
  });

  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true };
}
