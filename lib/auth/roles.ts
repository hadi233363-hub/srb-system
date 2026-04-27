// Role hierarchy for the SRB internal system. The single source of truth for
// "who can do what". Every server action, API route, sidebar item and UI gate
// goes through these helpers — no raw `role === "admin"` checks anywhere else.
//
// Hierarchy (highest → lowest):
//   admin           → الرئيس (Owner)
//                     · full access to everything, including finance totals
//                     · only one with permission-control-panel access
//
//   manager         → المدير
//                     · runs ops (projects, meetings, shoots, equipment)
//                     · approves users + assigns roles up to team lead
//                     · cannot see finance totals (owner-only)
//
//   department_lead → رئيس الفريق (Team lead)
//                     · manages their team's projects + tasks + freelancers
//                     · cannot approve users, cannot change roles
//                     · cannot see finance totals
//
//   employee        → الموظف
//                     · works on their own tasks, sees the team list
//                     · cannot create projects, transactions, meetings, shoots
//
// Historical note: an extra "head of all departments" tier (`head`) lived
// briefly between `manager` and `department_lead`. It was merged back into
// `department_lead` for simplicity — the team-lead label now covers the
// cross-team coordination role. `instrumentation.ts` runs a one-shot
// migration on boot to convert any leftover `role='head'` rows to `manager`.

export type Role =
  | "admin"
  | "manager"
  | "department_lead"
  | "employee";

export const ALL_ROLES: readonly Role[] = [
  "admin",
  "manager",
  "department_lead",
  "employee",
] as const;

// Numeric rank — higher number = more privileged. Used for `meets()` checks.
const RANK: Record<Role, number> = {
  admin: 4,
  manager: 3,
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

export function isDeptLeadOrAbove(role: string | undefined | null): boolean {
  return meets(role, "department_lead");
}

/**
 * Backwards-compat alias for the deprecated `head` tier. We treat any caller
 * that asks "is this a head?" as "is this manager or above?" so old call
 * sites keep working while we migrate them. Once every caller is gone this
 * can be removed.
 *
 * @deprecated Use `isManagerOrAbove` instead.
 */
export function isHeadOrAbove(role: string | undefined | null): boolean {
  return isManagerOrAbove(role);
}

/** Validate that a string from a form / API is a known role. */
export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}

/**
 * Roles that `assigner` is allowed to grant. Owners can grant any role.
 * Managers can grant team_lead and below — they can promote into team
 * leadership but not into another manager or owner seat.
 */
export function assignableRoles(assignerRole: string | undefined | null): Role[] {
  if (isOwner(assignerRole))
    return ["admin", "manager", "department_lead", "employee"];
  if (isManagerOrAbove(assignerRole))
    return ["department_lead", "employee"];
  return [];
}

/** True if `assigner` is allowed to grant `target` to a user. */
export function canAssignRole(
  assignerRole: string | undefined | null,
  target: Role
): boolean {
  return assignableRoles(assignerRole).includes(target);
}
