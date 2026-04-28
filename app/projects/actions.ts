"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requireDeptLeadOrAbove } from "@/lib/auth-guards";
import {
  safeAmount,
  safeInt,
  safeString,
  MAX_LONG_TEXT,
  MAX_NAME_LEN,
  MAX_TITLE_LEN,
} from "@/lib/input-limits";
import {
  findTemplate,
  templatePhaseNames,
  type Locale as TemplateLocale,
} from "@/lib/projects/phase-templates";
import { findOrCreateClientByName } from "@/app/clients/actions";

export async function createProjectAction(formData: FormData) {
  const user = await requireDeptLeadOrAbove();

  let title: string | null;
  let clientName: string | null;
  let description: string | null;
  let budgetQar: number;
  try {
    title = safeString(formData.get("title"), MAX_TITLE_LEN);
    clientName = safeString(formData.get("clientName"), MAX_NAME_LEN);
    description = safeString(formData.get("description"), MAX_LONG_TEXT);
    budgetQar = safeAmount(formData.get("budgetQar"));
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const type = (formData.get("type") as string | null) || null;
  const priority = (formData.get("priority") as string | null) || "normal";
  const deadlineAtRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt = deadlineAtRaw ? new Date(deadlineAtRaw) : null;
  const leadId = (formData.get("leadId") as string | null) || null;
  const billingType = (formData.get("billingType") as string | null) || "one_time";
  const billingCycleDays = safeInt(formData.get("billingCycleDays"), 30, 1, 365);

  if (!title) {
    return { ok: false, message: "اسم المشروع مطلوب" };
  }
  if (!["one_time", "monthly"].includes(billingType)) {
    return { ok: false, message: "نوع التسعير غير صحيح" };
  }

  // Auto-link or auto-create the client. If the form supplied an existing
  // clientId (combobox pick), prefer that — it skips name normalization and
  // avoids duplicating "Aspire" because the user typed "aspire ".
  let clientId: string | null = null;
  const explicitClientId = (formData.get("clientId") as string | null) || null;
  if (explicitClientId) {
    const exists = await prisma.client.findUnique({
      where: { id: explicitClientId },
      select: { id: true },
    });
    clientId = exists?.id ?? null;
  }
  if (!clientId && clientName) {
    const c = await findOrCreateClientByName(clientName);
    clientId = c?.id ?? null;
  }

  // For monthly projects, schedule the first invoice exactly one cycle after
  // the project is entered. Each subsequent cycle advances from the date the
  // invoice is actually recorded (see recordInvoiceAction).
  const now = new Date();
  const nextInvoiceDueAt =
    billingType === "monthly"
      ? new Date(now.getTime() + billingCycleDays * 24 * 60 * 60 * 1000)
      : null;

  const project = await prisma.project.create({
    data: {
      title,
      clientId,
      type,
      priority,
      budgetQar,
      deadlineAt,
      description,
      leadId: leadId || user.id,
      billingType,
      billingCycleDays,
      nextInvoiceDueAt,
    },
  });

  // If the user picked a starter phase template, seed the phases now.
  const templateKey = (formData.get("phaseTemplate") as string | null) || null;
  const localeRaw = (formData.get("locale") as string | null) || "ar";
  const tplLocale: TemplateLocale = localeRaw === "en" ? "en" : "ar";
  if (templateKey) {
    const tpl = findTemplate(templateKey);
    if (tpl) {
      const names = templatePhaseNames(tpl, tplLocale);
      await prisma.$transaction(
        names.map((name, idx) =>
          prisma.projectPhase.create({
            data: {
              projectId: project.id,
              name,
              order: idx + 1,
              status: idx === 0 ? "active" : "locked",
            },
          })
        )
      );
    }
  }

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

  await logAudit({
    action: "project.create",
    target: { type: "project", id: project.id, label: project.title },
    metadata: {
      budgetQar: project.budgetQar,
      billingType,
      priority,
      type,
      ...(billingType === "monthly"
        ? { billingCycleDays, firstInvoiceAt: nextInvoiceDueAt?.toISOString() }
        : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true, id: project.id };
}

export async function updateProjectAction(id: string, formData: FormData) {
  await requireDeptLeadOrAbove();

  let title: string | null;
  let description: string | null | undefined;
  let budgetQar: number | undefined;
  try {
    title = safeString(formData.get("title"), MAX_TITLE_LEN);
    const rawDescription = formData.get("description");
    description =
      rawDescription === null
        ? undefined
        : safeString(rawDescription, MAX_LONG_TEXT);
    const budgetRaw = formData.get("budgetQar");
    budgetQar = budgetRaw === null ? undefined : safeAmount(budgetRaw);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const status = (formData.get("status") as string | null) || undefined;
  const priority = (formData.get("priority") as string | null) || undefined;
  const deadlineAtRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt =
    deadlineAtRaw === null
      ? undefined
      : deadlineAtRaw === ""
      ? null
      : new Date(deadlineAtRaw);
  const progressRaw = formData.get("progressPct") as string | null;
  const progressPct = progressRaw ? parseInt(progressRaw) : undefined;
  const billingType = formData.get("billingType") as string | null;

  const before = await prisma.project.findUnique({ where: { id } });

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(budgetQar !== undefined ? { budgetQar } : {}),
      ...(deadlineAt !== undefined ? { deadlineAt } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(progressPct !== undefined && !isNaN(progressPct)
        ? { progressPct: Math.max(0, Math.min(100, progressPct)) }
        : {}),
      ...(billingType && ["one_time", "monthly"].includes(billingType)
        ? { billingType }
        : {}),
      ...(status === "completed" ? { completedAt: new Date() } : {}),
    },
  });

  if (before && status && status !== before.status) {
    await logAudit({
      action: "project.status_change",
      target: { type: "project", id, label: updated.title },
      metadata: { from: before.status, to: status },
    });
  } else {
    await logAudit({
      action: "project.update",
      target: { type: "project", id, label: updated.title },
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProjectAction(id: string) {
  await requireDeptLeadOrAbove();
  const before = await prisma.project.findUnique({ where: { id } });
  await prisma.project.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "project.delete",
      target: { type: "project", id, label: before.title },
      metadata: { budgetQar: before.budgetQar, status: before.status },
    });
  }
  revalidatePath("/projects");
  redirect("/projects");
}

export async function addMemberAction(projectId: string, userId: string, role?: string) {
  await requireDeptLeadOrAbove();
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: role ?? null },
    update: { role: role ?? null },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeMemberAction(projectId: string, userId: string) {
  await requireDeptLeadOrAbove();
  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Monthly-invoice lifecycle
// ---------------------------------------------------------------------------

/**
 * Record this cycle's invoice as collected. Creates an income transaction using
 * the project's monthly budget, advances nextInvoiceDueAt by one cycle, and
 * clears this cycle's reminder flags so the next cycle fires fresh alerts.
 *
 * Permission: dept_lead+ only — recording invoices creates a financial
 * transaction, which is gated to the same tier as createTransactionAction.
 * (Previously this was open to any active user — a hole.)
 *
 * Idempotent enough that a double-click in the UI won't double-record — the
 * button disables itself during the transition.
 */
export async function recordInvoiceAction(projectId: string) {
  const user = await requireDeptLeadOrAbove();
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, message: "المشروع غير موجود" };
  if (project.billingType !== "monthly") {
    return { ok: false, message: "المشروع مو شهري" };
  }
  if (!project.budgetQar || project.budgetQar <= 0) {
    return { ok: false, message: "حدد مبلغ الفاتورة في الميزانية الشهرية" };
  }

  const now = new Date();
  // Next cycle anchors from what was due, not from now — that way a 2-day-late
  // collection doesn't shift the whole calendar 2 days forward.
  const anchor = project.nextInvoiceDueAt ?? now;
  const newDueAt = new Date(
    anchor.getTime() + project.billingCycleDays * 24 * 60 * 60 * 1000
  );

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        kind: "income",
        category: "project_payment",
        amountQar: project.budgetQar,
        description: `فاتورة شهرية · ${project.title}`,
        projectId: project.id,
        occurredAt: now,
        recurrence: "none",
        createdById: user.id,
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        lastInvoicedAt: now,
        nextInvoiceDueAt: newDueAt,
        invoiceReminderBeforeSentAt: null,
        invoiceReminderDueSentAt: null,
        invoiceReminderOverdueSentAt: null,
      },
    }),
  ]);

  await logAudit({
    action: "tx.create",
    target: {
      type: "project",
      id: project.id,
      label: `فاتورة شهرية: ${project.title}`,
    },
    metadata: {
      amountQar: project.budgetQar,
      dueAt: project.nextInvoiceDueAt?.toISOString(),
      nextDueAt: newDueAt.toISOString(),
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Mark a per-cycle reminder as fired so polling tabs don't double-alert.
 * `which`: "before" = 3 days before · "due" = day of · "overdue" = follow-up.
 *
 * Permission: dept_lead+ — marking invoice reminders ties into the financial
 * cycle (project budget visible on the project page), and we don't want
 * employees silencing reminders for projects they have no business with.
 * Owners/managers/dept_leads can mark; everyone else is rejected.
 */
export async function markInvoiceReminderSentAction(
  projectId: string,
  which: "before" | "due" | "overdue"
) {
  await requireDeptLeadOrAbove();
  const field =
    which === "before"
      ? "invoiceReminderBeforeSentAt"
      : which === "due"
      ? "invoiceReminderDueSentAt"
      : "invoiceReminderOverdueSentAt";
  await prisma.project.updateMany({
    where: { id: projectId, [field]: null },
    data: { [field]: new Date() },
  });
  return { ok: true };
}
