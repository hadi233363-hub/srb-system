"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { safeAmount, safeString, MAX_LONG_TEXT } from "@/lib/input-limits";

const VALID_ROLES = new Set([
  "photographer",
  "designer",
  "videographer",
  "editor",
  "sound",
  "writer",
  "developer",
  "other",
]);

const VALID_STATUSES = new Set(["active", "completed", "cancelled"]);

function pickRole(value: unknown): string {
  if (typeof value !== "string") return "other";
  const trimmed = value.trim().toLowerCase();
  return VALID_ROLES.has(trimmed) ? trimmed : "other";
}

export async function createFreelancerAction(
  projectId: string,
  formData: FormData
) {
  const actor = await requirePermission("freelancers", "create");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { ok: false as const, message: "اسم الفري لانسر مطلوب" };

  const role = pickRole(formData.get("role"));
  const phone = safeString(formData.get("phone"), 40) ?? null;
  const email = safeString(formData.get("email"), 200) ?? null;
  const paymentTerms = safeString(formData.get("paymentTerms"), MAX_LONG_TEXT) ?? null;
  const notes = safeString(formData.get("notes"), MAX_LONG_TEXT) ?? null;

  let agreedAmountQar = 0;
  try {
    const raw = formData.get("agreedAmountQar");
    if (raw && String(raw).trim() !== "") {
      agreedAmountQar = safeAmount(raw);
    }
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "مبلغ غير صحيح",
    };
  }

  const created = await prisma.projectFreelancer.create({
    data: {
      projectId,
      name: name.slice(0, 200),
      role,
      phone,
      email,
      agreedAmountQar,
      paymentTerms,
      notes,
      createdById: actor.id,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: {
      surface: "freelancers",
      op: "create",
      id: created.id,
      role,
      agreedAmountQar,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateFreelancerAction(
  freelancerId: string,
  formData: FormData
) {
  await requirePermission("freelancers", "edit");

  const before = await prisma.projectFreelancer.findUnique({
    where: { id: freelancerId },
    select: { id: true, projectId: true, name: true },
  });
  if (!before) return { ok: false as const, message: "الفري لانسر غير موجود" };

  const name = (formData.get("name") as string | null)?.trim() || before.name;
  const role = pickRole(formData.get("role"));
  const phone = safeString(formData.get("phone"), 40) ?? null;
  const email = safeString(formData.get("email"), 200) ?? null;
  const paymentTerms = safeString(formData.get("paymentTerms"), MAX_LONG_TEXT) ?? null;
  const notes = safeString(formData.get("notes"), MAX_LONG_TEXT) ?? null;
  const statusRaw = (formData.get("status") as string | null) ?? "active";
  const status = VALID_STATUSES.has(statusRaw) ? statusRaw : "active";

  let agreedAmountQar = 0;
  try {
    const raw = formData.get("agreedAmountQar");
    if (raw && String(raw).trim() !== "") {
      agreedAmountQar = safeAmount(raw);
    }
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "مبلغ غير صحيح",
    };
  }

  await prisma.projectFreelancer.update({
    where: { id: freelancerId },
    data: {
      name: name.slice(0, 200),
      role,
      phone,
      email,
      agreedAmountQar,
      paymentTerms,
      notes,
      status,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: before.projectId, label: before.name },
    metadata: { surface: "freelancers", op: "update", id: freelancerId, status },
  });

  revalidatePath(`/projects/${before.projectId}`);
  return { ok: true as const };
}

export async function deleteFreelancerAction(freelancerId: string) {
  await requirePermission("freelancers", "delete");

  const before = await prisma.projectFreelancer.findUnique({
    where: { id: freelancerId },
    include: { _count: { select: { payments: true } } },
  });
  if (!before) return { ok: false as const, message: "الفري لانسر غير موجود" };

  // If there are linked payments, prefer cancellation over deletion so the
  // financial trail stays intact. Owner can still hard-delete via Prisma if
  // truly needed; the UI nudges toward "cancel" in that case.
  if (before._count.payments > 0) {
    await prisma.projectFreelancer.update({
      where: { id: freelancerId },
      data: { status: "cancelled" },
    });
    await logAudit({
      action: "project.update",
      target: {
        type: "project",
        id: before.projectId,
        label: before.name,
      },
      metadata: {
        surface: "freelancers",
        op: "cancel_with_payments",
        id: freelancerId,
        paymentsCount: before._count.payments,
      },
    });
    revalidatePath(`/projects/${before.projectId}`);
    return {
      ok: true as const,
      cancelled: true,
      message: "تم تحويله لـ ملغي بدل الحذف لوجود دفعات مسجّلة",
    };
  }

  await prisma.projectFreelancer.delete({ where: { id: freelancerId } });
  await logAudit({
    action: "project.update",
    target: {
      type: "project",
      id: before.projectId,
      label: before.name,
    },
    metadata: { surface: "freelancers", op: "delete", id: freelancerId },
  });
  revalidatePath(`/projects/${before.projectId}`);
  return { ok: true as const };
}

/**
 * Record a payment to a freelancer. Creates a Transaction with category =
 * "freelance" linked to both the project and the freelancer, so the project
 * profit widget AND the freelancer's "paid so far" total update in one shot.
 *
 * Permission split:
 *   - `freelancers:approve` is required (this is the "money moves" gate).
 *   - dept_lead has create/edit but NOT approve, so they can hire and adjust
 *     terms but can't actually disburse — only manager+ can.
 */
export async function recordFreelancerPaymentAction(
  freelancerId: string,
  formData: FormData
) {
  const actor = await requirePermission("freelancers", "approve");

  const freelancer = await prisma.projectFreelancer.findUnique({
    where: { id: freelancerId },
    select: { id: true, name: true, role: true, projectId: true },
  });
  if (!freelancer) return { ok: false as const, message: "الفري لانسر غير موجود" };

  let amount: number;
  try {
    amount = safeAmount(formData.get("amountQar"));
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "مبلغ غير صحيح",
    };
  }
  if (amount <= 0) {
    return { ok: false as const, message: "المبلغ لازم يكون موجب" };
  }

  const occurredAtRaw = formData.get("occurredAt") as string | null;
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return { ok: false as const, message: "تاريخ غير صحيح" };
  }

  const userDescription = safeString(formData.get("description"), MAX_LONG_TEXT);
  const description =
    userDescription ??
    `دفعة لـ ${freelancer.name} (${freelancer.role}) — مشروع`;

  const tx = await prisma.transaction.create({
    data: {
      kind: "expense",
      category: "freelance",
      amountQar: amount,
      description,
      projectId: freelancer.projectId,
      freelancerId: freelancer.id,
      occurredAt,
      recurrence: "none",
      createdById: actor.id,
    },
  });

  await logAudit({
    action: "tx.create",
    target: {
      type: "transaction",
      id: tx.id,
      label: `−${amount.toLocaleString("en")} · freelance · ${freelancer.name}`,
    },
    metadata: {
      kind: "expense",
      category: "freelance",
      amountQar: amount,
      projectId: freelancer.projectId,
      freelancerId: freelancer.id,
      surface: "freelancers",
    },
  });

  revalidatePath(`/projects/${freelancer.projectId}`);
  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true as const };
}
