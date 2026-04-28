"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireActiveUser, requirePermission } from "@/lib/auth-guards";
import { isOwner } from "@/lib/auth/roles";
import { safeString, MAX_LONG_TEXT } from "@/lib/input-limits";

interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

// ---------------------------------------------------------------------------
// Add a touchpoint entry to the client's communication log. Anyone with
// `clients:view` can post — that includes employees on the project — so the
// timeline reflects the whole team's outreach, not just leadership's. The
// author is captured from the active session for accountability.
// ---------------------------------------------------------------------------
export async function createClientNoteAction(
  clientId: string,
  formData: FormData
): Promise<ActionResult> {
  const user = await requirePermission("clients", "view");

  let content: string | null;
  try {
    content = safeString(formData.get("content"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  if (!content) return { ok: false, message: "الملاحظة فارغة" };

  // Make sure the client exists; otherwise we'd insert a dangling row.
  const exists = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!exists) return { ok: false, message: "العميل غير موجود" };

  const note = await prisma.clientNote.create({
    data: {
      clientId,
      content,
      createdById: user.id,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: note.id };
}

// ---------------------------------------------------------------------------
// Delete a single touchpoint. Allowed for the original author OR the Owner
// (admin). The detail page hides the delete button for everyone else, but
// the action enforces the rule again so a hand-crafted request can't bypass.
// ---------------------------------------------------------------------------
export async function deleteClientNoteAction(
  noteId: string
): Promise<ActionResult> {
  const user = await requireActiveUser();

  const note = await prisma.clientNote.findUnique({
    where: { id: noteId },
    select: { id: true, clientId: true, createdById: true },
  });
  if (!note) return { ok: false, message: "الملاحظة غير موجودة" };

  const isAuthor = note.createdById === user.id;
  if (!isAuthor && !isOwner(user.role)) {
    return { ok: false, message: "صلاحيات غير كافية" };
  }

  await prisma.clientNote.delete({ where: { id: noteId } });
  revalidatePath(`/clients/${note.clientId}`);
  return { ok: true, id: noteId };
}
