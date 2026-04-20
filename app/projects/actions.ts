"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  return session.user;
}

async function requireManagerOrAdmin() {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "manager") {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

export async function createProjectAction(formData: FormData) {
  const user = await requireManagerOrAdmin();

  const title = (formData.get("title") as string | null)?.trim();
  const clientName = (formData.get("clientName") as string | null)?.trim() || null;
  const type = (formData.get("type") as string | null) || null;
  const priority = (formData.get("priority") as string | null) || "normal";
  const budgetQarRaw = formData.get("budgetQar") as string | null;
  const budgetQar = budgetQarRaw ? parseFloat(budgetQarRaw) : 0;
  const deadlineAtRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt = deadlineAtRaw ? new Date(deadlineAtRaw) : null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const leadId = (formData.get("leadId") as string | null) || null;
  const billingType = (formData.get("billingType") as string | null) || "one_time";

  if (!title) {
    return { ok: false, message: "اسم المشروع مطلوب" };
  }
  if (!["one_time", "monthly"].includes(billingType)) {
    return { ok: false, message: "نوع التسعير غير صحيح" };
  }

  let clientId: string | null = null;
  if (clientName) {
    const existing = await prisma.client.findFirst({ where: { name: clientName } });
    if (existing) {
      clientId = existing.id;
    } else {
      const newClient = await prisma.client.create({ data: { name: clientName } });
      clientId = newClient.id;
    }
  }

  const project = await prisma.project.create({
    data: {
      title,
      clientId,
      type,
      priority,
      budgetQar: isNaN(budgetQar) ? 0 : budgetQar,
      deadlineAt,
      description,
      leadId: leadId || user.id,
      billingType,
    },
  });

  // Automatically add the lead as a project member.
  if (project.leadId) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: project.id, userId: project.leadId },
      },
      create: {
        projectId: project.id,
        userId: project.leadId,
        role: "lead",
      },
      update: {},
    });
  }

  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true, id: project.id };
}

export async function updateProjectAction(id: string, formData: FormData) {
  await requireManagerOrAdmin();

  const title = (formData.get("title") as string | null)?.trim();
  const status = (formData.get("status") as string | null) || undefined;
  const priority = (formData.get("priority") as string | null) || undefined;
  const budgetQarRaw = formData.get("budgetQar") as string | null;
  const budgetQar = budgetQarRaw ? parseFloat(budgetQarRaw) : undefined;
  const deadlineAtRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt =
    deadlineAtRaw === null
      ? undefined
      : deadlineAtRaw === ""
      ? null
      : new Date(deadlineAtRaw);
  const description = formData.get("description") as string | null;
  const progressRaw = formData.get("progressPct") as string | null;
  const progressPct = progressRaw ? parseInt(progressRaw) : undefined;
  const billingType = formData.get("billingType") as string | null;

  await prisma.project.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(budgetQar !== undefined && !isNaN(budgetQar) ? { budgetQar } : {}),
      ...(deadlineAt !== undefined ? { deadlineAt } : {}),
      ...(description !== null ? { description: description?.trim() || null } : {}),
      ...(progressPct !== undefined && !isNaN(progressPct)
        ? { progressPct: Math.max(0, Math.min(100, progressPct)) }
        : {}),
      ...(billingType && ["one_time", "monthly"].includes(billingType)
        ? { billingType }
        : {}),
      ...(status === "completed" ? { completedAt: new Date() } : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProjectAction(id: string) {
  await requireManagerOrAdmin();
  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  redirect("/projects");
}

export async function addMemberAction(projectId: string, userId: string, role?: string) {
  await requireManagerOrAdmin();
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: role ?? null },
    update: { role: role ?? null },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeMemberAction(projectId: string, userId: string) {
  await requireManagerOrAdmin();
  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
