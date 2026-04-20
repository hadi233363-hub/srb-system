"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  return session.user;
}

export async function createTaskAction(formData: FormData) {
  const user = await requireAuth();

  const title = (formData.get("title") as string | null)?.trim();
  const description =
    (formData.get("description") as string | null)?.trim() || null;
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
      ...(nowDone && !wasDone ? { completedAt: new Date() } : {}),
      ...(!nowDone && wasDone ? { completedAt: null } : {}),
    },
  });

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
  await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
  if (task?.projectId) revalidatePath(`/projects/${task.projectId}`);
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
