// Shared server-side auth guards for server actions and API routes.
//
// Every guard checks BOTH that the user is signed in AND that their account
// is active (approved by admin). Pending-approval users can reach the UI via
// a Google sign-in but the layout shows them a PendingGate; without this
// check they could still craft raw server-action / fetch calls and mutate
// data before an admin approves them.
//
// Role hierarchy is defined in lib/auth/roles.ts. Use the helpers there for
// any role check — never compare to literal strings outside this file.

import { auth } from "@/auth";
import {
  isDeptLeadOrAbove,
  isManagerOrAbove,
  isOwner,
  type Role,
} from "@/lib/auth/roles";
import {
  hasPermission as checkPermission,
  type Action,
  type Module,
} from "@/lib/auth/permissions";
import { getUserOverrides } from "@/lib/db/permissions";

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

/** Highest tier — الرئيس / President. Sees finance totals, full /admin/*. */
export async function requireOwner(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!isOwner(user.role)) {
    throw new Error("صلاحيات غير كافية: هذي العملية للرئيس فقط");
  }
  return user;
}

/** Manager or above — runs ops, approves users, assigns roles up to dept_lead. */
export async function requireManagerOrAbove(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!isManagerOrAbove(user.role)) {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

/** Team lead or above — adds projects / transactions / meetings / shoots. */
export async function requireDeptLeadOrAbove(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!isDeptLeadOrAbove(user.role)) {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

/**
 * Permission-based guard. Resolves the user's effective permission for
 * (module, action) — Owner short-circuits to true, otherwise we consult
 * any overrides on top of the role default. Throws if denied.
 *
 * Use this at the entry of any sensitive server action where the gate is
 * fine-grained (e.g. "approve a submission"). Role-tier guards above remain
 * appropriate for coarse gates ("only managers can approve users").
 */
export async function requirePermission(
  module: Module,
  action: Action
): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (user.role === "admin") return user;
  const overrides = await getUserOverrides(user.id);
  if (!checkPermission(user, module, action, overrides)) {
    throw new Error("صلاحيات غير كافية");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Backwards-compat aliases — keep existing call sites working while the
// codebase migrates to the new vocabulary. New code should prefer the
// explicit helpers above.
// ---------------------------------------------------------------------------

/** @deprecated Use requireOwner — admin is the legacy name for the owner tier. */
export const requireAdmin = requireOwner;

/** @deprecated Use requireManagerOrAbove — old name kept for existing callers. */
export const requireManagerOrAdmin = requireManagerOrAbove;
