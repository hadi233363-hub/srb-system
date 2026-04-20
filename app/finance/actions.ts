"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

async function requireAuth() {
  const session = await auth();
  if (!session?.user || !session.user.active) {
    throw new Error("Not authenticated");
  }
  return session.user;
}

async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

export async function createTransactionAction(formData: FormData) {
  // Any active user can record numbers — totals stay admin-only (gated in the UI).
  const user = await requireAuth();

  const kind = formData.get("kind") as string | null;
  const category = formData.get("category") as string | null;
  const amountRaw = formData.get("amountQar") as string | null;
  const amount = amountRaw ? Math.abs(parseFloat(amountRaw)) : 0;
  const description = (formData.get("description") as string | null)?.trim() || null;
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
  if (!amount || isNaN(amount) || amount <= 0) {
    return { ok: false, message: "المبلغ لازم يكون موجب" };
  }
  if (!["none", "monthly"].includes(recurrence)) {
    return { ok: false, message: "نوع التكرار غير صحيح" };
  }

  await prisma.transaction.create({
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

  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTransactionAction(id: string) {
  // Only admin can delete — prevents employees from clearing their own entries.
  await requireAdmin();
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}
