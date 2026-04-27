"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { sanitizeLinkUrl } from "@/lib/uploads";
import { prisma } from "@/lib/db/prisma";

const DELIVERY_KINDS = new Set(["post", "reel", "video", "photo", "other"]);
const DELIVERY_STATUSES = new Set([
  "drafting",
  "sent",
  "viewed",
  "changes_requested",
  "approved",
]);

export async function createDeliveryAction(
  projectId: string,
  formData: FormData
) {
  const actor = await requirePermission("clientDelivery", "create");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) {
    return { ok: false as const, message: "العنوان مطلوب" };
  }
  const kindRaw = (formData.get("kind") as string | null) ?? "post";
  const kind = DELIVERY_KINDS.has(kindRaw) ? kindRaw : "post";

  let deliveryUrl: string | null = null;
  let previewUrl: string | null = null;
  try {
    deliveryUrl = sanitizeLinkUrl(formData.get("deliveryUrl"));
    previewUrl = sanitizeLinkUrl(formData.get("previewUrl"));
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "رابط غير صحيح",
    };
  }

  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const created = await prisma.clientDelivery.create({
    data: {
      projectId,
      title: title.slice(0, 200),
      kind,
      deliveryUrl,
      previewUrl,
      notes,
      createdById: actor.id,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: { surface: "delivery", op: "create", id: created.id },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function setDeliveryStatusAction(args: {
  deliveryId: string;
  status: string;
  feedback?: string | null;
}) {
  if (!DELIVERY_STATUSES.has(args.status)) {
    return { ok: false as const, message: "حالة غير صحيحة" };
  }
  const status = args.status as
    | "drafting"
    | "sent"
    | "viewed"
    | "changes_requested"
    | "approved";

  // Approving is its own permission; everything else just needs edit.
  if (status === "approved") {
    await requirePermission("clientDelivery", "approve");
  } else {
    await requirePermission("clientDelivery", "edit");
  }

  const delivery = await prisma.clientDelivery.findUnique({
    where: { id: args.deliveryId },
    select: { id: true, projectId: true, title: true, status: true },
  });
  if (!delivery) return { ok: false as const, message: "العنصر غير موجود" };

  const now = new Date();
  const data: Record<string, unknown> = { status };
  // Stamp the relevant timestamp on entry. Earlier timestamps are preserved
  // so we keep a record of when it FIRST hit each milestone.
  if (status === "sent") data.sentAt = now;
  if (status === "viewed") data.viewedAt = now;
  if (status === "changes_requested") {
    data.changesRequestedAt = now;
    if (args.feedback !== undefined) {
      data.clientFeedback = args.feedback?.trim() || null;
    }
  }
  if (status === "approved") data.approvedAt = now;

  await prisma.clientDelivery.update({
    where: { id: args.deliveryId },
    data,
  });

  await logAudit({
    action: "project.update",
    target: {
      type: "project",
      id: delivery.projectId,
      label: delivery.title,
    },
    metadata: {
      surface: "delivery",
      op: "status",
      id: delivery.id,
      from: delivery.status,
      to: status,
    },
  });

  revalidatePath(`/projects/${delivery.projectId}`);
  return { ok: true as const };
}

export async function deleteDeliveryAction(deliveryId: string) {
  await requirePermission("clientDelivery", "delete");

  const delivery = await prisma.clientDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, projectId: true, title: true },
  });
  if (!delivery) return { ok: false as const, message: "العنصر غير موجود" };

  await prisma.clientDelivery.delete({ where: { id: deliveryId } });

  await logAudit({
    action: "project.update",
    target: {
      type: "project",
      id: delivery.projectId,
      label: delivery.title,
    },
    metadata: { surface: "delivery", op: "delete", id: delivery.id },
  });

  revalidatePath(`/projects/${delivery.projectId}`);
  return { ok: true as const };
}
