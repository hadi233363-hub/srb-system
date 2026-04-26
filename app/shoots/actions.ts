"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import {
  requireActiveUser as requireAuth,
  requireDeptLeadOrAbove,
} from "@/lib/auth-guards";

function parseDateTime(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIdCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createShootAction(formData: FormData) {
  const user = await requireDeptLeadOrAbove();

  const title = (formData.get("title") as string | null)?.trim();
  const shootDate = parseDateTime(formData.get("shootDate") as string | null);
  const durationRaw = formData.get("durationHours") as string | null;
  const durationHours = durationRaw ? parseFloat(durationRaw) : 4;
  const location = (formData.get("location") as string | null)?.trim();
  const locationNotes = (formData.get("locationNotes") as string | null)?.trim() || null;
  const mapUrl = (formData.get("mapUrl") as string | null)?.trim() || null;
  const projectId = (formData.get("projectId") as string | null) || null;
  const clientContact = (formData.get("clientContact") as string | null)?.trim() || null;
  const shotList = (formData.get("shotList") as string | null)?.trim() || null;
  const referenceUrl = (formData.get("referenceUrl") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const crewIds = parseIdCsv(formData.get("crewIds") as string | null);
  const equipmentIds = parseIdCsv(formData.get("equipmentIds") as string | null);

  if (!title) return { ok: false, message: "عنوان التصوير مطلوب" };
  if (!shootDate) return { ok: false, message: "تاريخ ووقت التصوير مطلوبين" };
  if (!location) return { ok: false, message: "الموقع مطلوب" };

  const shoot = await prisma.photoShoot.create({
    data: {
      title,
      shootDate,
      durationHours: Number.isNaN(durationHours) ? 4 : durationHours,
      location,
      locationNotes,
      mapUrl,
      projectId,
      clientContact,
      shotList,
      referenceUrl,
      notes,
      createdById: user.id,
      crew: {
        create: crewIds.map((uid) => ({ userId: uid })),
      },
      equipment: {
        create: equipmentIds.map((eid) => ({ equipmentId: eid })),
      },
    },
  });

  await logAudit({
    action: "project.create",
    target: { type: "project", id: shoot.id, label: `تصوير: ${title}` },
    metadata: { shootDate: shootDate.toISOString(), crewCount: crewIds.length },
  });

  revalidatePath("/shoots");
  return { ok: true, id: shoot.id };
}

export async function updateShootAction(id: string, formData: FormData) {
  await requireDeptLeadOrAbove();

  const data: Record<string, unknown> = {};
  const stringFields = [
    "title",
    "location",
    "locationNotes",
    "mapUrl",
    "clientContact",
    "shotList",
    "referenceUrl",
    "notes",
    "status",
  ];
  for (const f of stringFields) {
    const v = formData.get(f);
    if (v === null) continue;
    const s = (v as string).trim();
    data[f] = s === "" ? null : s;
  }

  const projectId = formData.get("projectId") as string | null;
  if (projectId !== null) data.projectId = projectId || null;

  const shootDateRaw = formData.get("shootDate") as string | null;
  if (shootDateRaw !== null) {
    const d = parseDateTime(shootDateRaw);
    if (d) data.shootDate = d;
  }
  const durationRaw = formData.get("durationHours") as string | null;
  if (durationRaw !== null && durationRaw !== "") {
    const n = parseFloat(durationRaw);
    if (!isNaN(n)) data.durationHours = n;
  }

  // If status moves to non-scheduled, clear future reminder firings.
  if (data.status && data.status !== "scheduled") {
    data.reminderDayBeforeSentAt = null;
    data.reminderHourBeforeSentAt = null;
  }

  await prisma.photoShoot.update({ where: { id }, data });

  // Handle crew swap if provided
  const crewIdsRaw = formData.get("crewIds");
  if (crewIdsRaw !== null) {
    const crewIds = parseIdCsv(crewIdsRaw as string);
    await prisma.photoShootCrew.deleteMany({ where: { shootId: id } });
    if (crewIds.length > 0) {
      await prisma.photoShootCrew.createMany({
        data: crewIds.map((uid) => ({ shootId: id, userId: uid })),
      });
    }
  }
  // Same for equipment
  const equipmentIdsRaw = formData.get("equipmentIds");
  if (equipmentIdsRaw !== null) {
    const equipmentIds = parseIdCsv(equipmentIdsRaw as string);
    await prisma.photoShootEquipment.deleteMany({ where: { shootId: id } });
    if (equipmentIds.length > 0) {
      await prisma.photoShootEquipment.createMany({
        data: equipmentIds.map((eid) => ({ shootId: id, equipmentId: eid })),
      });
    }
  }

  revalidatePath("/shoots");
  return { ok: true };
}

export async function deleteShootAction(id: string) {
  await requireDeptLeadOrAbove();
  const before = await prisma.photoShoot.findUnique({ where: { id } });
  await prisma.photoShoot.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "project.delete",
      target: { type: "project", id, label: `تصوير: ${before.title}` },
    });
  }
  revalidatePath("/shoots");
  return { ok: true };
}

// Helper: only crew members (or manager+) can silence a shoot reminder.
// Otherwise anyone with a shoot id could suppress alerts for the photographer.
async function assertCrewOrManager(shootId: string, userId: string, userRole: string) {
  const { isManagerOrAbove } = await import("@/lib/auth/roles");
  if (isManagerOrAbove(userRole)) return true;
  const crew = await prisma.photoShootCrew.findUnique({
    where: { shootId_userId: { shootId, userId } },
    select: { shootId: true },
  });
  return !!crew;
}

/** Idempotent — marks the 24h-before reminder as sent. Crew or manager+ only. */
export async function markShootDayReminderSentAction(id: string) {
  const user = await requireAuth();
  if (!(await assertCrewOrManager(id, user.id, user.role))) return { ok: false };
  await prisma.photoShoot.updateMany({
    where: { id, reminderDayBeforeSentAt: null },
    data: { reminderDayBeforeSentAt: new Date() },
  });
  return { ok: true };
}

/** Idempotent — marks the 1h-before reminder as sent. Crew or manager+ only. */
export async function markShootHourReminderSentAction(id: string) {
  const user = await requireAuth();
  if (!(await assertCrewOrManager(id, user.id, user.role))) return { ok: false };
  await prisma.photoShoot.updateMany({
    where: { id, reminderHourBeforeSentAt: null },
    data: { reminderHourBeforeSentAt: new Date() },
  });
  return { ok: true };
}
