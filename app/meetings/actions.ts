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

export async function createMeetingAction(formData: FormData) {
  const user = await requireDeptLeadOrAbove();

  const clientName = (formData.get("clientName") as string | null)?.trim();
  const companyName = (formData.get("companyName") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim() || null;
  const instagramHandle = (formData.get("instagramHandle") as string | null)?.trim() || null;
  const tiktokHandle = (formData.get("tiktokHandle") as string | null)?.trim() || null;
  const websiteUrl = (formData.get("websiteUrl") as string | null)?.trim() || null;
  const socialNotes = (formData.get("socialNotes") as string | null)?.trim() || null;
  const meetingAt = parseDateTime(formData.get("meetingAt") as string | null);
  const durationRaw = formData.get("durationMin") as string | null;
  const durationMin = durationRaw ? parseInt(durationRaw) : 60;
  const location = (formData.get("location") as string | null)?.trim() || null;
  const meetingLink = (formData.get("meetingLink") as string | null)?.trim() || null;
  const agendaNotes = (formData.get("agendaNotes") as string | null)?.trim() || null;
  const rawOwnerId = (formData.get("ownerId") as string | null) || user.id;
  // Validate ownerId — must reference an active user. Falls back to the
  // creator if the supplied id is bogus or inactive.
  let ownerId = user.id;
  if (rawOwnerId && rawOwnerId !== user.id) {
    const owner = await prisma.user.findFirst({
      where: { id: rawOwnerId, active: true },
      select: { id: true },
    });
    ownerId = owner?.id ?? user.id;
  }

  if (!clientName) return { ok: false, message: "اسم العميل مطلوب" };
  if (!meetingAt) return { ok: false, message: "تاريخ ووقت الموعد مطلوبين" };

  const meeting = await prisma.clientMeeting.create({
    data: {
      clientName,
      companyName,
      phone,
      email,
      instagramHandle,
      tiktokHandle,
      websiteUrl,
      socialNotes,
      meetingAt,
      durationMin: Number.isNaN(durationMin) ? 60 : durationMin,
      location,
      meetingLink,
      agendaNotes,
      ownerId,
      createdById: user.id,
    },
  });

  await logAudit({
    action: "meeting.create",
    target: {
      type: "meeting",
      id: meeting.id,
      label: `اجتماع: ${clientName}`,
    },
    metadata: {
      clientName,
      meetingAt: meetingAt.toISOString(),
      ownerId,
    },
  });

  revalidatePath("/meetings");
  revalidatePath("/");
  return { ok: true, id: meeting.id };
}

export async function updateMeetingAction(id: string, formData: FormData) {
  await requireDeptLeadOrAbove();

  const data: Record<string, unknown> = {};
  const fields = [
    "clientName",
    "companyName",
    "phone",
    "email",
    "instagramHandle",
    "tiktokHandle",
    "websiteUrl",
    "socialNotes",
    "location",
    "meetingLink",
    "agendaNotes",
    "outcomeNotes",
    "status",
    "ownerId",
  ] as const;

  for (const f of fields) {
    const v = formData.get(f);
    if (v === null) continue;
    const str = (v as string).trim();
    data[f] = str === "" ? null : str;
  }

  const meetingAtRaw = formData.get("meetingAt") as string | null;
  if (meetingAtRaw !== null) {
    const d = parseDateTime(meetingAtRaw);
    if (d) data.meetingAt = d;
  }
  const durationRaw = formData.get("durationMin") as string | null;
  if (durationRaw !== null && durationRaw !== "") {
    const n = parseInt(durationRaw);
    if (!Number.isNaN(n)) data.durationMin = n;
  }

  // If status changed to non-scheduled, clear reminderSentAt so it doesn't
  // accidentally fire again if un-cancelled. Leave it otherwise.
  if (data.status && data.status !== "scheduled") {
    data.reminderSentAt = null;
  }

  await prisma.clientMeeting.update({ where: { id }, data });

  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteMeetingAction(id: string) {
  await requireDeptLeadOrAbove();
  const before = await prisma.clientMeeting.findUnique({ where: { id } });
  await prisma.clientMeeting.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "project.delete",
      target: { type: "project", id, label: `اجتماع: ${before.clientName}` },
    });
  }
  revalidatePath("/meetings");
  return { ok: true };
}

/** Mark the 1-hour-before reminder as delivered. Idempotent.
 *
 * IDOR guard: only the meeting owner OR a manager+ can silence the reminder.
 * Without this, any active user could call markReminderSent for any meeting
 * id and suppress the alert for the actual owner.
 */
export async function markReminderSentAction(id: string) {
  const user = await requireAuth();
  const meeting = await prisma.clientMeeting.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!meeting) return { ok: false };

  const { isManagerOrAbove } = await import("@/lib/auth/roles");
  if (meeting.ownerId !== user.id && !isManagerOrAbove(user.role)) {
    return { ok: false };
  }

  await prisma.clientMeeting.updateMany({
    where: { id, reminderSentAt: null },
    data: { reminderSentAt: new Date() },
  });
  return { ok: true };
}
