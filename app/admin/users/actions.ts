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
import {
  requireManagerOrAbove,
  requireOwner,
} from "@/lib/auth-guards";
import {
  canAssignRole,
  isOwner,
  isValidRole,
  type Role,
} from "@/lib/auth/roles";

function userLabel(u: { name: string; email: string }) {
  return `${u.name} · ${u.email}`;
}

// All approval / role-assignment actions are open to MANAGER+. The owner
// (الرئيس) can grant any role; managers can grant only department_lead and
// employee. We always validate the requested role against the actor's
// `assignableRoles` so a manager can't bypass the UI to promote someone to
// admin or another manager.
async function requireRoleAssigner(targetRole: Role) {
  const actor = await requireManagerOrAbove();
  if (!canAssignRole(actor.role, targetRole)) {
    throw new Error("ما تقدر تعطي هذي الصلاحية — أعلى من مستواك");
  }
  return actor;
}

export async function addUserAction(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const name = (formData.get("name") as string | null)?.trim();
  const roleRaw = formData.get("role");
  const department =
    (formData.get("department") as string | null)?.trim() || null;

  if (!email || !name || !roleRaw) {
    return { ok: false, message: "كل الخانات مطلوبة" };
  }
  if (!isValidRole(roleRaw)) {
    return { ok: false, message: "الدور غير صحيح" };
  }
  const role = roleRaw;

  let actor;
  try {
    actor = await requireRoleAssigner(role);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "غير مسموح" };
  }

  if (await findUserByEmail(email)) {
    return { ok: false, message: "الإيميل موجود مسبقاً" };
  }

  // Manager-or-above-created users are approved immediately.
  const user = await createUser({ email, name, role, department });
  await prisma.user.update({
    where: { id: user.id },
    data: { approvedAt: new Date() },
  });
  await logAudit({
    action: "user.create",
    target: { type: "user", id: user.id, label: userLabel(user) },
    metadata: { role, department, byRole: actor.role },
  });
  revalidatePath("/admin/users");
  return { ok: true, message: `تم إضافة ${name}` };
}

export async function toggleUserActiveAction(id: string, active: boolean) {
  const actor = await requireManagerOrAbove();
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "الحساب غير موجود" };

  // Guard: a manager cannot deactivate / reactivate someone above their tier
  // (e.g. another manager or the owner). Only the owner can touch managers
  // and other owners.
  if (!isOwner(actor.role) && (before.role === "admin" || before.role === "manager")) {
    return { ok: false, message: "ما تقدر تعدّل على حساب بدرجتك أو فوق" };
  }

  await updateUser(id, { active });
  await logAudit({
    action: active ? "user.activate" : "user.deactivate",
    target: { type: "user", id, label: userLabel(before) },
    metadata: { byRole: actor.role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function changeUserRoleAction(id: string, role: Role) {
  if (!isValidRole(role)) {
    return { ok: false, message: "الدور غير صحيح" };
  }
  let actor;
  try {
    actor = await requireRoleAssigner(role);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "غير مسموح" };
  }

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "الحساب غير موجود" };

  // Don't let a manager DEMOTE someone above their tier either — only the
  // owner can change manager / admin roles.
  if (
    !isOwner(actor.role) &&
    (before.role === "admin" || before.role === "manager")
  ) {
    return { ok: false, message: "ما تقدر تغيّر دور حساب بدرجتك أو فوق" };
  }

  await updateUser(id, { role });
  await logAudit({
    action: "user.role_change",
    target: { type: "user", id, label: userLabel(before) },
    metadata: { from: before.role, to: role, byRole: actor.role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(id: string) {
  const actor = await requireManagerOrAbove();
  if (actor.id === id) {
    return { ok: false, message: "ما تقدر تحذف حسابك" };
  }
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "الحساب غير موجود" };

  // Same protection as toggle / role change — only owner can remove a manager
  // or another owner.
  if (!isOwner(actor.role) && (before.role === "admin" || before.role === "manager")) {
    return { ok: false, message: "ما تقدر تحذف حساب بدرجتك أو فوق" };
  }

  await deleteUser(id);
  await logAudit({
    action: "user.delete",
    target: { type: "user", id, label: userLabel(before) },
    metadata: {
      role: before.role,
      department: before.department,
      byRole: actor.role,
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Approve a pending sign-up: activate the account and assign role/department.
export async function approveUserAction(
  id: string,
  role: Role,
  department: string | null
) {
  if (!isValidRole(role)) {
    return { ok: false, message: "الدور غير صحيح" };
  }
  let actor;
  try {
    actor = await requireRoleAssigner(role);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "غير مسموح" };
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

  // Drop a notification in the user's inbox so they know the moment they next
  // open the app — separate from any email Auth.js may send.
  await prisma.notification
    .create({
      data: {
        recipientId: id,
        kind: "user.approved",
        severity: "success",
        title: "تم تفعيل حسابك",
        body: `صلاحياتك: ${role}${department ? ` · ${department}` : ""}`,
        linkUrl: "/",
      },
    })
    .catch(() => {});

  await logAudit({
    action: "user.approve",
    target: { type: "user", id, label: userLabel(updated) },
    metadata: { role, department: department?.trim() || null, byRole: actor.role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Toggle a badge on a user. Add it if missing, remove it if present.
 * Returns { ok, attached } where `attached` reflects the new state.
 */
export async function toggleUserBadgeAction(userId: string, badgeId: string) {
  const actor = await requireManagerOrAbove();

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
      assignedById: actor.id,
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
// which would re-queue them as pending. Owner-only — managers can approve but
// cannot hard-delete a record.
export async function rejectUserAction(id: string) {
  const actor = await requireOwner();
  if (actor.id === id) {
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
