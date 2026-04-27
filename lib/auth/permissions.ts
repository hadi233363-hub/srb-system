// Permission matrix + override resolver — the single source of truth for
// "can THIS user do THIS thing on THIS module?". Roles come with a default
// matrix; the Owner can override any individual cell per-user via the
// PermissionOverride table. This file defines the matrix; the override
// resolver lives at the bottom.
//
// Design notes:
//
// - We never compare to literal role strings outside lib/auth/. Always go
//   through `hasPermission()` so an Owner override is honoured.
//
// - Modules and Actions are TS string unions, not Prisma enums. This means
//   adding a new module is a code-only change (no DB migration). The
//   PermissionOverride table stores both as plain strings.
//
// - A missing override row = "use role default". `allowed=true` GRANTS a
//   permission the role would not normally have; `allowed=false` REVOKES a
//   permission it would. This makes the matrix purely additive at the schema
//   level.
//
// - Owner (admin) ALWAYS has every permission. We short-circuit before
//   consulting overrides so the Owner can never accidentally lock themselves
//   out by toggling something on their own row.

import type { Role } from "./roles";

// All modules the system can guard. Adding one here makes it appear in the
// Owner's Permission Control Panel automatically.
export const MODULES = [
  "projects",
  "tasks",
  "submissions",
  "brief",
  "package",
  "assets",
  "clientDelivery",
  "shoots",
  "meetings",
  "equipment",
  "team",
  "finance",
  "reports",
  "admin",
  "backup",
  "audit",
] as const;
export type Module = (typeof MODULES)[number];

// All possible verbs against a module. Not every (module, action) pair is
// meaningful — e.g. you can't "approve" the audit log — but the matrix below
// only enables the meaningful ones.
export const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "assign",
  "manage",
] as const;
export type Action = (typeof ACTIONS)[number];

export interface ModuleSpec {
  key: Module;
  labelAr: string;
  labelEn: string;
  // Subset of ACTIONS that make sense for this module. Used by the UI to
  // render only meaningful columns.
  actions: readonly Action[];
}

// Module display metadata + meaningful actions per module. The Permission
// Control Panel iterates this list to build its grid.
export const MODULE_SPECS: readonly ModuleSpec[] = [
  {
    key: "projects",
    labelAr: "المشاريع",
    labelEn: "Projects",
    actions: ["view", "create", "edit", "delete", "assign", "manage"],
  },
  {
    key: "tasks",
    labelAr: "المهام",
    labelEn: "Tasks",
    actions: ["view", "create", "edit", "delete", "assign", "approve"],
  },
  {
    key: "submissions",
    labelAr: "تسليمات الشغل",
    labelEn: "Submissions",
    actions: ["view", "approve", "edit"],
  },
  {
    key: "brief",
    labelAr: "البريف الإبداعي",
    labelEn: "Creative brief",
    actions: ["view", "create", "edit", "approve"],
  },
  {
    key: "package",
    labelAr: "الباقة",
    labelEn: "Package tracker",
    actions: ["view", "edit"],
  },
  {
    key: "assets",
    labelAr: "الأصول والموود بورد",
    labelEn: "Assets / moodboard",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "clientDelivery",
    labelAr: "تسليم العميل",
    labelEn: "Client delivery",
    actions: ["view", "create", "edit", "delete", "approve"],
  },
  {
    key: "shoots",
    labelAr: "جدول التصوير",
    labelEn: "Shoot schedule",
    actions: ["view", "create", "edit", "delete", "manage"],
  },
  {
    key: "meetings",
    labelAr: "المواعيد",
    labelEn: "Meetings",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "equipment",
    labelAr: "المعدات",
    labelEn: "Equipment",
    actions: ["view", "create", "edit", "delete", "manage"],
  },
  {
    key: "team",
    labelAr: "الفريق",
    labelEn: "Team",
    actions: ["view", "edit", "manage"],
  },
  {
    key: "finance",
    labelAr: "المالية",
    labelEn: "Finance",
    actions: ["view", "create", "edit", "delete", "manage"],
  },
  {
    key: "reports",
    labelAr: "التقارير",
    labelEn: "Reports",
    actions: ["view"],
  },
  {
    key: "admin",
    labelAr: "إدارة الحسابات",
    labelEn: "Admin",
    actions: ["view", "manage", "approve"],
  },
  {
    key: "backup",
    labelAr: "النسخ الاحتياطي",
    labelEn: "Backup",
    actions: ["view", "manage"],
  },
  {
    key: "audit",
    labelAr: "سجل الإجراءات",
    labelEn: "Audit log",
    actions: ["view"],
  },
];

export const ACTION_LABEL_AR: Record<Action, string> = {
  view: "عرض",
  create: "إنشاء",
  edit: "تعديل",
  delete: "حذف",
  approve: "اعتماد",
  assign: "إسناد",
  manage: "إدارة",
};

export const ACTION_LABEL_EN: Record<Action, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  assign: "Assign",
  manage: "Manage",
};

type Permission = `${Module}:${Action}`;
type PermissionSet = ReadonlySet<Permission>;

const p = (m: Module, a: Action): Permission => `${m}:${a}`;

// Owner (admin) — short-circuited in hasPermission() to ALWAYS allow. This
// set is kept for completeness and used by the matrix renderer when showing
// "what would the role default be?".
const OWNER_PERMS: PermissionSet = new Set(
  MODULE_SPECS.flatMap((m) => m.actions.map((a) => p(m.key, a)))
);

// Manager (المدير) — admin minus finance dashboard totals. Can record
// transactions but not view aggregated finance reports.
const MANAGER_PERMS: PermissionSet = new Set<Permission>([
  // Projects
  p("projects", "view"),
  p("projects", "create"),
  p("projects", "edit"),
  p("projects", "delete"),
  p("projects", "assign"),
  p("projects", "manage"),
  // Tasks
  p("tasks", "view"),
  p("tasks", "create"),
  p("tasks", "edit"),
  p("tasks", "delete"),
  p("tasks", "assign"),
  p("tasks", "approve"),
  // Submissions
  p("submissions", "view"),
  p("submissions", "approve"),
  p("submissions", "edit"),
  // Brief
  p("brief", "view"),
  p("brief", "create"),
  p("brief", "edit"),
  p("brief", "approve"),
  // Package
  p("package", "view"),
  p("package", "edit"),
  // Assets / moodboard
  p("assets", "view"),
  p("assets", "create"),
  p("assets", "edit"),
  p("assets", "delete"),
  // Client delivery
  p("clientDelivery", "view"),
  p("clientDelivery", "create"),
  p("clientDelivery", "edit"),
  p("clientDelivery", "delete"),
  p("clientDelivery", "approve"),
  // Shoots
  p("shoots", "view"),
  p("shoots", "create"),
  p("shoots", "edit"),
  p("shoots", "delete"),
  p("shoots", "manage"),
  // Meetings
  p("meetings", "view"),
  p("meetings", "create"),
  p("meetings", "edit"),
  p("meetings", "delete"),
  // Equipment
  p("equipment", "view"),
  p("equipment", "create"),
  p("equipment", "edit"),
  p("equipment", "delete"),
  p("equipment", "manage"),
  // Team
  p("team", "view"),
  p("team", "edit"),
  p("team", "manage"),
  // Finance — manager can record but NOT view the totals dashboard / reports.
  p("finance", "view"),
  p("finance", "create"),
  p("finance", "edit"),
  p("finance", "delete"),
  // Admin — can approve users + assign roles up to `head`.
  p("admin", "view"),
  p("admin", "manage"),
  p("admin", "approve"),
]);

// Head of all departments (رئيس جميع الأقسام) — cross-dept visibility on
// the operational surface. Can edit, reassign, cancel and review across
// departments, but is not a manager: cannot approve users, cannot record
// transactions, cannot reach system settings, cannot see finance totals.
const HEAD_PERMS: PermissionSet = new Set<Permission>([
  // Projects — full visibility across all departments
  p("projects", "view"),
  p("projects", "create"),
  p("projects", "edit"),
  p("projects", "delete"),
  p("projects", "assign"),
  p("projects", "manage"),
  // Tasks — full ops control
  p("tasks", "view"),
  p("tasks", "create"),
  p("tasks", "edit"),
  p("tasks", "delete"),
  p("tasks", "assign"),
  p("tasks", "approve"),
  // Submissions — review across all departments
  p("submissions", "view"),
  p("submissions", "approve"),
  p("submissions", "edit"),
  // Brief
  p("brief", "view"),
  p("brief", "create"),
  p("brief", "edit"),
  p("brief", "approve"),
  // Package
  p("package", "view"),
  p("package", "edit"),
  // Assets
  p("assets", "view"),
  p("assets", "create"),
  p("assets", "edit"),
  p("assets", "delete"),
  // Client delivery
  p("clientDelivery", "view"),
  p("clientDelivery", "create"),
  p("clientDelivery", "edit"),
  p("clientDelivery", "delete"),
  p("clientDelivery", "approve"),
  // Shoots
  p("shoots", "view"),
  p("shoots", "create"),
  p("shoots", "edit"),
  p("shoots", "delete"),
  p("shoots", "manage"),
  // Meetings
  p("meetings", "view"),
  p("meetings", "create"),
  p("meetings", "edit"),
  p("meetings", "delete"),
  // Equipment
  p("equipment", "view"),
  p("equipment", "edit"),
  // Team — read across all departments, but not manage
  p("team", "view"),
]);

// Department lead (رئيس قسم) — manages their own department.
const DEPT_LEAD_PERMS: PermissionSet = new Set<Permission>([
  p("projects", "view"),
  p("projects", "create"),
  p("projects", "edit"),
  p("projects", "assign"),
  p("tasks", "view"),
  p("tasks", "create"),
  p("tasks", "edit"),
  p("tasks", "assign"),
  p("tasks", "approve"),
  p("submissions", "view"),
  p("submissions", "approve"),
  p("brief", "view"),
  p("brief", "create"),
  p("brief", "edit"),
  p("package", "view"),
  p("package", "edit"),
  p("assets", "view"),
  p("assets", "create"),
  p("assets", "edit"),
  p("assets", "delete"),
  p("clientDelivery", "view"),
  p("clientDelivery", "create"),
  p("clientDelivery", "edit"),
  p("shoots", "view"),
  p("shoots", "create"),
  p("shoots", "edit"),
  p("meetings", "view"),
  p("meetings", "create"),
  p("meetings", "edit"),
  p("equipment", "view"),
  p("team", "view"),
  p("finance", "view"),
  p("finance", "create"),
]);

// Employee (موظف) — works on their own tasks. Submission flow + schedule
// + notifications. View-only on what they're a member of.
const EMPLOYEE_PERMS: PermissionSet = new Set<Permission>([
  p("tasks", "view"),
  p("submissions", "view"),
  p("submissions", "edit"), // edit their own submission
  p("brief", "view"),
  p("package", "view"),
  p("assets", "view"),
  p("clientDelivery", "view"),
  p("shoots", "view"),
  p("meetings", "view"),
  p("equipment", "view"),
  p("team", "view"),
  p("projects", "view"),
]);

const ROLE_DEFAULTS: Record<Role, PermissionSet> = {
  admin: OWNER_PERMS,
  manager: MANAGER_PERMS,
  head: HEAD_PERMS,
  department_lead: DEPT_LEAD_PERMS,
  employee: EMPLOYEE_PERMS,
};

/** Default-only check (ignores overrides). Useful for showing the matrix UI. */
export function roleHas(role: Role, module: Module, action: Action): boolean {
  return ROLE_DEFAULTS[role].has(p(module, action));
}

export interface OverrideEntry {
  module: string;
  action: string;
  allowed: boolean;
}

/**
 * Resolve a permission for a user. Owner short-circuits to true. Otherwise
 * an explicit override (if present) wins, else the role default applies.
 */
export function hasPermission(
  user: { role: Role | string },
  module: Module,
  action: Action,
  overrides: ReadonlyArray<OverrideEntry> = []
): boolean {
  if (user.role === "admin") return true;

  const override = overrides.find(
    (o) => o.module === module && o.action === action
  );
  if (override) return override.allowed;

  const role = user.role as Role;
  const set = ROLE_DEFAULTS[role];
  if (!set) return false;
  return set.has(p(module, action));
}

/**
 * Bulk resolver — returns all `module:action` permissions a user effectively
 * holds, after overrides. Used by sidebar / bottom-nav to compute visibility
 * once instead of querying per item.
 */
export function effectivePermissions(
  user: { role: Role | string },
  overrides: ReadonlyArray<OverrideEntry> = []
): Set<Permission> {
  if (user.role === "admin") return new Set(OWNER_PERMS);
  const role = user.role as Role;
  const base = new Set<Permission>(ROLE_DEFAULTS[role] ?? new Set());
  for (const o of overrides) {
    const key = `${o.module}:${o.action}` as Permission;
    if (o.allowed) base.add(key);
    else base.delete(key);
  }
  return base;
}
