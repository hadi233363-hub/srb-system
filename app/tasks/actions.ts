"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requireActiveUser as requireAuth } from "@/lib/auth-guards";
import { isDeptLeadOrAbove } from "@/lib/auth/roles";
import { createNotification } from "@/lib/db/notifications";
import {
  safeString,
  MAX_LONG_TEXT,
  MAX_TITLE_LEN,
} from "@/lib/input-limits";

export async function createTaskAction(formData: FormData) {
  const user = await requireAuth();

  let title: string | null;
  let description: string | null;
  try {
    title = safeString(formData.get("title"), MAX_TITLE_LEN);
    description = safeString(formData.get("description"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const projectId = (formData.get("projectId") as string | null) || null;
  const assigneeId = (formData.get("assigneeId") as string | null) || null;
  const priority = (formData.get("priority") as string | null) || "normal";
  const status = (formData.get("status") as string | null) || "todo";
  const dueAtRaw = formData.get("dueAt") as string | null;
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;
  const estimatedHoursRaw = formData.get("estimatedHours") as string | null;
  const estimatedHours = estimatedHoursRaw ? parseFloat(estimatedHoursRaw) : null;

  if (!title) {
    return { ok: false, message: "عنوان المهمة مطلوب" };
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      projectId,
      assigneeId,
      creatorId: user.id,
      priority,
      status,
      dueAt,
      estimatedHours: estimatedHours && !isNaN(estimatedHours) ? estimatedHours : null,
    },
  });

  await prisma.taskUpdate.create({
    data: {
      taskId: task.id,
      actorId: user.id,
      type: "created",
      toValue: status,
    },
  });

  // Drop a notification in the assignee's inbox so they know the moment a task
  // is dropped on them. Skip if they assigned it to themselves.
  if (assigneeId && assigneeId !== user.id) {
    await createNotification({
      recipientId: assigneeId,
      kind: "task.assigned",
      severity: "info",
      title: `مهمة جديدة: ${title}`,
      body: dueAt ? `الموعد: ${dueAt.toLocaleString("ar")}` : null,
      linkUrl: "/tasks",
      refType: "task",
      refId: task.id,
    }).catch(() => null);
  }

  await logAudit({
    action: "task.create",
    target: { type: "task", id: task.id, label: task.title },
    metadata: { projectId, assigneeId, priority, status },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: task.id };
}

export async function updateTaskStatusAction(id: string, status: string) {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { ok: false, message: "المهمة غير موجودة" };

  const wasDone = task.status === "done";
  const nowDone = status === "done";

  await prisma.task.update({
    where: { id },
    data: {
      status,
      ...(nowDone && !wasDone ? { completedAt: new Date() } : {}),
      ...(!nowDone && wasDone ? { completedAt: null } : {}),
      ...(status === "in_progress" && !task.startedAt
        ? { startedAt: new Date() }
        : {}),
    },
  });

  await prisma.taskUpdate.create({
    data: {
      taskId: id,
      actorId: user.id,
      type: "status_change",
      fromValue: task.status,
      toValue: status,
    },
  });

  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateTaskAction(id: string, formData: FormData) {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { ok: false, message: "المهمة غير موجودة" };

  const title = (formData.get("title") as string | null)?.trim();
  const description = formData.get("description") as string | null;
  const assigneeId = formData.get("assigneeId") as string | null;
  const priority = formData.get("priority") as string | null;
  const status = formData.get("status") as string | null;
  const dueAtRaw = formData.get("dueAt") as string | null;
  const projectId = formData.get("projectId") as string | null;
  const estimatedHoursRaw = formData.get("estimatedHours") as string | null;
  // Collaborators arrive as CSV string "id1,id2,id3"
  const collaboratorsRaw = formData.get("collaboratorIds") as string | null;
  const collaboratorIds =
    collaboratorsRaw === null
      ? null
      : collaboratorsRaw
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

  const wasDone = task.status === "done";
  const nowDone = status === "done";
  const estHours = estimatedHoursRaw ? parseFloat(estimatedHoursRaw) : undefined;

  // If dueAt was rescheduled FORWARD (later than the previous value), reset
  // the reminder flags so a fresh "due-soon" alert can fire for the new
  // window. We only reset on forward moves so backward moves don't accidentally
  // re-trigger an alert that was already sent.
  const newDueAt = dueAtRaw === null ? undefined : dueAtRaw ? new Date(dueAtRaw) : null;
  const dueMovedForward =
    newDueAt !== undefined &&
    newDueAt !== null &&
    (!task.dueAt || newDueAt.getTime() > task.dueAt.getTime());

  await prisma.task.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(description !== null ? { description: description.trim() || null } : {}),
      ...(assigneeId !== null ? { assigneeId: assigneeId || null } : {}),
      ...(priority ? { priority } : {}),
      ...(status ? { status } : {}),
      ...(projectId !== null ? { projectId: projectId || null } : {}),
      ...(estHours !== undefined && !isNaN(estHours) ? { estimatedHours: estHours } : {}),
      ...(dueAtRaw !== null
        ? { dueAt: dueAtRaw ? new Date(dueAtRaw) : null }
        : {}),
      ...(dueMovedForward
        ? { reminderBeforeSentAt: null, reminderOverdueSentAt: null }
        : {}),
      ...(nowDone && !wasDone ? { completedAt: new Date() } : {}),
      ...(!nowDone && wasDone ? { completedAt: null } : {}),
    },
  });

  // Notify the new assignee if it changed and isn't the same actor.
  if (
    assigneeId !== null &&
    assigneeId &&
    assigneeId !== task.assigneeId &&
    assigneeId !== user.id
  ) {
    await createNotification({
      recipientId: assigneeId,
      kind: "task.assigned",
      severity: "info",
      title: `صار عندك مهمة: ${title ?? task.title}`,
      linkUrl: "/tasks",
      refType: "task",
      refId: id,
    }).catch(() => null);
  }

  // Replace collaborators list if provided.
  if (collaboratorIds !== null) {
    // Filter out the primary assignee so they aren't also a collaborator.
    const effectiveAssignee =
      assigneeId !== null ? (assigneeId || null) : task.assigneeId;
    const finalCollabs = collaboratorIds.filter((cid) => cid !== effectiveAssignee);

    await prisma.taskCollaborator.deleteMany({ where: { taskId: id } });
    if (finalCollabs.length > 0) {
      await prisma.taskCollaborator.createMany({
        data: finalCollabs.map((userId) => ({ taskId: id, userId })),
      });
    }
  }

  // Audit trail for assignee changes.
  if (assigneeId !== null && assigneeId !== task.assigneeId) {
    await prisma.taskUpdate.create({
      data: {
        taskId: id,
        actorId: user.id,
        type: "assignee_change",
        fromValue: task.assigneeId,
        toValue: assigneeId || null,
      },
    });
  }
  if (status && status !== task.status) {
    await prisma.taskUpdate.create({
      data: {
        taskId: id,
        actorId: user.id,
        type: "status_change",
        fromValue: task.status,
        toValue: status,
      },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/team");
  revalidatePath(`/team/${task.assigneeId}`);
  if (assigneeId) revalidatePath(`/team/${assigneeId}`);
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  if (projectId && projectId !== task.projectId) revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteTaskAction(id: string) {
  // Tighter than before: only the creator, the assignee, or a dept_lead+ can
  // delete a task. Stops random employees from wiping a teammate's work.
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { ok: false, message: "المهمة غير موجودة" };

  const isCreator = task.creatorId === user.id;
  const isAssignee = task.assigneeId === user.id;
  if (!isCreator && !isAssignee && !isDeptLeadOrAbove(user.role)) {
    return { ok: false, message: "ما تقدر تحذف مهمة موب لك" };
  }

  await prisma.task.delete({ where: { id } });
  await logAudit({
    action: "task.delete",
    target: { type: "task", id, label: task.title },
    metadata: { projectId: task.projectId, status: task.status },
  });
  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true };
}

// Server-side flag setters for the in-app reminder poller. Each one stamps
// the corresponding `reminderXxxSentAt` so the next /api/tasks/upcoming poll
// won't return the same task again. We also drop a Notification row in the
// recipient's inbox so they have a record they can review later from any
// device — even if their browser missed the desktop notification.

export async function markTaskBeforeReminderSentAction(id: string) {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { title: true } } },
  });
  if (!task) return { ok: false };

  // Only the assignee or a collaborator may mark — prevents an outsider from
  // silencing somebody else's reminder.
  const collab = await prisma.taskCollaborator.findUnique({
    where: { taskId_userId: { taskId: id, userId: user.id } },
  });
  if (task.assigneeId !== user.id && !collab) return { ok: false };

  await prisma.task.updateMany({
    where: { id, reminderBeforeSentAt: null },
    data: { reminderBeforeSentAt: new Date() },
  });

  await createNotification({
    recipientId: user.id,
    kind: "task.due_soon",
    severity: "warning",
    title: `قرّب موعد المهمة: ${task.title}`,
    body: task.dueAt ? `الموعد: ${task.dueAt.toLocaleString("ar")}` : null,
    linkUrl: "/tasks",
    refType: "task",
    refId: id,
    dedupeKey: { kind: "task.due_soon", refType: "task", refId: id },
  }).catch(() => null);

  return { ok: true };
}

export async function markTaskOverdueReminderSentAction(id: string) {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { title: true, deadlineAt: true } } },
  });
  if (!task) return { ok: false };

  const collab = await prisma.taskCollaborator.findUnique({
    where: { taskId_userId: { taskId: id, userId: user.id } },
  });
  if (task.assigneeId !== user.id && !collab) return { ok: false };

  await prisma.task.updateMany({
    where: { id, reminderOverdueSentAt: null },
    data: { reminderOverdueSentAt: new Date() },
  });

  await createNotification({
    recipientId: user.id,
    kind: "task.overdue",
    severity: "danger",
    title: `تأخّرت المهمة: ${task.title}`,
    body: task.project?.deadlineAt
      ? `لكن موعد التسليم للعميل: ${task.project.deadlineAt.toLocaleString("ar")} — لسا في وقت`
      : "تجاوزت موعدها — حدّثها",
    linkUrl: "/tasks",
    refType: "task",
    refId: id,
    dedupeKey: { kind: "task.overdue", refType: "task", refId: id },
  }).catch(() => null);

  return { ok: true };
}


export async function addCommentAction(taskId: string, content: string) {
  const user = await requireAuth();
  if (!content.trim()) return { ok: false };
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false };

  await prisma.taskComment.create({
    data: {
      taskId,
      authorId: user.id,
      content: content.trim(),
    },
  });
  revalidatePath("/tasks");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true };
}
