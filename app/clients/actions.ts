"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requirePermission } from "@/lib/auth-guards";
import {
  safeString,
  MAX_NAME_LEN,
  MAX_SHORT_TEXT,
  MAX_LONG_TEXT,
} from "@/lib/input-limits";

interface ClientResult {
  ok: boolean;
  message?: string;
  id?: string;
}

// ---------------------------------------------------------------------------
// Find-or-create — the canonical client lookup used by every project entry
// point (createProjectAction, the new-project combobox, future imports).
// Lookup is case-insensitive on a trimmed name so "Aspire" / "aspire " /
// "ASPIRE" all collapse to the same row. Phone number is recorded the first
// time we see one; we do NOT overwrite an existing one — the dedicated client
// edit form is the place to mutate contact details.
//
// Returns the client id. Caller is responsible for any audit logging tied to
// the higher-level operation (e.g. project.create).
// ---------------------------------------------------------------------------
export async function findOrCreateClientByName(
  rawName: string,
  opts: { phone?: string | null } = {}
): Promise<{ id: string; created: boolean } | null> {
  const name = safeString(rawName, MAX_NAME_LEN);
  if (!name) return null;

  // Case-insensitive match on the existing index. SQLite's default LIKE is
  // case-insensitive for ASCII; for Arabic we fall back to a normalized compare
  // in JS over a small candidate set. At 1k rows this stays cheap.
  const candidates = await prisma.client.findMany({
    where: { name: { contains: name } },
    select: { id: true, name: true },
    take: 50,
  });
  const match = candidates.find(
    (c) => c.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (match) return { id: match.id, created: false };

  const phone = opts.phone ? safeString(opts.phone, MAX_SHORT_TEXT) : null;
  const created = await prisma.client.create({
    data: { name, phone: phone || null },
  });
  return { id: created.id, created: true };
}

// ---------------------------------------------------------------------------
// Search — used by the /api/clients/search endpoint that powers the new-project
// combobox. Matches name OR phone, case-insensitive, ordered by most-recent
// activity (newest project first, then createdAt).
// ---------------------------------------------------------------------------
export async function searchClients(
  query: string,
  limit = 10
): Promise<Array<{ id: string; name: string; phone: string | null; projectsCount: number }>> {
  const q = query.trim();
  if (!q) {
    const rows = await prisma.client.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        _count: { select: { projects: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      projectsCount: r._count.projects,
    }));
  }
  const rows = await prisma.client.findMany({
    where: {
      OR: [{ name: { contains: q } }, { phone: { contains: q } }],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      _count: { select: { projects: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    projectsCount: r._count.projects,
  }));
}

// ---------------------------------------------------------------------------
// Manual create — bound to the "New client" button on /clients. Auto-create
// on project entry uses findOrCreateClientByName instead.
// ---------------------------------------------------------------------------
export async function createClientAction(formData: FormData): Promise<ClientResult> {
  await requirePermission("clients", "create");

  let name: string | null;
  let phone: string | null;
  let email: string | null;
  let notes: string | null;
  try {
    name = safeString(formData.get("name"), MAX_NAME_LEN);
    phone = safeString(formData.get("phone"), MAX_SHORT_TEXT);
    email = safeString(formData.get("email"), MAX_SHORT_TEXT);
    notes = safeString(formData.get("notes"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  if (!name) return { ok: false, message: "اسم العميل مطلوب" };

  // Re-use existing record on duplicate name — same rule as auto-link.
  const existing = await prisma.client.findFirst({
    where: { name: { contains: name } },
    select: { id: true, name: true },
  });
  const dupe = existing && existing.name.trim().toLowerCase() === name.toLowerCase();
  if (dupe) {
    return { ok: false, message: "فيه عميل بنفس الاسم — افتح ملفه عوض إنشاء واحد جديد" };
  }

  const client = await prisma.client.create({
    data: { name, phone, email, notes },
  });

  await logAudit({
    action: "client.create",
    target: { type: "client", id: client.id, label: client.name },
    metadata: { phone: client.phone ?? null, email: client.email ?? null },
  });

  revalidatePath("/clients");
  return { ok: true, id: client.id };
}

// ---------------------------------------------------------------------------
// Update — used by the inline edit on the client detail page.
// ---------------------------------------------------------------------------
export async function updateClientAction(
  id: string,
  formData: FormData
): Promise<ClientResult> {
  await requirePermission("clients", "edit");

  let name: string | null;
  let phone: string | null;
  let email: string | null;
  let notes: string | null;
  try {
    name = safeString(formData.get("name"), MAX_NAME_LEN);
    phone = safeString(formData.get("phone"), MAX_SHORT_TEXT);
    email = safeString(formData.get("email"), MAX_SHORT_TEXT);
    notes = safeString(formData.get("notes"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  if (!name) return { ok: false, message: "اسم العميل مطلوب" };

  const before = await prisma.client.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "العميل غير موجود" };

  const updated = await prisma.client.update({
    where: { id },
    data: { name, phone, email, notes },
  });

  await logAudit({
    action: "client.update",
    target: { type: "client", id: updated.id, label: updated.name },
    metadata: {
      before: { name: before.name, phone: before.phone, email: before.email },
      after: { name: updated.name, phone: updated.phone, email: updated.email },
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, id: updated.id };
}

// ---------------------------------------------------------------------------
// Delete — manager+ only via the permission gate above. Projects keep their
// rows (clientId becomes null thanks to onDelete: SetNull on the relation).
// ---------------------------------------------------------------------------
export async function deleteClientAction(id: string): Promise<ClientResult> {
  await requirePermission("clients", "delete");
  const before = await prisma.client.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "العميل غير موجود" };
  await prisma.client.delete({ where: { id } });
  await logAudit({
    action: "client.delete",
    target: { type: "client", id, label: before.name },
  });
  revalidatePath("/clients");
  redirect("/clients");
}
