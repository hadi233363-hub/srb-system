"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requirePermission } from "@/lib/auth-guards";
import { safeString, MAX_SHORT_TEXT, MAX_LONG_TEXT } from "@/lib/input-limits";

export async function createPartnerShareAction(formData: FormData) {
  await requirePermission("partnerShare", "create");

  const projectId = formData.get("projectId") as string | null;
  const partnerName = safeString(formData.get("partnerName"), MAX_SHORT_TEXT);
  const sharePercentRaw = Number(formData.get("sharePercent"));
  const notes = safeString(formData.get("notes"), MAX_LONG_TEXT);

  if (!projectId) return { ok: false, message: "اختر المشروع" };
  if (!partnerName) return { ok: false, message: "اسم الشريك مطلوب" };
  if (isNaN(sharePercentRaw) || sharePercentRaw <= 0 || sharePercentRaw > 100) {
    return { ok: false, message: "النسبة يجب أن تكون بين 0.1 و 100" };
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, title: true } });
  if (!project) return { ok: false, message: "المشروع غير موجود" };

  const share = await prisma.partnerShare.create({
    data: { projectId, partnerName, sharePercent: sharePercentRaw, notes },
  });

  await logAudit({
    action: "partnerShare.create",
    target: { type: "partnerShare", id: share.id, label: `${partnerName} · ${sharePercentRaw}% · ${project.title}` },
    metadata: { projectId, partnerName, sharePercent: sharePercentRaw },
  });

  revalidatePath("/partner-share");
  return { ok: true };
}

export async function updatePartnerShareAction(id: string, formData: FormData) {
  await requirePermission("partnerShare", "edit");

  const partnerName = safeString(formData.get("partnerName"), MAX_SHORT_TEXT);
  const sharePercentRaw = Number(formData.get("sharePercent"));
  const notes = safeString(formData.get("notes"), MAX_LONG_TEXT);

  if (!partnerName) return { ok: false, message: "اسم الشريك مطلوب" };
  if (isNaN(sharePercentRaw) || sharePercentRaw <= 0 || sharePercentRaw > 100) {
    return { ok: false, message: "النسبة يجب أن تكون بين 0.1 و 100" };
  }

  const existing = await prisma.partnerShare.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: "السجل غير موجود" };

  await prisma.partnerShare.update({
    where: { id },
    data: { partnerName, sharePercent: sharePercentRaw, notes },
  });

  await logAudit({
    action: "partnerShare.update",
    target: { type: "partnerShare", id, label: `${partnerName} · ${sharePercentRaw}%` },
    metadata: {
      before: { partnerName: existing.partnerName, sharePercent: existing.sharePercent },
      after: { partnerName, sharePercent: sharePercentRaw },
    },
  });

  revalidatePath("/partner-share");
  return { ok: true };
}

export async function deletePartnerShareAction(id: string) {
  await requirePermission("partnerShare", "delete");

  const existing = await prisma.partnerShare.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: "السجل غير موجود" };

  await prisma.partnerShare.delete({ where: { id } });

  await logAudit({
    action: "partnerShare.delete",
    target: { type: "partnerShare", id, label: `${existing.partnerName} · ${existing.sharePercent}%` },
    metadata: { partnerName: existing.partnerName, sharePercent: existing.sharePercent, projectId: existing.projectId },
  });

  revalidatePath("/partner-share");
  return { ok: true };
}
