"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requireDeptLeadOrAbove } from "@/lib/auth-guards";

export async function createEquipmentAction(formData: FormData) {
  await requireDeptLeadOrAbove();

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { ok: false, message: "الاسم مطلوب" };

  const category = (formData.get("category") as string | null) ?? "other";
  const brand = (formData.get("brand") as string | null)?.trim() || null;
  const model = (formData.get("model") as string | null)?.trim() || null;
  const serialNumber = (formData.get("serialNumber") as string | null)?.trim() || null;
  const condition = (formData.get("condition") as string | null) ?? "good";
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const purchasedAtRaw = formData.get("purchasedAt") as string | null;
  const purchasedAt = purchasedAtRaw ? new Date(purchasedAtRaw) : null;
  const priceRaw = formData.get("purchasePriceQar") as string | null;
  const purchasePriceQar = priceRaw ? parseFloat(priceRaw) : null;

  const eq = await prisma.equipment.create({
    data: {
      name,
      category,
      brand,
      model,
      serialNumber,
      condition,
      notes,
      purchasedAt,
      purchasePriceQar: priceRaw && !isNaN(purchasePriceQar ?? NaN) ? purchasePriceQar : null,
    },
  });

  await logAudit({
    action: "project.create",
    target: { type: "project", id: eq.id, label: `Equipment: ${name}` },
    metadata: { category, brand, model },
  });

  revalidatePath("/equipment");
  return { ok: true, id: eq.id };
}

export async function updateEquipmentAction(id: string, formData: FormData) {
  await requireDeptLeadOrAbove();

  const data: Record<string, unknown> = {};
  const stringFields = [
    "name",
    "category",
    "brand",
    "model",
    "serialNumber",
    "condition",
    "notes",
  ];
  for (const f of stringFields) {
    const v = formData.get(f);
    if (v === null) continue;
    const s = (v as string).trim();
    data[f] = s === "" ? null : s;
  }
  if (!data.name) delete data.name;

  const purchasedAtRaw = formData.get("purchasedAt") as string | null;
  if (purchasedAtRaw !== null) {
    data.purchasedAt = purchasedAtRaw === "" ? null : new Date(purchasedAtRaw);
  }
  const priceRaw = formData.get("purchasePriceQar") as string | null;
  if (priceRaw !== null) {
    const n = parseFloat(priceRaw);
    data.purchasePriceQar = priceRaw === "" || isNaN(n) ? null : n;
  }

  await prisma.equipment.update({ where: { id }, data });
  revalidatePath("/equipment");
  return { ok: true };
}

export async function deleteEquipmentAction(id: string) {
  await requireDeptLeadOrAbove();
  const before = await prisma.equipment.findUnique({ where: { id } });
  await prisma.equipment.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "project.delete",
      target: { type: "project", id, label: `Equipment: ${before.name}` },
    });
  }
  revalidatePath("/equipment");
  return { ok: true };
}

export async function checkOutEquipmentAction(
  id: string,
  holderId: string,
  expectedReturnAtRaw: string | null
) {
  await requireDeptLeadOrAbove();
  await prisma.equipment.update({
    where: { id },
    data: {
      currentHolderId: holderId,
      assignedAt: new Date(),
      expectedReturnAt: expectedReturnAtRaw
        ? new Date(expectedReturnAtRaw)
        : null,
    },
  });
  revalidatePath("/equipment");
  return { ok: true };
}

export async function checkInEquipmentAction(id: string) {
  await requireDeptLeadOrAbove();
  await prisma.equipment.update({
    where: { id },
    data: {
      currentHolderId: null,
      assignedAt: null,
      expectedReturnAt: null,
    },
  });
  revalidatePath("/equipment");
  return { ok: true };
}
