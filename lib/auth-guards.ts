// Shared server-side auth guards for server actions and API routes.
//
// Every guard checks BOTH that the user is signed in AND that their account
// is active (approved by admin). Pending-approval users can reach the UI via
// a Google sign-in but the layout shows them a PendingGate; without this
// check they could still craft raw server-action / fetch calls and mutate
// data before an admin approves them.
//
// Role hierarchy (highest → lowest):
//   admin (= president) > manager > department_head > employee

import { auth } from "@/auth";

type Role = "admin" | "manager" | "department_head" | "employee";

interface ActiveUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  active: true;
  department: string | null;
  nickname: string | null;
}

const RANK: Record<Role, number> = {
  admin: 4,
  manager: 3,
  department_head: 2,
  employee: 1,
};

function atLeast(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required];
}

export async function requireActiveUser(): Promise<ActiveUser> {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    throw new Error("Not authenticated");
  }
  if (!user.active) {
    throw new Error("Account pending approval");
  }
  return user as ActiveUser;
}

export async function requireRole(min: Role): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!atLeast(user.role, min)) {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

export async function requireDepartmentHead(): Promise<ActiveUser> {
  return requireRole("department_head");
}

export async function requireManagerOrAdmin(): Promise<ActiveUser> {
  return requireRole("manager");
}

// President-only (= admin in DB).
export async function requireAdmin(): Promise<ActiveUser> {
  return requireRole("admin");
}
