// Role hierarchy for the SRB internal system. The single source of truth for
// "who can do what". Every server action, API route, sidebar item and UI gate
// goes through these helpers — no raw `role === "admin"` checks anywhere else.
//
// Hierarchy (highest → lowest):
//   admin           → الرئيس (President / Owner)
//                     · sees full finance dashboard (totals, P&L, profit, risk)
//                     · approves any role including new owners
//                     · root access to /admin/* (audit, backup, theme,
//                       PERMISSION CONTROL PANEL)
//                     · only one normally exists, but multiple are supported
//
//   manager         → المدير (Admin)
//                     · approves pending users + assigns roles up to dept_lead
//                     · runs all ops (projects, meetings, shoots, equipment)
//                     · creates transactions (income / expense / salary) but
//                       CANNOT see the aggregated finance dashboard — that's
//                       president-only
//                     · cannot promote anyone to admin/owner
//
//   head            → رئيس جميع الأقسام (Head of All Departments)
//                     · cross-department visibility: every project, every task,
//                       every submission, across all departments
//                     · can edit / reassign / cancel any task, review any
//                       submission, but is NOT a manager — cannot approve
//                       users, cannot promote/demote anyone
//                     · CANNOT see finance totals (owner-only) and cannot
//                       reach system settings (audit / backup / theme /
//                       permissions)
//
//   department_lead → رئيس قسم (Department Head)
//                     · manages a single department's projects + transactions
//                     · adds meetings & shoots in their dept
//                     · cannot approve users, cannot change roles
//                     · cannot see finance totals
//
//   employee        → موظف
//                     · works on their own tasks
//                     · sees team list, projects they're a member of
//                     · cannot create projects, transactions, meetings, shoots

export type Role =
  | "admin"
  | "manager"
  | "head"
  | "department_lead"
  | "employee";

export const ALL_ROLES: readonly Role[] = [
  "admin",
  "manager",
  "head",
  "department_lead",
  "employee",
] as const;

// Numeric rank — higher number = more privileged. Used for `meets()` checks.
// `head` sits between `manager` and `department_lead`: it has cross-department
// scope (so it must outrank dept_lead) but no people-management or finance
// power (so it must rank below manager).
const RANK: Record<Role, number> = {
  admin: 5,
  manager: 4,
  head: 3,
  department_lead: 2,
  employee: 1,
};

/** True if the user's role is at OR ABOVE the given minimum. */
export function meets(role: string | undefined | null, minimum: Role): boolean {
  if (!role) return false;
  const r = (RANK as Record<string, number | undefined>)[role];
  if (r === undefined) return false;
  return r >= RANK[minimum];
}

export function isOwner(role: string | undefined | null): boolean {
  return meets(role, "admin");
}

export function isManagerOrAbove(role: string | undefined | null): boolean {
  return meets(role, "manager");
}

/**
 * Head-of-all-departments tier or above. Used for cross-department visibility
 * gates (see all projects/tasks regardless of which department owns them).
 * Owner and manager naturally inherit this scope.
 */
export function isHeadOrAbove(role: string | undefined | null): boolean {
  return meets(role, "head");
}

export function isDeptLeadOrAbove(role: string | undefined | null): boolean {
  return meets(role, "department_lead");
}

/** Validate that a string from a form / API is a known role. */
export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}

/**
 * Roles that `assigner` is allowed to grant. Owners can grant any role.
 * Managers can grant up to `head` (cross-dept visibility role) — they can
 * elevate someone into operations leadership but not into another manager
 * or owner seat. Anyone else can grant nothing.
 */
export function assignableRoles(assignerRole: string | undefined | null): Role[] {
  if (isOwner(assignerRole))
    return ["admin", "manager", "head", "department_lead", "employee"];
  if (isManagerOrAbove(assignerRole))
    return ["head", "department_lead", "employee"];
  return [];
}

/** True if `assigner` is allowed to grant `target` to a user. */
export function canAssignRole(
  assignerRole: string | undefined | null,
  target: Role
): boolean {
  return assignableRoles(assignerRole).includes(target);
}
