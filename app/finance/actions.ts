"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import {
  requireFinanceEntry,
  requireFinanceEdit,
  requireFinanceDelete,
} from "@/lib/auth-guards";
import { safeAmount, safeString, MAX_LONG_TEXT } from "@/lib/input-limits";

export async function createTransactionAction(formData: FormData) {
  // dept_lead+ by role, OR explicit accounting:create / finance:create override.
  const user = await requireFinanceEntry();

  const kind = formData.get("kind") as string | null;
  const category = formData.get("category") as string | null;
  let amount: number;
  let description: string | null;
  try {
    amount = safeAmount(formData.get("amountQar"));
    description = safeString(formData.get("description"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const projectId = (formData.get("projectId") as string | null) || null;
  const occurredAtRaw = formData.get("occurredAt") as string | null;
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
  const recurrence = (formData.get("recurrence") as string | null) || "none";
  const endsAtRaw = formData.get("recurrenceEndsAt") as string | null;
  const recurrenceEndsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (!kind || !["income", "expense"].includes(kind)) {
    return { ok: false, message: "اختر: دخل أو مصروف" };
  }
  if (!category) {
    return { ok: false, message: "الفئة مطلوبة" };
  }
  if (!amount || amount <= 0) {
    return { ok: false, message: "المبلغ لازم يكون موجب" };
  }
  if (!["none", "monthly"].includes(recurrence)) {
    return { ok: false, message: "نوع التكرار غير صحيح" };
  }

  const tx = await prisma.transaction.create({
    data: {
      kind,
      category,
      amountQar: amount,
      description,
      projectId,
      occurredAt,
      recurrence,
      recurrenceEndsAt: recurrence === "monthly" ? recurrenceEndsAt : null,
      createdById: user.id,
    },
  });

  await logAudit({
    action: "tx.create",
    target: {
      type: "transaction",
      id: tx.id,
      label: `${kind === "income" ? "+" : "−"}${amount.toLocaleString("en")} · ${category}`,
    },
    metadata: { kind, category, amountQar: amount, recurrence, projectId, description },
  });

  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}

export async function updateTransactionAction(id: string, formData: FormData) {
  const editor = await requireFinanceEdit();

  const kind = formData.get("kind") as string | null;
  const category = formData.get("category") as string | null;
  let amount: number;
  let description: string | null;
  try {
    amount = safeAmount(formData.get("amountQar"));
    description = safeString(formData.get("description"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const projectId = (formData.get("projectId") as string | null) || null;
  const occurredAtRaw = formData.get("occurredAt") as string | null;
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
  const recurrence = (formData.get("recurrence") as string | null) || "none";
  const endsAtRaw = formData.get("recurrenceEndsAt") as string | null;
  const recurrenceEndsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (!kind || !["income", "expense"].includes(kind)) {
    return { ok: false, message: "اختر: دخل أو مصروف" };
  }
  if (!category) return { ok: false, message: "الفئة مطلوبة" };
  if (!amount || amount <= 0) return { ok: false, message: "المبلغ لازم يكون موجب" };
  if (!["none", "monthly"].includes(recurrence)) {
    return { ok: false, message: "نوع التكرار غير صحيح" };
  }

  const before = await prisma.transaction.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "المعاملة غير موجودة" };

  // Accountants can only edit transactions they created themselves
  if (!editor.isOwnerRole && before.createdById !== editor.id) {
    return { ok: false, message: "لا تملك صلاحية تعديل هذه المعاملة" };
  }

  await prisma.transaction.update({
    where: { id },
    data: {
      kind,
      category,
      amountQar: amount,
      description,
      projectId,
      occurredAt,
      recurrence,
      recurrenceEndsAt: recurrence === "monthly" ? recurrenceEndsAt : null,
    },
  });

  await logAudit({
    action: "tx.update",
    target: {
      type: "transaction",
      id,
      label: `${kind === "income" ? "+" : "−"}${amount.toLocaleString("en")} · ${category}`,
    },
    metadata: {
      before: { kind: before.kind, category: before.category, amountQar: before.amountQar },
      after: { kind, category, amountQar: amount, recurrence, projectId, description },
    },
  });

  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTransactionAction(id: string) {
  // Owner can delete any transaction. Accountants can only delete their own.
  const deleter = await requireFinanceDelete();
  const before = await prisma.transaction.findUnique({
    where: { id },
    include: { project: { select: { title: true } } },
  });
  if (before && !deleter.isOwnerRole && before.createdById !== deleter.id) {
    return { ok: false, message: "لا تملك صلاحية حذف هذه المعاملة" };
  }
  await prisma.transaction.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "tx.delete",
      target: {
        type: "transaction",
        id,
        label: `${before.kind === "income" ? "+" : "−"}${before.amountQar.toLocaleString("en")} · ${before.category}`,
      },
      metadata: {
        kind: before.kind,
        category: before.category,
        amountQar: before.amountQar,
        projectTitle: before.project?.title ?? null,
        description: before.description,
      },
    });
  }
  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}
