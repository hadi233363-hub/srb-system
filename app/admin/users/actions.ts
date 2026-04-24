"use server";

import { revalidatePath } from "next/cache";
import {
  createUser,
  deleteUser,
  updateUser,
  findUserByEmail,
} from "@/lib/db/users";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requireAdmin as requireAdminUser } from "@/lib/auth-guards";

type Role = "admin" | "manager" | "employee";

async function requireAdmin() {
  const user = await requireAdminUser();
  return { user };
}

function userLabel(u: { name: string; email: string }) {
  return `${u.name} · ${u.email}`;
}

export async function addUserAction(formData: FormData) {
  await requireAdmin();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const name = (formData.get("name") as string | null)?.trim();
  const role = formData.get("role") as Role | null;
  const department =
    (formData.get("department") as string | null)?.trim() || null;

  if (!email || !name || !role) {
    return { ok: false, message: "كل الخانات مطلوبة" };
  }
  if (!["admin", "manager", "employee"].includes(role)) {
    return { ok: false, message: "الدور غير صحيح" };
  }
  if (await findUserByEmail(email)) {
    return { ok: false, message: "الإيميل موجود مسبقاً" };
  }

  // Admin-created users are approved immediately.
  const user = await createUser({ email, name, role, department });
  await prisma.user.update({
    where: { id: user.id },
    data: { approvedAt: new Date() },
  });
  await logAudit({
    action: "user.create",
    target: { type: "user", id: user.id, label: userLabel(user) },
    metadata: { role, department },
  });
  revalidatePath("/admin/users");
  return { ok: true, message: `تم إضافة ${name}` };
}

export async function toggleUserActiveAction(id: string, active: boolean) {
  await requireAdmin();
  const before = await prisma.user.findUnique({ where: { id } });
  await updateUser(id, { active });
  if (before) {
    await logAudit({
      action: active ? "user.activate" : "user.deactivate",
      target: { type: "user", id, label: userLabel(before) },
    });
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function changeUserRoleAction(id: string, role: Role) {
  await requireAdmin();
  const before = await prisma.user.findUnique({ where: { id } });
  await updateUser(id, { role });
  if (before) {
    await logAudit({
      action: "user.role_change",
      target: { type: "user", id, label: userLabel(before) },
      metadata: { from: before.role, to: role },
    });
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) {
    return { ok: false, message: "ما تقدر تحذف حسابك" };
  }
  const before = await prisma.user.findUnique({ where: { id } });
  await deleteUser(id);
  if (before) {
    await logAudit({
      action: "user.delete",
      target: { type: "user", id, label: userLabel(before) },
      metadata: { role: before.role, department: before.department },
    });
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

// Approve a pending sign-up: activate the account and assign role/department.
export async function approveUserAction(
  id: string,
  role: Role,
  department: string | null
) {
  await requireAdmin();
  if (!["admin", "manager", "employee"].includes(role)) {
    return { ok: false, message: "الدور غير صحيح" };
  }
  const updated = await prisma.user.update({
    where: { id },
    data: {
      active: true,
      approvedAt: new Date(),
      role,
      department: department?.trim() || null,
    },
  });
  await logAudit({
    action: "user.approve",
    target: { type: "user", id, label: userLabel(updated) },
    metadata: { role, department: department?.trim() || null },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Toggle a badge on a user. Add it if missing, remove it if present.
 * Returns { ok, attached } where `attached` reflects the new state.
 */
export async function toggleUserBadgeAction(userId: string, badgeId: string) {
  const session = await requireAdmin();

  const [user, badge, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.badge.findUnique({ where: { id: badgeId } }),
    prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    }),
  ]);

  if (!user) return { ok: false as const, message: "الموظف ما لقيته" };
  if (!badge) return { ok: false as const, message: "الشارة ما لقيتها" };

  if (existing) {
    await prisma.userBadge.delete({
      where: { userId_badgeId: { userId, badgeId } },
    });
    await logAudit({
      action: "user.badge_remove",
      target: { type: "user", id: userId, label: userLabel(user) },
      metadata: { badge: badge.slug, badgeLabel: badge.labelAr },
    });
    revalidatePath("/admin/users");
    revalidatePath(`/team/${userId}`);
    return { ok: true as const, attached: false };
  }

  await prisma.userBadge.create({
    data: {
      userId,
      badgeId,
      assignedById: session.user.id,
    },
  });
  await logAudit({
    action: "user.badge_add",
    target: { type: "user", id: userId, label: userLabel(user) },
    metadata: { badge: badge.slug, badgeLabel: badge.labelAr },
  });
  revalidatePath("/admin/users");
  revalidatePath(`/team/${userId}`);
  return { ok: true as const, attached: true };
}

// Reject a pending sign-up: deletes the row entirely. They can sign in again later
// which would re-queue them as pending.
export async function rejectUserAction(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) {
    return { ok: false, message: "ما تقدر تحذف حسابك" };
  }
  const before = await prisma.user.findUnique({ where: { id } });
  await prisma.user.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "user.reject",
      target: { type: "user", id, label: userLabel(before) },
    });
  }
  revalidatePath("/admin/users");
  return { ok: true };
}
