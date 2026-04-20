"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createUser,
  deleteUser,
  updateUser,
  findUserByEmail,
} from "@/lib/db/users";
import { prisma } from "@/lib/db/prisma";

type Role = "admin" | "manager" | "employee";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  if (session.user.role !== "admin") throw new Error("Admin only");
  return session;
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
  revalidatePath("/admin/users");
  return { ok: true, message: `تم إضافة ${name}` };
}

export async function toggleUserActiveAction(id: string, active: boolean) {
  await requireAdmin();
  await updateUser(id, { active });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function changeUserRoleAction(id: string, role: Role) {
  await requireAdmin();
  await updateUser(id, { role });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) {
    return { ok: false, message: "ما تقدر تحذف حسابك" };
  }
  await deleteUser(id);
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
  await prisma.user.update({
    where: { id },
    data: {
      active: true,
      approvedAt: new Date(),
      role,
      department: department?.trim() || null,
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Reject a pending sign-up: deletes the row entirely. They can sign in again later
// which would re-queue them as pending.
export async function rejectUserAction(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) {
    return { ok: false, message: "ما تقدر تحذف حسابك" };
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
  return { ok: true };
}
