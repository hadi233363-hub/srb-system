// Shared server-side auth guards for server actions and API routes.
//
// Every guard checks BOTH that the user is signed in AND that their account
// is active (approved by admin). Pending-approval users can reach the UI via
// a Google sign-in but the layout shows them a PendingGate; without this
// check they could still craft raw server-action / fetch calls and mutate
// data before an admin approves them.

import { auth } from "@/auth";

type Role = "admin" | "manager" | "employee";

interface ActiveUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  active: true;
  department: string | null;
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

export async function requireManagerOrAdmin(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (user.role !== "admin" && user.role !== "manager") {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

export async function requireAdmin(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (user.role !== "admin") {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}
