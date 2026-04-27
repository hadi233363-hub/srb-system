"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { saveUploadedFile, sanitizeLinkUrl } from "@/lib/uploads";

const KINDS = new Set(["moodboard", "reference", "brand", "deliverable", "other"]);

export async function addAssetAction(projectId: string, formData: FormData) {
  const actor = await requirePermission("assets", "create");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  const kindRaw = (formData.get("kind") as string | null) ?? "moodboard";
  const kind = KINDS.has(kindRaw) ? kindRaw : "moodboard";
  const title = (formData.get("title") as string | null)?.trim() || null;
  const caption = (formData.get("caption") as string | null)?.trim() || null;

  let fileUrl: string | null = null;
  let fileName: string | null = null;
  let fileType: string | null = null;

  const fileEntry = formData.get("file");
  if (fileEntry && typeof fileEntry !== "string") {
    const file = fileEntry as File;
    if (file.size > 0) {
      try {
        const saved = await saveUploadedFile(file, "assets");
        fileUrl = saved.url;
        fileName = saved.fileName;
        fileType = saved.fileType;
      } catch (err) {
        return {
          ok: false as const,
          message: err instanceof Error ? err.message : "فشل رفع الملف",
        };
      }
    }
  }

  let externalUrl: string | null = null;
  try {
    externalUrl = sanitizeLinkUrl(formData.get("externalUrl"));
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "رابط غير صحيح",
    };
  }

  if (!fileUrl && !externalUrl) {
    return {
      ok: false as const,
      message: "أرفق ملف أو رابط",
    };
  }

  await prisma.projectAsset.create({
    data: {
      projectId,
      kind,
      title,
      caption,
      fileUrl,
      fileName,
      fileType,
      externalUrl,
      addedById: actor.id,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: { surface: "assets", op: "add", kind },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function deleteAssetAction(assetId: string) {
  await requirePermission("assets", "delete");

  const asset = await prisma.projectAsset.findUnique({
    where: { id: assetId },
    select: { id: true, projectId: true, kind: true },
  });
  if (!asset) return { ok: false as const, message: "العنصر غير موجود" };

  await prisma.projectAsset.delete({ where: { id: assetId } });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: asset.projectId },
    metadata: { surface: "assets", op: "delete", kind: asset.kind },
  });

  revalidatePath(`/projects/${asset.projectId}`);
  return { ok: true as const };
}
