# SRB Internal Management System — Files Reference

هذا الملف يجمع كل الملفات اللي تم إنشاؤها أو تعديلها في النظام خلال جلسة العمل.

**نطاق الجلسة:** PR #12 → PR #18 (الدور الجديد، نظام الصلاحيات، البريف، الباقة، الموود بورد، تسليم العميل، الفري لانسرز، CRM، تبسيط الأدوار)

**عدد الملفات:** 53
**التاريخ:** 2026-04-29 21:12 UTC

---

## Table of contents

1. [`app/admin/permissions/actions.ts`](#app-admin-permissions-actions-ts-)
2. [`app/admin/permissions/page.tsx`](#app-admin-permissions-page-tsx-)
3. [`app/admin/permissions/permissions-client.tsx`](#app-admin-permissions-permissions-client-tsx-)
4. [`app/api/clients/search/route.ts`](#app-api-clients-search-route-ts-)
5. [`app/api/tasks/[id]/submit/route.ts`](#app-api-tasks--id--submit-route-ts-)
6. [`app/clients/[id]/page.tsx`](#app-clients--id--page-tsx-)
7. [`app/clients/actions.ts`](#app-clients-actions-ts-)
8. [`app/clients/client-notes-section.tsx`](#app-clients-client-notes-section-tsx-)
9. [`app/clients/client-profile-form.tsx`](#app-clients-client-profile-form-tsx-)
10. [`app/clients/client-status-badge.tsx`](#app-clients-client-status-badge-tsx-)
11. [`app/clients/clients-table.tsx`](#app-clients-clients-table-tsx-)
12. [`app/clients/note-actions.ts`](#app-clients-note-actions-ts-)
13. [`app/clients/page.tsx`](#app-clients-page-tsx-)
14. [`app/finance/new-transaction-button.tsx`](#app-finance-new-transaction-button-tsx-)
15. [`app/globals.css`](#app-globals-css-)
16. [`app/layout.tsx`](#app-layout-tsx-)
17. [`app/notifications/mark-all-read-button.tsx`](#app-notifications-mark-all-read-button-tsx-)
18. [`app/notifications/page.tsx`](#app-notifications-page-tsx-)
19. [`app/page.tsx`](#app-page-tsx-)
20. [`app/projects/[id]/page.tsx`](#app-projects--id--page-tsx-)
21. [`app/projects/[id]/project-actions-menu.tsx`](#app-projects--id--project-actions-menu-tsx-)
22. [`app/projects/actions.ts`](#app-projects-actions-ts-)
23. [`app/projects/asset-actions.ts`](#app-projects-asset-actions-ts-)
24. [`app/projects/brief-actions.ts`](#app-projects-brief-actions-ts-)
25. [`app/projects/delivery-actions.ts`](#app-projects-delivery-actions-ts-)
26. [`app/projects/freelancer-actions.ts`](#app-projects-freelancer-actions-ts-)
27. [`app/projects/new-project-button.tsx`](#app-projects-new-project-button-tsx-)
28. [`app/projects/package-actions.ts`](#app-projects-package-actions-ts-)
29. [`app/shoots/[id]/call-sheet/client-print-button.tsx`](#app-shoots--id--call-sheet-client-print-button-tsx-)
30. [`app/shoots/[id]/call-sheet/page.tsx`](#app-shoots--id--call-sheet-page-tsx-)
31. [`app/shoots/[id]/page.tsx`](#app-shoots--id--page-tsx-)
32. [`components/creative-command-center.tsx`](#components-creative-command-center-tsx-)
33. [`components/mobile-bottom-nav.tsx`](#components-mobile-bottom-nav-tsx-)
34. [`components/projects/client-combobox.tsx`](#components-projects-client-combobox-tsx-)
35. [`components/projects/client-deliveries.tsx`](#components-projects-client-deliveries-tsx-)
36. [`components/projects/creative-brief.tsx`](#components-projects-creative-brief-tsx-)
37. [`components/projects/package-tracker.tsx`](#components-projects-package-tracker-tsx-)
38. [`components/projects/project-assets.tsx`](#components-projects-project-assets-tsx-)
39. [`components/projects/project-freelancers.tsx`](#components-projects-project-freelancers-tsx-)
40. [`components/projects/project-profit.tsx`](#components-projects-project-profit-tsx-)
41. [`components/sidebar.tsx`](#components-sidebar-tsx-)
42. [`components/tasks/task-submission-section.tsx`](#components-tasks-task-submission-section-tsx-)
43. [`instrumentation.ts`](#instrumentation-ts-)
44. [`lib/auth-guards.ts`](#lib-auth-guards-ts-)
45. [`lib/auth/permissions.ts`](#lib-auth-permissions-ts-)
46. [`lib/auth/roles.ts`](#lib-auth-roles-ts-)
47. [`lib/db/audit.ts`](#lib-db-audit-ts-)
48. [`lib/db/brief.ts`](#lib-db-brief-ts-)
49. [`lib/db/helpers.ts`](#lib-db-helpers-ts-)
50. [`lib/db/permissions.ts`](#lib-db-permissions-ts-)
51. [`lib/i18n/dict.ts`](#lib-i18n-dict-ts-)
52. [`prisma/schema.prisma`](#prisma-schema-prisma-)
53. [`proxy.ts`](#proxy-ts-)

---

## `app/admin/permissions/actions.ts`

**Lines:** 118

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { setUserOverride } from "@/lib/db/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  ACTIONS,
  MODULES,
  type Action,
  type Module,
} from "@/lib/auth/permissions";

function isModule(value: unknown): value is Module {
  return (
    typeof value === "string" && (MODULES as readonly string[]).includes(value)
  );
}

function isAction(value: unknown): value is Action {
  return (
    typeof value === "string" && (ACTIONS as readonly string[]).includes(value)
  );
}

/**
 * Owner-only: flip a single (module, action) cell on a user.
 *   - allowed=true   → grant explicitly
 *   - allowed=false  → revoke explicitly
 *   - allowed=null   → clear the override (revert to role default)
 */
export async function setPermissionOverrideAction(args: {
  userId: string;
  module: string;
  action: string;
  allowed: boolean | null;
  reason?: string | null;
}) {
  const actor = await requireOwner();

  const { userId, module, action, allowed, reason } = args;
  if (!isModule(module)) return { ok: false as const, message: "module غير صحيح" };
  if (!isAction(action)) return { ok: false as const, message: "action غير صحيح" };

  // The Owner cannot strip permissions from themselves — Owner is always all-on.
  // We still allow the row to be written (the resolver short-circuits on admin),
  // but block it here to keep the UI honest.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!target) return { ok: false as const, message: "الموظف غير موجود" };
  if (target.role === "admin" && actor.id === target.id) {
    return {
      ok: false as const,
      message: "ما تقدر تعدّل صلاحياتك أنت — الرئيس له كل الصلاحيات افتراضياً",
    };
  }

  const result = await setUserOverride({
    userId,
    module,
    action,
    allowed,
    grantedById: actor.id,
    reason: reason ?? null,
  });

  await logAudit({
    action:
      allowed === null
        ? "permission.reset"
        : allowed
        ? "permission.grant"
        : "permission.revoke",
    target: {
      type: "user",
      id: userId,
      label: `${target.name} · ${target.email}`,
    },
    metadata: { module, action, allowed, reason: reason ?? null },
  });

  revalidatePath("/admin/permissions");
  return { ok: true as const, ...result };
}

/**
 * Owner-only: clear ALL overrides on a user (reset their permissions to the
 * role default). Useful for the "Reset to defaults" button on each row.
 */
export async function resetUserPermissionsAction(userId: string) {
  const actor = await requireOwner();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!target) return { ok: false as const, message: "الموظف غير موجود" };

  const removed = await prisma.permissionOverride.deleteMany({
    where: { userId },
  });

  await logAudit({
    action: "permission.reset",
    target: {
      type: "user",
      id: userId,
      label: `${target.name} · ${target.email}`,
    },
    metadata: { byActor: actor.id, removedCount: removed.count, scope: "all" },
  });

  revalidatePath("/admin/permissions");
  return { ok: true as const, removed: removed.count };
}

```

---

## `app/admin/permissions/page.tsx`

**Lines:** 76

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { isOwner } from "@/lib/auth/roles";
import { listOverridesForUsers } from "@/lib/db/permissions";
import { PermissionsClient } from "./permissions-client";

export default async function AdminPermissionsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  if (!session?.user) redirect("/login");
  if (!isOwner(session.user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6 text-center">
          <div className="text-lg font-bold text-rose-400">
            {t("admin.denied.title")}
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            {locale === "ar"
              ? "هذي الصفحة للرئيس فقط — يقدر يتحكم بصلاحيات كل موظف يدوياً."
              : "This page is for the Owner only — fine-grained permission control."}
          </p>
        </div>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      jobTitle: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const overridesByUser = await listOverridesForUsers(users.map((u) => u.id));

  // Serialize the Map for the client component (Next won't pass Maps across
  // the boundary).
  const overridesPayload: Record<
    string,
    { module: string; action: string; allowed: boolean }[]
  > = {};
  for (const [userId, list] of overridesByUser.entries()) {
    overridesPayload[userId] = list;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {locale === "ar" ? "لوحة الصلاحيات" : "Permission Control Panel"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {locale === "ar"
            ? "حدّد صلاحيات كل موظف بدقة — يمكنك تعطيل أو منح أي صلاحية يدوياً، فوق الإعدادات الافتراضية لدوره."
            : "Override role defaults per user. Grant or revoke individual capabilities without inventing new roles."}
        </p>
      </div>
      <PermissionsClient
        users={users}
        overridesByUser={overridesPayload}
        locale={locale}
      />
    </div>
  );
}

```

---

## `app/admin/permissions/permissions-client.tsx`

**Lines:** 490

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ACTION_LABEL_AR,
  ACTION_LABEL_EN,
  MODULE_SPECS,
  roleHas,
  type Action,
  type Module,
} from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";
import {
  resetUserPermissionsAction,
  setPermissionOverrideAction,
} from "./actions";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  jobTitle: string | null;
}

interface OverrideEntry {
  module: string;
  action: string;
  allowed: boolean;
}

interface Props {
  users: UserRow[];
  overridesByUser: Record<string, OverrideEntry[]>;
  locale: "ar" | "en";
}

type CellState = "default-on" | "default-off" | "granted" | "revoked";

const ROLE_COLOR: Record<string, string> = {
  admin: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  manager: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  department_lead: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  employee: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

function roleLabel(role: string, locale: "ar" | "en"): string {
  const ar: Record<string, string> = {
    admin: "الرئيس",
    manager: "المدير",
    department_lead: "رئيس الفريق",
    employee: "الموظف",
  };
  const en: Record<string, string> = {
    admin: "President",
    manager: "Manager",
    department_lead: "Team lead",
    employee: "Employee",
  };
  return (locale === "ar" ? ar : en)[role] ?? role;
}

export function PermissionsClient({
  users,
  overridesByUser: initialOverrides,
  locale,
}: Props) {
  const [overridesByUser, setOverridesByUser] = useState(initialOverrides);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    users[0]?.id ?? null
  );
  const [flash, setFlash] = useState<{
    tone: "success" | "error";
    msg: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.jobTitle ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const showFlash = (tone: "success" | "error", msg: string) => {
    setFlash({ tone, msg });
    setTimeout(() => setFlash(null), 3000);
  };

  function cellStateFor(
    userRole: string,
    module: Module,
    action: Action,
    overrides: OverrideEntry[]
  ): CellState {
    const override = overrides.find(
      (o) => o.module === module && o.action === action
    );
    const def = roleHas(userRole as Role, module, action);
    if (override) {
      return override.allowed ? "granted" : "revoked";
    }
    return def ? "default-on" : "default-off";
  }

  // Cycle: default → grant → revoke → default
  function nextStateFor(s: CellState): boolean | null {
    if (s === "default-on") return false; // currently allowed by default → revoke
    if (s === "default-off") return true; // currently denied by default → grant
    if (s === "granted") return false; // explicitly granted → flip to revoke
    return null; // explicitly revoked → clear (back to default)
  }

  async function toggleCell(
    user: UserRow,
    module: Module,
    action: Action,
    nextAllowed: boolean | null
  ) {
    const optimistic = [...(overridesByUser[user.id] ?? [])];
    const idx = optimistic.findIndex(
      (o) => o.module === module && o.action === action
    );
    if (nextAllowed === null) {
      if (idx >= 0) optimistic.splice(idx, 1);
    } else if (idx >= 0) {
      optimistic[idx] = { module, action, allowed: nextAllowed };
    } else {
      optimistic.push({ module, action, allowed: nextAllowed });
    }
    setOverridesByUser((prev) => ({ ...prev, [user.id]: optimistic }));

    startTransition(async () => {
      try {
        const res = await setPermissionOverrideAction({
          userId: user.id,
          module,
          action,
          allowed: nextAllowed,
        });
        if (!res.ok) {
          showFlash("error", res.message ?? "فشل التحديث");
          // Revert optimistic state on error.
          setOverridesByUser((prev) => ({
            ...prev,
            [user.id]: initialOverrides[user.id] ?? [],
          }));
        }
      } catch (e) {
        showFlash(
          "error",
          e instanceof Error ? e.message : "خطأ غير متوقع"
        );
        setOverridesByUser((prev) => ({
          ...prev,
          [user.id]: initialOverrides[user.id] ?? [],
        }));
      }
    });
  }

  async function resetUser(user: UserRow) {
    if (
      !confirm(
        locale === "ar"
          ? `إرجاع كل صلاحيات ${user.name} للافتراضي؟`
          : `Reset all custom permissions for ${user.name}?`
      )
    )
      return;
    setOverridesByUser((prev) => ({ ...prev, [user.id]: [] }));
    startTransition(async () => {
      const res = await resetUserPermissionsAction(user.id);
      if (!res.ok) {
        showFlash("error", res.message ?? "فشل الإرجاع");
      } else {
        showFlash(
          "success",
          locale === "ar"
            ? `تم إرجاع صلاحيات ${user.name} للافتراضي`
            : `Reset ${user.name}'s overrides`
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      {flash && (
        <div
          className={cn(
            "rounded-lg border px-4 py-2 text-sm",
            flash.tone === "success"
              ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-400"
              : "border-rose-900/40 bg-rose-950/20 text-rose-400"
          )}
        >
          {flash.msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* User picker */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="relative mb-3">
            <Search
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              style={locale === "ar" ? { right: 10 } : { left: 10 }}
            />
            <input
              type="search"
              placeholder={
                locale === "ar" ? "بحث بالموظفين..." : "Search users..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none",
                locale === "ar" ? "pr-9" : "pl-9"
              )}
            />
          </div>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {filteredUsers.map((u) => {
              const overrideCount = overridesByUser[u.id]?.length ?? 0;
              const active = u.id === selectedUserId;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start transition",
                      active
                        ? "bg-zinc-800/80 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {u.name}
                      </div>
                      <div className="truncate text-[11px] text-zinc-500">
                        {u.jobTitle ?? u.department ?? u.email}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                        ROLE_COLOR[u.role] ??
                          "bg-zinc-800 text-zinc-400 border-zinc-700"
                      )}
                    >
                      {roleLabel(u.role, locale)}
                    </span>
                    {overrideCount > 0 && (
                      <span className="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-400">
                        {overrideCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Matrix */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              {locale === "ar"
                ? "اختر موظفاً من القائمة"
                : "Pick a user from the list"}
            </div>
          ) : selected.role === "admin" ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <ShieldCheck className="h-8 w-8 text-rose-400" />
              <div className="text-sm font-semibold text-zinc-100">
                {locale === "ar"
                  ? "الرئيس له كل الصلاحيات افتراضياً"
                  : "The Owner has all permissions by default"}
              </div>
              <p className="max-w-md text-xs text-zinc-500">
                {locale === "ar"
                  ? "ما يحتاج تعديل — أي تغيير على هذا الحساب يتم تجاوزه أمنياً عند الفحص."
                  : "Owner permissions are short-circuited at the resolver level. Any override on this row is ignored."}
              </p>
            </div>
          ) : (
            <PermissionMatrix
              user={selected}
              overrides={overridesByUser[selected.id] ?? []}
              locale={locale}
              onCellClick={async (module, action) => {
                const state = cellStateFor(
                  selected.role,
                  module,
                  action,
                  overridesByUser[selected.id] ?? []
                );
                await toggleCell(
                  selected,
                  module,
                  action,
                  nextStateFor(state)
                );
              }}
              onReset={() => resetUser(selected)}
            />
          )}
        </div>
      </div>

      <Legend locale={locale} />
    </div>
  );
}

function PermissionMatrix({
  user,
  overrides,
  locale,
  onCellClick,
  onReset,
}: {
  user: UserRow;
  overrides: OverrideEntry[];
  locale: "ar" | "en";
  onCellClick: (module: Module, action: Action) => void | Promise<void>;
  onReset: () => void;
}) {
  const actionLabel = locale === "ar" ? ACTION_LABEL_AR : ACTION_LABEL_EN;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <div className="text-base font-semibold text-zinc-100">
            {user.name}
          </div>
          <div className="text-[11px] text-zinc-500">
            {user.jobTitle && (
              <>
                <span>{user.jobTitle}</span>
                <span className="mx-1">·</span>
              </>
            )}
            {user.department && <span>{user.department}</span>}
            {user.department && <span className="mx-1">·</span>}
            <span dir="ltr">{user.email}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex h-10 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-xs text-zinc-400 transition hover:border-rose-500/30 hover:text-rose-400"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {locale === "ar"
            ? "إرجاع للافتراضي"
            : "Reset to role defaults"}
        </button>
      </div>

      <div className="space-y-3">
        {MODULE_SPECS.map((m) => (
          <div key={m.key} className="rounded-lg border border-zinc-800 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-100">
                {locale === "ar" ? m.labelAr : m.labelEn}
              </div>
              <div
                className="text-[10px] text-zinc-500"
                dir="ltr"
              >
                {m.key}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {m.actions.map((a) => {
                const ov = overrides.find(
                  (o) => o.module === m.key && o.action === a
                );
                const def = roleHas(user.role as Role, m.key, a);
                const isOn = ov ? ov.allowed : def;
                const isOverride = !!ov;

                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => onCellClick(m.key, a)}
                    title={
                      isOverride
                        ? locale === "ar"
                          ? `قاعدة مخصصة (الافتراضي: ${
                              def ? "مفعّل" : "معطّل"
                            })`
                          : `Custom override (default was ${def ? "ON" : "OFF"})`
                        : locale === "ar"
                        ? "إعداد افتراضي للدور"
                        : "Role default"
                    }
                    className={cn(
                      "flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-xs transition",
                      isOn
                        ? isOverride
                          ? "border-violet-500/40 bg-violet-500/10 text-violet-300 hover:border-violet-400/60"
                          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300 hover:border-emerald-400/50"
                        : isOverride
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:border-rose-400/60"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    )}
                  >
                    {isOn ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    {actionLabel[a]}
                    {isOverride && (
                      <span
                        className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-violet-400"
                        aria-label="custom"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ locale }: { locale: "ar" | "en" }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] text-zinc-400">
      <span className="font-semibold text-zinc-300">
        {locale === "ar" ? "الدليل:" : "Legend:"}
      </span>
      <LegendChip
        color="bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
        label={locale === "ar" ? "افتراضي مفعّل" : "Default ON"}
      />
      <LegendChip
        color="bg-zinc-900 text-zinc-500 border-zinc-800"
        label={locale === "ar" ? "افتراضي معطّل" : "Default OFF"}
      />
      <LegendChip
        color="bg-violet-500/10 text-violet-300 border-violet-500/40"
        label={locale === "ar" ? "ممنوحة يدوياً" : "Manually granted"}
      />
      <LegendChip
        color="bg-rose-500/10 text-rose-300 border-rose-500/40"
        label={locale === "ar" ? "مسحوبة يدوياً" : "Manually revoked"}
      />
      <span className="ms-auto text-[10px] text-zinc-500">
        {locale === "ar"
          ? "اضغط أي خانة للتنقل بين الحالات"
          : "Click a cell to cycle through states"}
      </span>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className={cn("inline-flex rounded-md border px-2 py-0.5", color)}>
      {label}
    </span>
  );
}

```

---

## `app/api/clients/search/route.ts`

**Lines:** 26

```tsx
// Search endpoint that powers the client combobox in the new-project form
// and any future autocomplete inputs that need a client picker.
//
// Public to ANY authenticated active user — the combobox shows up wherever
// a project is being authored, and the data is just (name, phone). The
// /clients page itself is gated separately on the `clients:view` permission.

import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth-guards";
import { searchClients } from "@/app/clients/actions";

export async function GET(req: Request) {
  try {
    await requireActiveUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(20, Math.max(1, parseInt(limitRaw ?? "10", 10) || 10));

  const results = await searchClients(q, limit);
  return NextResponse.json({ ok: true, results });
}

```

---

## `app/api/tasks/[id]/submit/route.ts`

**Lines:** 201

```tsx
// Employee submits work for a task. Accepts JSON or multipart/form-data with
// optional `linkUrl`, optional `fileUrl` (already uploaded via
// /api/tasks/upload), `fileName`, `fileType`, and an optional `note`.
//
// Side effects:
//   1. Writes the latest submission fields onto the Task row (flat snapshot).
//   2. Appends a TaskSubmission history row.
//   3. Flips the task status to `in_review` (NOT done).
//   4. Notifies every active owner via in-app + Web Push.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { isOwner } from "@/lib/auth/roles";
import { createNotificationMany } from "@/lib/db/notifications";
import { sanitizeLinkUrl, saveUploadedFile } from "@/lib/uploads";
import { safeString, MAX_LONG_TEXT, MAX_NAME_LEN } from "@/lib/input-limits";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      collaborators: { select: { userId: true } },
      project: { select: { id: true, title: true } },
    },
  });
  if (!task) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Assignee + collaborators can submit. Admin (the owner of the system)
  // can also submit on behalf — they manage every project end-to-end.
  const me = session.user.id;
  const isAssignee = task.assigneeId === me;
  const isCollab = task.collaborators.some((c) => c.userId === me);
  const isAdmin = isOwner(session.user.role);
  if (!isAssignee && !isCollab && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Accept either JSON or multipart so the client can do a one-shot file +
  // link submit, or upload first via /api/tasks/upload and then send JSON.
  let linkUrl: string | null = null;
  let fileUrl: string | null = null;
  let fileName: string | null = null;
  let fileType: string | null = null;
  let note: string | null = null;

  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.toLowerCase().includes("multipart/form-data")) {
      const form = await req.formData();
      linkUrl = sanitizeLinkUrl(form.get("linkUrl"));
      note = safeString(form.get("note"), MAX_LONG_TEXT);
      const fileEntry = form.get("file");
      if (fileEntry && typeof fileEntry !== "string") {
        const f = fileEntry as File;
        if (f.size > 0) {
          const saved = await saveUploadedFile(f, "tasks");
          fileUrl = saved.url;
          fileName = saved.fileName;
          fileType = saved.fileType;
        }
      }
      // Allow client-side pre-upload: pass the URL straight through.
      if (!fileUrl) {
        const passedUrl = safeString(form.get("fileUrl"), 2000);
        if (passedUrl) fileUrl = passedUrl;
        fileName = safeString(form.get("fileName"), MAX_NAME_LEN);
        fileType = safeString(form.get("fileType"), 100);
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      linkUrl = sanitizeLinkUrl(body.linkUrl);
      note = safeString(body.note, MAX_LONG_TEXT);
      const passedUrl = safeString(body.fileUrl, 2000);
      if (passedUrl) {
        // Force same-origin /uploads paths — never trust an absolute URL.
        if (!passedUrl.startsWith("/uploads/")) {
          return NextResponse.json(
            { error: "fileUrl must reference /uploads/" },
            { status: 400 }
          );
        }
        fileUrl = passedUrl;
        fileName = safeString(body.fileName, MAX_NAME_LEN);
        fileType = safeString(body.fileType, 100);
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "إدخال غير صحيح" },
      { status: 400 }
    );
  }

  if (!linkUrl && !fileUrl) {
    return NextResponse.json(
      { error: "أرفق رابط أو ملف على الأقل" },
      { status: 400 }
    );
  }

  const now = new Date();

  // Revision number = (count of prior submissions on this task) + 1. So the
  // very first submission is Revision 1; if the owner requests changes and
  // the assignee re-submits, that becomes Revision 2; etc. Computed inside
  // the transaction so concurrent submits are handled by Prisma's serial
  // execution within $transaction.
  const priorCount = await prisma.taskSubmission.count({
    where: { taskId: id },
  });
  const revisionNumber = priorCount + 1;

  await prisma.$transaction([
    // Latest snapshot on the Task row.
    prisma.task.update({
      where: { id },
      data: {
        status: "in_review",
        submissionUrl: linkUrl,
        submissionFileUrl: fileUrl,
        submissionFileName: fileName,
        submissionFileType: fileType,
        submissionNote: note,
        submittedAt: now,
        // Clear any prior review note — this is a fresh submission.
        reviewNote: null,
        reviewedAt: null,
        ...(task.startedAt ? {} : { startedAt: now }),
      },
    }),
    // Append-only history row.
    prisma.taskSubmission.create({
      data: {
        taskId: id,
        submitterId: me,
        linkUrl: linkUrl,
        fileUrl: fileUrl,
        fileName: fileName,
        fileType: fileType,
        note: note,
        status: "pending",
        revisionNumber,
      },
    }),
    prisma.taskUpdate.create({
      data: {
        taskId: id,
        actorId: me,
        type: "status_change",
        fromValue: task.status,
        toValue: "in_review",
      },
    }),
  ]);

  // Notify every active owner (admin = الرئيس).
  const owners = await prisma.user.findMany({
    where: { role: "admin", active: true },
    select: { id: true },
  });
  if (owners.length > 0) {
    await createNotificationMany(
      owners.map((o) => o.id),
      {
        kind: "task.submitted",
        severity: "info",
        title: `${session.user.name ?? "موظف"} سلّم مهمة "${task.title}" — راجعها`,
        body: task.project ? `المشروع: ${task.project.title}` : null,
        linkUrl: task.projectId ? `/projects/${task.projectId}` : "/tasks",
        refType: "task",
        refId: id,
      }
    );
  }

  await logAudit({
    action: "task.update",
    target: { type: "task", id, label: task.title },
    metadata: {
      event: "submission.created",
      revisionNumber,
      hasLink: !!linkUrl,
      hasFile: !!fileUrl,
    },
  });

  return NextResponse.json({ ok: true });
}

```

---

## `app/clients/[id]/page.tsx`

**Lines:** 309

```tsx
// Client profile page — header with editable contact fields, projects table,
// and a financial summary footer. The header form is a client component that
// posts back via the updateClientAction server action; the table + summary
// are pure server-rendered.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, UsersRound } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { hasPermission } from "@/lib/auth/permissions";
import { getUserOverrides } from "@/lib/db/permissions";
import { isOwner } from "@/lib/auth/roles";
import { cn } from "@/lib/cn";
import {
  PROJECT_STATUS_COLOR,
  formatDate,
  formatQar,
} from "@/lib/db/helpers";
import { ClientProfileForm } from "../client-profile-form";
import { ClientStatusBadge } from "../client-status-badge";
import { ClientNotesSection } from "../client-notes-section";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const Back = locale === "ar" ? ArrowRight : ArrowLeft;

  const sessionUser = session?.user;
  if (!sessionUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-zinc-500">{t("admin.denied.desc")}</div>
      </div>
    );
  }

  const overrides = await getUserOverrides(sessionUser.id);
  const canView = hasPermission(sessionUser, "clients", "view", overrides);
  const canEdit = hasPermission(sessionUser, "clients", "edit", overrides);
  const canDelete = hasPermission(sessionUser, "clients", "delete", overrides);

  if (!canView) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6 text-center">
          <div className="text-lg font-bold text-rose-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-sm text-zinc-400">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        include: {
          transactions: {
            where: { kind: "income" },
            select: { amountQar: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      noteEntries: {
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) notFound();

  // Aggregates for the summary footer + per-project remaining column.
  // contractValue = sum of agreed budgets across the client's projects.
  // Surfaces the moment a project is created so the team has an honest
  // "this client is worth X" number even before any invoice is recorded.
  // totalPaid = actual money collected (sum of income transactions). Stays
  // at 0 until someone records an invoice.
  const contractValue = client.projects.reduce((sum, p) => sum + p.budgetQar, 0);
  const totalPaid = client.projects.reduce(
    (sum, p) => sum + p.transactions.reduce((a, t) => a + t.amountQar, 0),
    0
  );
  const completedCount = client.projects.filter((p) => p.status === "completed").length;
  const activeCount = client.projects.filter(
    (p) => p.status === "active" || p.status === "on_hold"
  ).length;
  // Computed status — same rule as the table: "active" if at least one
  // project is in `active` state, otherwise "finished". Never persisted.
  const isActive = client.projects.some((p) => p.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/clients"
          className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <Back className="h-3 w-3" />
          {t("page.clients.title")}
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <UsersRound className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <ClientStatusBadge isActive={isActive} size="lg" />
            </div>
            <p className="text-xs text-zinc-500">
              {client.brandName && (
                <span className="text-zinc-300">{client.brandName} · </span>
              )}
              {client.projects.length} {t("clients.col.projectsCount")} ·{" "}
              {contractValue > 0 ? formatQar(contractValue, { locale }) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Editable profile */}
      <ClientProfileForm
        id={client.id}
        initial={{
          name: client.name,
          brandName: client.brandName,
          phone: client.phone,
          email: client.email,
          notes: client.notes,
        }}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      {/* Projects table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          {t("clients.detail.projects")}
        </h2>
        {client.projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-500">
            {t("clients.proj.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
                  <Th>{t("clients.proj.title")}</Th>
                  <Th>{t("clients.proj.type")}</Th>
                  <Th>{t("clients.proj.status")}</Th>
                  <Th align="end">{t("clients.proj.budget")}</Th>
                  <Th align="end">{t("clients.proj.paid")}</Th>
                  <Th align="end">{t("clients.proj.remaining")}</Th>
                  <Th>{t("clients.proj.startedAt")}</Th>
                </tr>
              </thead>
              <tbody>
                {client.projects.map((p) => {
                  const paid = p.transactions.reduce((a, t) => a + t.amountQar, 0);
                  const remaining = Math.max(0, p.budgetQar - paid);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-900 transition hover:bg-zinc-900/60 last:border-b-0"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/projects/${p.id}`}
                          className="font-semibold text-zinc-100 hover:text-emerald-400"
                        >
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {p.billingType === "monthly"
                          ? t("billing.monthly")
                          : t("billing.one_time")}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px]",
                            PROJECT_STATUS_COLOR[p.status]
                          )}
                        >
                          {t(`projectStatus.${p.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums text-zinc-200">
                        {p.budgetQar > 0 ? formatQar(p.budgetQar, { locale }) : "—"}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums text-emerald-400">
                        {paid > 0 ? formatQar(paid, { locale }) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-end tabular-nums",
                          remaining > 0 ? "text-amber-400" : "text-zinc-500"
                        )}
                      >
                        {remaining > 0 ? formatQar(remaining, { locale }) : "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-500 tabular-nums">
                        {formatDate(p.startedAt, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Communication log — touchpoint notes */}
      <ClientNotesSection
        clientId={client.id}
        notes={client.noteEntries.map((n) => ({
          id: n.id,
          content: n.content,
          createdAt: n.createdAt,
          author: n.author ? { id: n.author.id, name: n.author.name } : null,
        }))}
        currentUserId={sessionUser.id}
        currentUserIsOwner={isOwner(sessionUser.role)}
      />

      {/* Financial summary */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">
          {t("clients.detail.summary")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label={t("clients.detail.contractValue")}
            value={contractValue > 0 ? formatQar(contractValue, { locale }) : "—"}
            tone="emerald"
          />
          <SummaryCard
            label={t("clients.detail.totalPaid")}
            value={totalPaid > 0 ? formatQar(totalPaid, { locale }) : "—"}
            tone="sky"
          />
          <SummaryCard
            label={t("clients.detail.completedCount")}
            value={String(completedCount)}
            tone="amber"
          />
          <SummaryCard
            label={t("clients.detail.activeCount")}
            value={String(activeCount)}
            tone="amber"
          />
        </div>
      </section>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th
      className={cn(
        "px-3 py-2 font-medium",
        align === "end" ? "text-end" : "text-start"
      )}
    >
      {children}
    </th>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "sky"
      ? "text-sky-400"
      : "text-amber-400";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", toneClass)}>
        {value}
      </div>
    </div>
  );
}

```

---

## `app/clients/actions.ts`

**Lines:** 231

```tsx
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
  let brandName: string | null;
  let phone: string | null;
  let email: string | null;
  let notes: string | null;
  try {
    name = safeString(formData.get("name"), MAX_NAME_LEN);
    brandName = safeString(formData.get("brandName"), MAX_NAME_LEN);
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
    data: { name, brandName, phone, email, notes },
  });

  await logAudit({
    action: "client.create",
    target: { type: "client", id: client.id, label: client.name },
    metadata: {
      brandName: client.brandName ?? null,
      phone: client.phone ?? null,
      email: client.email ?? null,
    },
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
  let brandName: string | null;
  let phone: string | null;
  let email: string | null;
  let notes: string | null;
  try {
    name = safeString(formData.get("name"), MAX_NAME_LEN);
    brandName = safeString(formData.get("brandName"), MAX_NAME_LEN);
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
    data: { name, brandName, phone, email, notes },
  });

  await logAudit({
    action: "client.update",
    target: { type: "client", id: updated.id, label: updated.name },
    metadata: {
      before: {
        name: before.name,
        brandName: before.brandName,
        phone: before.phone,
        email: before.email,
      },
      after: {
        name: updated.name,
        brandName: updated.brandName,
        phone: updated.phone,
        email: updated.email,
      },
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

```

---

## `app/clients/client-notes-section.tsx`

**Lines:** 204

```tsx
"use client";

// Communication log section on the client profile. Adds and deletes
// touchpoint entries via server actions, keeping the list ordered newest
// first. Times are rendered with `formatRelativeAr` (locale-aware Arabic /
// English) — the underlying createdAt is preserved as a tooltip so the team
// can recover the exact timestamp if the relative copy is ambiguous.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { useT, useLocale } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import {
  createClientNoteAction,
  deleteClientNoteAction,
} from "./note-actions";

interface NoteAuthor {
  id: string;
  name: string;
}

export interface ClientNoteRow {
  id: string;
  content: string;
  createdAt: Date | string;
  author: NoteAuthor | null;
}

interface Props {
  clientId: string;
  notes: ClientNoteRow[];
  currentUserId: string;
  currentUserIsOwner: boolean;
}

export function ClientNotesSection({
  clientId,
  notes,
  currentUserId,
  currentUserIsOwner,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await createClientNoteAction(clientId, formData);
      if (res.ok) {
        setContent("");
        router.refresh();
      } else {
        setError(res.message ?? t("common.errorGeneric"));
      }
    });
  };

  const onDelete = (id: string) => {
    if (!confirm(t("clients.notes.deleteConfirm"))) return;
    startTransition(async () => {
      const res = await deleteClientNoteAction(id);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.message ?? t("common.errorGeneric"));
      }
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
        <MessageSquare className="h-4 w-4" />
        {t("clients.notes.title")}
      </h2>

      {error && (
        <div className="rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}

      <form action={onSubmit} className="space-y-2">
        <textarea
          name="content"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("clients.notes.placeholder")}
          required
          className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !content.trim()}
            className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isPending ? t("clients.notes.adding") : t("clients.notes.add")}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center text-xs text-zinc-500">
          {t("clients.notes.empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const canDelete =
              (n.author && n.author.id === currentUserId) || currentUserIsOwner;
            const created = new Date(n.createdAt);
            const authorName =
              n.author?.name ?? t("clients.notes.deletedAuthor");
            return (
              <li
                key={n.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-zinc-200">
                    {authorName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <time
                      title={created.toLocaleString(
                        locale === "ar" ? "ar-EG" : "en-US"
                      )}
                      className="text-zinc-500 tabular-nums"
                    >
                      {formatRelativeAr(created, locale)}
                    </time>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(n.id)}
                        title={t("clients.notes.delete")}
                        className={cn(
                          "rounded p-1 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-400",
                          isPending && "opacity-50"
                        )}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-300">
                  {n.content}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Locale-aware relative formatter ("منذ ٣ ساعات" / "أمس" / explicit date).
// Stays under a minute for "now", then switches to minutes / hours / days,
// and falls back to a short date once we cross 7 days. Western digits are
// kept on purpose so the rest of the system's tabular alignment works.
function formatRelativeAr(d: Date, locale: "ar" | "en"): string {
  const ms = Date.now() - d.getTime();
  if (ms < 0) {
    // Future-dated note — shouldn't happen, but if clocks drift, fall back
    // to an absolute date instead of crashing.
    return d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US");
  }
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return locale === "ar" ? "الآن" : "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return locale === "ar"
      ? `منذ ${min} ${min === 1 ? "دقيقة" : "دقيقة"}`
      : `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return locale === "ar"
      ? `منذ ${hr} ${hr === 1 ? "ساعة" : "ساعة"}`
      : `${hr}h ago`;
  }
  const day = Math.floor(hr / 24);
  if (day === 1) return locale === "ar" ? "أمس" : "yesterday";
  if (day < 7) {
    return locale === "ar" ? `منذ ${day} أيام` : `${day}d ago`;
  }
  // > 1 week: explicit date.
  return d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

```

---

## `app/clients/client-profile-form.tsx`

**Lines:** 193

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { deleteClientAction, updateClientAction } from "./actions";

interface Initial {
  name: string;
  brandName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface Props {
  id: string;
  initial: Initial;
  canEdit: boolean;
  canDelete: boolean;
}

export function ClientProfileForm({ id, initial, canEdit, canDelete }: Props) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await updateClientAction(id, formData);
      if (res.ok) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
        router.refresh();
      } else {
        setError(res.message ?? t("common.errorGeneric"));
      }
    });
  };

  const onDelete = () => {
    if (!confirm(t("clients.detail.deleteConfirm"))) return;
    startTransition(async () => {
      const res = await deleteClientAction(id);
      if (!res.ok) {
        setError(res.message ?? t("common.errorGeneric"));
      }
      // On success the action redirects to /clients; the router doesn't
      // reach here.
    });
  };

  return (
    <form
      action={onSubmit}
      className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">
          {t("clients.detail.profile")}
        </h2>
        {savedFlash && (
          <span className="text-[11px] text-emerald-400">
            ✓ {t("clients.detail.saved")}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={`${t("clients.field.name")} *`} full>
          <input
            name="name"
            required
            defaultValue={initial.name}
            disabled={!canEdit}
            className={cn(
              "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
        <Field label={t("clients.field.brand")}>
          <input
            name="brandName"
            defaultValue={initial.brandName ?? ""}
            disabled={!canEdit}
            placeholder={t("clients.field.brandPlaceholder")}
            className={cn(
              "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
        <Field label={t("clients.field.phone")}>
          <input
            name="phone"
            dir="ltr"
            defaultValue={initial.phone ?? ""}
            disabled={!canEdit}
            placeholder={t("clients.field.phonePlaceholder")}
            className={cn(
              "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
        <Field label={t("clients.field.email")}>
          <input
            name="email"
            type="email"
            dir="ltr"
            defaultValue={initial.email ?? ""}
            disabled={!canEdit}
            placeholder={t("clients.field.emailPlaceholder")}
            className={cn(
              "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
        <Field label={t("clients.field.notes")} full>
          <textarea
            name="notes"
            rows={3}
            defaultValue={initial.notes ?? ""}
            disabled={!canEdit}
            placeholder={t("clients.field.notesPlaceholder")}
            className={cn(
              "w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
      </div>

      {(canEdit || canDelete) && (
        <div className="flex items-center justify-between gap-2 border-t border-zinc-800 pt-3">
          {canDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("clients.detail.delete")}
            </button>
          ) : (
            <span />
          )}
          {canEdit && (
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {isPending ? t("clients.detail.saving") : t("clients.detail.save")}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

```

---

## `app/clients/client-status-badge.tsx`

**Lines:** 38

```tsx
"use client";

// Computed status badge for a client. The "active" / "finished" decision is
// derived from the client's projects (see app/clients/page.tsx and
// app/clients/[id]/page.tsx) — never persisted, so this component just
// renders the boolean.

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

export function ClientStatusBadge({
  isActive,
  size = "default",
}: {
  isActive: boolean;
  size?: "default" | "lg";
}) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "lg" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]",
        isActive
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-emerald-400" : "bg-zinc-500"
        )}
      />
      {isActive ? t("clients.status.active") : t("clients.status.inactive")}
    </span>
  );
}

```

---

## `app/clients/clients-table.tsx`

**Lines:** 355

```tsx
"use client";

// Live-search table for /clients. Pure in-memory filter (no fetch on each
// keystroke) — at 1k rows this is faster than a network round-trip and the
// list page already has every row it needs.

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Search, X, Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dict";
import { formatDate, formatQar } from "@/lib/db/helpers";
import { cn } from "@/lib/cn";
import { createClientAction } from "./actions";
import { ClientStatusBadge } from "./client-status-badge";

interface Row {
  id: string;
  name: string;
  brandName: string | null;
  phone: string | null;
  email: string | null;
  projectsCount: number;
  paidRevenue: number;
  contractValue: number;
  lastProjectTitle: string | null;
  lastProjectAt: Date | string | null;
  joinedAt: Date | string;
  isActive: boolean;
}

interface Props {
  rows: Row[];
  canCreate: boolean;
  locale: Locale;
  emptyAddOnly?: boolean;
}

export function ClientsTable({ rows, canCreate, locale, emptyAddOnly }: Props) {
  const t = useT();
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const name = r.name.toLowerCase();
      const phone = (r.phone ?? "").toLowerCase();
      const brand = (r.brandName ?? "").toLowerCase();
      return (
        name.includes(needle) ||
        phone.includes(needle) ||
        brand.includes(needle)
      );
    });
  }, [rows, q]);

  const onCopy = (id: string, phone: string | null) => {
    if (!phone) return;
    void navigator.clipboard?.writeText(phone).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1200);
    });
  };

  if (emptyAddOnly) {
    return (
      <>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            {t("clients.action.new")}
          </button>
        )}
        {showNew && <NewClientModal onClose={() => setShowNew(false)} />}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500",
              locale === "ar" ? "right-3" : "left-3"
            )}
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("clients.searchPlaceholder")}
            className={cn(
              "w-full rounded-lg border border-zinc-800 bg-zinc-900/40 py-2 text-sm text-zinc-100 focus:border-emerald-500/40 focus:outline-none",
              locale === "ar" ? "pr-9 pl-3" : "pl-9 pr-3"
            )}
          />
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            {t("clients.action.new")}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
              <Th>{t("clients.col.name")}</Th>
              <Th>{t("clients.col.status")}</Th>
              <Th>{t("clients.col.brand")}</Th>
              <Th>{t("clients.col.phone")}</Th>
              <Th align="end">{t("clients.col.projectsCount")}</Th>
              <Th align="end">{t("clients.col.contractValue")}</Th>
              <Th align="end">{t("clients.col.paidRevenue")}</Th>
              <Th>{t("clients.col.lastProject")}</Th>
              <Th>{t("clients.col.joinedAt")}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-zinc-900 transition hover:bg-zinc-900/60 last:border-b-0"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/clients/${r.id}`}
                    className="font-semibold text-zinc-100 hover:text-emerald-400"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <ClientStatusBadge isActive={r.isActive} />
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {r.brandName ? (
                    <span className="truncate">{r.brandName}</span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {r.phone ? (
                    <div className="flex items-center gap-1.5" dir="ltr">
                      <span className="tabular-nums">{r.phone}</span>
                      <button
                        type="button"
                        title={t("clients.action.copyPhone")}
                        onClick={() => onCopy(r.id, r.phone)}
                        className={cn(
                          "rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200",
                          copiedId === r.id && "text-emerald-400"
                        )}
                      >
                        {copiedId === r.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-end tabular-nums text-zinc-200">
                  {r.projectsCount}
                </td>
                <td className="px-3 py-2 text-end tabular-nums text-emerald-400">
                  {r.contractValue > 0
                    ? formatQar(r.contractValue, { locale })
                    : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-3 py-2 text-end tabular-nums text-sky-400">
                  {r.paidRevenue > 0
                    ? formatQar(r.paidRevenue, { locale })
                    : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {r.lastProjectTitle ? (
                    <div>
                      <div className="truncate text-zinc-200">{r.lastProjectTitle}</div>
                      <div className="text-[10px] text-zinc-600">
                        {formatDate(r.lastProjectAt as Date | null, locale)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-500 tabular-nums">
                  {formatDate(r.joinedAt as Date, locale)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-zinc-500">
                  {q ? t("clients.combobox.noResults") : t("clients.empty.title")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && <NewClientModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th
      className={cn(
        "px-3 py-2 font-medium",
        align === "end" ? "text-end" : "text-start"
      )}
    >
      {children}
    </th>
  );
}

function NewClientModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await createClientAction(formData);
      if (res.ok && res.id) {
        onClose();
        router.push(`/clients/${res.id}`);
        router.refresh();
      } else {
        setError(res.message ?? t("common.errorGeneric"));
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{t("clients.action.new")}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
            {error}
          </div>
        )}

        <form action={onSubmit} className="space-y-3">
          <Field label={`${t("clients.field.name")} *`}>
            <input
              name="name"
              required
              autoFocus
              placeholder={t("clients.field.namePlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <Field label={t("clients.field.brand")}>
            <input
              name="brandName"
              placeholder={t("clients.field.brandPlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <Field label={t("clients.field.phone")}>
            <input
              name="phone"
              dir="ltr"
              placeholder={t("clients.field.phonePlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <Field label={t("clients.field.email")}>
            <input
              name="email"
              type="email"
              dir="ltr"
              placeholder={t("clients.field.emailPlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <Field label={t("clients.field.notes")}>
            <textarea
              name="notes"
              rows={3}
              placeholder={t("clients.field.notesPlaceholder")}
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            >
              {t("action.cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {isPending ? t("action.creating") : t("clients.action.add")}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

```

---

## `app/clients/note-actions.ts`

**Lines:** 78

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireActiveUser, requirePermission } from "@/lib/auth-guards";
import { isOwner } from "@/lib/auth/roles";
import { safeString, MAX_LONG_TEXT } from "@/lib/input-limits";

interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

// ---------------------------------------------------------------------------
// Add a touchpoint entry to the client's communication log. Anyone with
// `clients:view` can post — that includes employees on the project — so the
// timeline reflects the whole team's outreach, not just leadership's. The
// author is captured from the active session for accountability.
// ---------------------------------------------------------------------------
export async function createClientNoteAction(
  clientId: string,
  formData: FormData
): Promise<ActionResult> {
  const user = await requirePermission("clients", "view");

  let content: string | null;
  try {
    content = safeString(formData.get("content"), MAX_LONG_TEXT);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  if (!content) return { ok: false, message: "الملاحظة فارغة" };

  // Make sure the client exists; otherwise we'd insert a dangling row.
  const exists = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!exists) return { ok: false, message: "العميل غير موجود" };

  const note = await prisma.clientNote.create({
    data: {
      clientId,
      content,
      createdById: user.id,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: note.id };
}

// ---------------------------------------------------------------------------
// Delete a single touchpoint. Allowed for the original author OR the Owner
// (admin). The detail page hides the delete button for everyone else, but
// the action enforces the rule again so a hand-crafted request can't bypass.
// ---------------------------------------------------------------------------
export async function deleteClientNoteAction(
  noteId: string
): Promise<ActionResult> {
  const user = await requireActiveUser();

  const note = await prisma.clientNote.findUnique({
    where: { id: noteId },
    select: { id: true, clientId: true, createdById: true },
  });
  if (!note) return { ok: false, message: "الملاحظة غير موجودة" };

  const isAuthor = note.createdById === user.id;
  if (!isAuthor && !isOwner(user.role)) {
    return { ok: false, message: "صلاحيات غير كافية" };
  }

  await prisma.clientNote.delete({ where: { id: noteId } });
  revalidatePath(`/clients/${note.clientId}`);
  return { ok: true, id: noteId };
}

```

---

## `app/clients/page.tsx`

**Lines:** 147

```tsx
// Clients (CRM) list page. Server-rendered: fetches every client + the
// aggregates the table needs (project counts, last project, total revenue),
// then hands the data to a client component that does live in-memory search
// and the "new client" modal. This keeps the bandwidth small (the list is
// capped at 1k rows for the foreseeable future) and avoids a second
// roundtrip on each keystroke.

import { UsersRound } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { hasPermission } from "@/lib/auth/permissions";
import { getUserOverrides } from "@/lib/db/permissions";
import { ClientsTable } from "./clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  const sessionUser = session?.user;
  if (!sessionUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-zinc-500">{t("admin.denied.desc")}</div>
      </div>
    );
  }

  const overrides = await getUserOverrides(sessionUser.id);
  const canView = hasPermission(sessionUser, "clients", "view", overrides);
  const canCreate = hasPermission(sessionUser, "clients", "create", overrides);

  if (!canView) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6 text-center">
          <div className="text-lg font-bold text-rose-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-sm text-zinc-400">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  const clients = await prisma.client.findMany({
    include: {
      projects: {
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          startedAt: true,
          budgetQar: true,
          billingType: true,
          transactions: {
            where: { kind: "income" },
            select: { amountQar: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Reduce the heavy nested objects to flat numbers / strings the client
  // component can sort + filter cheaply. We compute "last project", "joined",
  // and the active/finished status here (server) so the client never sees
  // raw transaction rows. Status is a pure derivation of project states —
  // never persisted, always recomputed from the source of truth.
  //
  // Two revenue numbers per client:
  //   - paidRevenue:    money actually collected (sum of income transactions
  //                     linked to the client's projects). Honest dollar figure
  //                     for finance reconciliation, but starts at 0 for any
  //                     project that hasn't had its first invoice recorded.
  //   - contractValue:  agreed budget across the client's projects (one-time
  //                     budgets stay as-is; monthly budgets count as the
  //                     monthly amount, since extending across N months would
  //                     be guesswork). Surfaces immediately when a project is
  //                     created — what the team usually means when asking
  //                     "how much is this client worth?".
  // The list page leads with contractValue so a fresh project shows real
  // numbers right away; paidRevenue is still available on the profile page
  // for the bookkeeping view.
  const rows = clients.map((c) => {
    const paidRevenue = c.projects.reduce(
      (sum, p) => sum + p.transactions.reduce((a, t) => a + t.amountQar, 0),
      0
    );
    const contractValue = c.projects.reduce((sum, p) => sum + p.budgetQar, 0);
    const last = c.projects[0];
    const first = c.projects[c.projects.length - 1];
    // "Active" = at least one project still in `active` state. Anything else
    // (only completed/cancelled, or no projects at all) is "finished".
    const isActive = c.projects.some((p) => p.status === "active");
    return {
      id: c.id,
      name: c.name,
      brandName: c.brandName,
      phone: c.phone,
      email: c.email,
      projectsCount: c.projects.length,
      paidRevenue,
      contractValue,
      lastProjectTitle: last?.title ?? null,
      lastProjectAt: (last?.createdAt ?? null) as Date | null,
      joinedAt: (first?.createdAt ?? c.createdAt) as Date,
      isActive,
    };
  });

  // Most recent activity first — uses the latest project createdAt when present,
  // otherwise the client's own updatedAt (already orderBy'd above).
  rows.sort((a, b) => {
    const aT = a.lastProjectAt?.getTime() ?? 0;
    const bT = b.lastProjectAt?.getTime() ?? 0;
    return bT - aT;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("page.clients.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {rows.length} {t("clients.count")} · {t("page.clients.subtitle")}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <UsersRound className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("clients.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">{t("clients.empty.desc")}</p>
          {canCreate && <ClientsTable rows={[]} canCreate={canCreate} locale={locale} emptyAddOnly />}
        </div>
      ) : (
        <ClientsTable rows={rows} canCreate={canCreate} locale={locale} />
      )}
    </div>
  );
}

```

---

## `app/finance/new-transaction-button.tsx`

**Lines:** 304

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createTransactionAction } from "./actions";
import { useT } from "@/lib/i18n/client";

interface ProjectLite {
  id: string;
  title: string;
}

// Categories that typically recur monthly.
const MONTHLY_DEFAULT = new Set(["salary", "overhead", "tool"]);

export function NewTransactionButton({ projects }: { projects: ProjectLite[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState<string>("project_payment");
  const [recurrence, setRecurrence] = useState<"none" | "monthly">("none");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // When kind changes, reset category to a sensible default.
  useEffect(() => {
    if (kind === "income") {
      setCategory("project_payment");
      setRecurrence("none");
    } else {
      setCategory("salary");
      setRecurrence("monthly");
    }
  }, [kind]);

  // When category changes, suggest recurrence.
  useEffect(() => {
    setRecurrence(MONTHLY_DEFAULT.has(category) ? "monthly" : "none");
  }, [category]);

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await createTransactionAction(formData);
      if (res.ok) {
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(res.message ?? t("common.error"));
      }
    });
  };

  const incomeCategories = [
    { value: "project_payment", label: t("txCategory.project_payment") },
    { value: "other", label: t("txCategory.other") },
  ];
  const expenseCategories = [
    { value: "salary", label: t("txCategory.salary") },
    { value: "bonus", label: t("txCategory.bonus") },
    { value: "tool", label: t("txCategory.tool") },
    { value: "ad", label: t("txCategory.ad") },
    { value: "freelance", label: t("txCategory.freelance") },
    { value: "overhead", label: t("txCategory.overhead") },
    { value: "refund", label: t("txCategory.refund") },
    { value: "other", label: t("txCategory.other") },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
      >
        <Plus className="h-4 w-4" />
        {t("action.newTransaction")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("finance.new.title")}</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
                {error}
              </div>
            )}

            <form ref={formRef} action={onSubmit} className="space-y-3">
              {/* Kind toggle */}
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">{t("finance.field.kind")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={cn(
                      "cursor-pointer rounded-md border px-3 py-2 text-center text-sm transition",
                      kind === "income"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value="income"
                      checked={kind === "income"}
                      onChange={() => setKind("income")}
                      className="sr-only"
                    />
                    💰 {t("tx.income")}
                  </label>
                  <label
                    className={cn(
                      "cursor-pointer rounded-md border px-3 py-2 text-center text-sm transition",
                      kind === "expense"
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                        : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value="expense"
                      checked={kind === "expense"}
                      onChange={() => setKind("expense")}
                      className="sr-only"
                    />
                    💸 {t("tx.expense")}
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("finance.field.category")}</label>
                <select
                  name="category"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  {(kind === "income" ? incomeCategories : expenseCategories).map(
                    (c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Recurrence */}
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">
                  {t("finance.field.recurrence")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={cn(
                      "cursor-pointer rounded-md border px-3 py-2 text-center text-sm transition",
                      recurrence === "none"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    <input
                      type="radio"
                      name="recurrence"
                      value="none"
                      checked={recurrence === "none"}
                      onChange={() => setRecurrence("none")}
                      className="sr-only"
                    />
                    {t("recurrence.none")}
                  </label>
                  <label
                    className={cn(
                      "cursor-pointer rounded-md border px-3 py-2 text-center text-sm transition",
                      recurrence === "monthly"
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                        : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    <input
                      type="radio"
                      name="recurrence"
                      value="monthly"
                      checked={recurrence === "monthly"}
                      onChange={() => setRecurrence("monthly")}
                      className="sr-only"
                    />
                    🔁 {t("recurrence.monthly")}
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  {t("finance.field.amount")} *
                </label>
                <input
                  name="amountQar"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="5000"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  {t("finance.field.occurredAt")}
                </label>
                <input
                  name="occurredAt"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>

              {recurrence === "monthly" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    {t("finance.field.recurrenceEnds")}
                  </label>
                  <input
                    name="recurrenceEndsAt"
                    type="date"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  {t("finance.field.project")}
                </label>
                <select
                  name="projectId"
                  defaultValue=""
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("finance.field.description")}</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder={t("finance.field.descPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  {t("action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {isPending ? t("action.saving") : t("action.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

```

---

## `app/globals.css`

**Lines:** 89

```css
@import "tailwindcss";

/* Theme variables — overridden at runtime by the admin on /admin/theme.
 * Defaults match Tailwind's emerald-500 / sky-500 palette. */
:root {
  --color-brand: #10b981;
  --color-brand-dim: rgba(16, 185, 129, 0.1);
  --color-brand-border: rgba(16, 185, 129, 0.3);
  --color-accent: #0ea5e9;
  --color-accent-dim: rgba(14, 165, 233, 0.1);
}

html {
  color-scheme: dark;
}

html,
body {
  background: #09090b;
  color: #fafafa;
}

/* Honour iOS safe-area-inset so notched phones don't hide content under the
 * status bar / Dynamic Island. Paired with viewport-fit=cover in layout.tsx. */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

body {
  font-family: var(--font-cairo), system-ui, sans-serif;
  font-feature-settings: "ss01", "cv11";
}

.tabular {
  font-variant-numeric: tabular-nums;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 5px;
}
::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}

/* ---------------------------------------------------------------------------
 * Mobile-first polish — kept in globals.css instead of Tailwind utility soup
 * so it applies everywhere (including third-party widgets like the kanban
 * board). Goals:
 *  1. No horizontal scroll surprise on phones.
 *  2. iOS doesn't auto-zoom inputs (font-size <16px triggers zoom).
 *  3. Tap targets meet the 44px iOS / 48px Android minimum.
 * ------------------------------------------------------------------------- */

html,
body {
  /* Stop the page from going wider than the viewport when a child uses
     long-running content (a code block, a wide table, etc.). Children that
     genuinely need to scroll should scope it to themselves with overflow-x. */
  overflow-x: hidden;
}

@media (max-width: 768px) {
  /* iOS Safari zooms when an input <16px is focused. Force a 16px floor on
     mobile so the page doesn't reflow under the keyboard. */
  input,
  select,
  textarea {
    font-size: 16px;
  }

  /* Tap-friendly minimum height for buttons and links inside main content
     areas. We exclude the bottom nav and sidebar (they manage their own size). */
  main button,
  main a[role="button"],
  main label[role="button"] {
    min-height: 44px;
  }
}

```

---

## `app/layout.tsx`

**Lines:** 122

```tsx
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { TopbarReal } from "@/components/topbar-real";
import { PendingGate } from "@/components/pending-gate";
import { MeetingReminder } from "@/components/meeting-reminder";
import { InvoiceReminder } from "@/components/invoice-reminder";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SRB — Internal Management",
  description: "SRB internal management system",
  manifest: "/manifest.json",
  applicationName: "SRB",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SRB",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
  // viewportFit=cover tells iOS to render under the notch/safe-area so we can
  // position the hamburger + drawer correctly via env(safe-area-inset-*).
  viewportFit: "cover" as const,
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale, settings] = await Promise.all([
    auth(),
    getLocale(),
    prisma.appSetting.findUnique({ where: { id: 1 } }).catch(() => null),
  ]);
  const user = session?.user;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isActive = user?.active === true;

  const brand = settings?.brandColor ?? "#10b981";
  const accent = settings?.accentColor ?? "#0ea5e9";
  const themeStyle: CSSProperties = {
    "--color-brand": brand,
    "--color-brand-dim": hexToRgba(brand, 0.1),
    "--color-brand-border": hexToRgba(brand, 0.3),
    "--color-accent": accent,
    "--color-accent-dim": hexToRgba(accent, 0.1),
  } as CSSProperties;

  return (
    <html lang={locale} dir={dir} className={cairo.variable} style={themeStyle}>
      <body className="min-h-dvh bg-zinc-950 text-zinc-50 antialiased">
        <LocaleProvider locale={locale}>
          {user ? (
            isActive ? (
              <div className="flex min-h-dvh">
                <Sidebar
                  userRole={user.role}
                  userName={user.name ?? user.email ?? "User"}
                  userEmail={user.email ?? ""}
                  logoPath={settings?.logoPath ?? "/srb-logo-white.png"}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <TopbarReal />
                  {/*
                    Bottom-nav clearance: pad the main scrolling area so the
                    last item isn't trapped under the 64px bottom-nav on
                    mobile. md: removes the padding once the sidebar takes
                    over.
                  */}
                  <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
                    {children}
                  </main>
                </div>
                {/* Mobile bottom nav — visible <md only. */}
                <MobileBottomNav role={user.role} />
                {/* Background reminder pollers — fire desktop notifications. */}
                <MeetingReminder />
                <InvoiceReminder />
              </div>
            ) : (
              <PendingGate
                userName={user.name ?? user.email ?? "User"}
                userEmail={user.email ?? ""}
                wasPreviouslyApproved={user.approved === true}
              />
            )
          ) : (
            children
          )}
        </LocaleProvider>
      </body>
    </html>
  );
}

```

---

## `app/notifications/mark-all-read-button.tsx`

**Lines:** 24

```tsx
"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markNotificationsReadAction } from "./actions";

export function MarkAllReadButton({ locale }: { locale: "ar" | "en" }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsReadAction();
        })
      }
      className="flex h-10 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-xs text-zinc-400 transition hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-50"
    >
      <CheckCheck className="h-3.5 w-3.5" />
      {locale === "ar" ? "وضع الكل كمقروء" : "Mark all read"}
    </button>
  );
}

```

---

## `app/notifications/page.tsx`

**Lines:** 129

```tsx
// Full-page notification inbox for the current user. The bell icon in the
// topbar is the quick-glance surface; this page is the destination for the
// mobile bottom-nav "إشعاراتي" tab and for the bell's "See all" link.

import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Bell, Inbox } from "lucide-react";
import { listForUser, unreadCount } from "@/lib/db/notifications";
import { getLocale } from "@/lib/i18n/server";
import { MarkAllReadButton } from "./mark-all-read-button";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, string> = {
  info: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  danger: "border-rose-500/30 bg-rose-500/5 text-rose-300",
};

export default async function NotificationsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const [items, unread] = await Promise.all([
    listForUser(userId, { limit: 100 }),
    unreadCount(userId),
  ]);

  const titleAr = "إشعاراتي";
  const titleEn = "Notifications";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bell className="h-6 w-6 text-zinc-500" />
            {locale === "ar" ? titleAr : titleEn}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {items.length}{" "}
            {locale === "ar" ? "إشعار" : "notifications"}
            {unread > 0 && (
              <>
                {" · "}
                <span className="text-amber-400">
                  {unread} {locale === "ar" ? "غير مقروء" : "unread"}
                </span>
              </>
            )}
          </p>
        </div>
        {unread > 0 && <MarkAllReadButton locale={locale} />}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Inbox className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">
            {locale === "ar" ? "ما فيه إشعارات بعد" : "No notifications yet"}
          </div>
          <p className="max-w-md text-xs text-zinc-500">
            {locale === "ar"
              ? "أي تنبيه جديد على مهامك أو مواعيدك يوصلك هنا."
              : "Alerts about your tasks, meetings, and schedule will appear here."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const tone = SEVERITY_TONE[n.severity] ?? SEVERITY_TONE.info;
            const isUnread = n.readAt === null;
            const Wrapper: React.FC<{ children: React.ReactNode }> = ({
              children,
            }) =>
              n.linkUrl ? (
                <Link href={n.linkUrl} className="block">
                  {children}
                </Link>
              ) : (
                <div>{children}</div>
              );

            return (
              <li key={n.id}>
                <Wrapper>
                  <div
                    className={cn(
                      "min-h-16 rounded-lg border p-3 transition",
                      tone,
                      isUnread
                        ? "shadow-[inset_2px_0_0_currentColor]"
                        : "opacity-70"
                    )}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold">{n.title}</div>
                      <time
                        className="text-[10px] text-zinc-500 tabular-nums"
                        dir="ltr"
                      >
                        {new Date(n.createdAt).toLocaleString(
                          locale === "ar" ? "en" : "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </time>
                    </div>
                    {n.body && (
                      <div className="text-xs text-zinc-300">{n.body}</div>
                    )}
                  </div>
                </Wrapper>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

```

---

## `app/page.tsx`

**Lines:** 461

```tsx
import Link from "next/link";
import {
  Briefcase,
  DollarSign,
  KanbanSquare,
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/cn";
import { getLocale } from "@/lib/i18n/server";
import { translate, type Locale } from "@/lib/i18n/dict";
import { BackupHealthWidget } from "@/components/backup-health-widget";
import { SmartInsightsPanel } from "@/components/smart-insights";
import { CreativeCommandCenter } from "@/components/creative-command-center";
import {
  isDeptLeadOrAbove,
  isManagerOrAbove,
  isOwner,
} from "@/lib/auth/roles";

const MS_30D = 30 * 24 * 60 * 60 * 1000;

export default async function OverviewPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const userName = session?.user?.name ?? t("overview.userFallback");
  const role = session?.user.role;
  // Money KPIs are owner-only — manager/dept_lead/employee never see them.
  const isAdmin = isOwner(role);
  const canManageUsers = isManagerOrAbove(role);
  const canRecordTx = isDeptLeadOrAbove(role);

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - MS_30D);

  // Non-admins don't see the money KPIs — skip those queries entirely.
  const [
    activeProjects,
    allTasks,
    openTasks,
    overdueTasks,
    teamSize,
    last30dIncome,
    last30dExpense,
    activeContractsAggregate,
  ] = await Promise.all([
    prisma.project.count({ where: { status: "active" } }),
    prisma.task.count(),
    prisma.task.count({
      where: { status: { in: ["todo", "in_progress", "in_review"] } },
    }),
    prisma.task.count({
      where: {
        status: { in: ["todo", "in_progress", "in_review"] },
        dueAt: { lt: now },
      },
    }),
    prisma.user.count({ where: { active: true } }),
    isAdmin
      ? prisma.transaction.aggregate({
          where: { kind: "income", occurredAt: { gte: thirtyAgo } },
          _sum: { amountQar: true },
        })
      : Promise.resolve({ _sum: { amountQar: 0 } as { amountQar: number | null } }),
    isAdmin
      ? prisma.transaction.aggregate({
          where: { kind: "expense", occurredAt: { gte: thirtyAgo } },
          _sum: { amountQar: true },
        })
      : Promise.resolve({ _sum: { amountQar: 0 } as { amountQar: number | null } }),
    // Active contracts value — sum of budgetQar across every project still in
    // `active` state. Computed live so a freshly added project bumps the
    // owner's portfolio number immediately, no transactions required. Owner-
    // only because budget data is sensitive pricing info.
    isAdmin
      ? prisma.project.aggregate({
          where: { status: "active" },
          _sum: { budgetQar: true },
        })
      : Promise.resolve({ _sum: { budgetQar: 0 } as { budgetQar: number | null } }),
  ]);

  const revenue = last30dIncome._sum.amountQar ?? 0;
  const expenses = last30dExpense._sum.amountQar ?? 0;
  const net = revenue - expenses;
  const activeContractsValue = activeContractsAggregate._sum.budgetQar ?? 0;
  const isEmpty = activeProjects === 0 && allTasks === 0 && teamSize <= 1;

  // ---------------------------------------------------------------------
  // Creative Command Center data — manager+ only. Owner and managers
  // share the same view; lower tiers don't see this panel because the
  // data spans every team.
  // ---------------------------------------------------------------------
  const showCommandCenter = isManagerOrAbove(role);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    urgentTaskRows,
    overdueTaskRows,
    upcomingShootRows,
    atRiskProjectRows,
  ] = showCommandCenter
    ? await Promise.all([
        prisma.task.findMany({
          where: {
            priority: "urgent",
            status: { in: ["todo", "in_progress", "in_review"] },
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 8,
          select: {
            id: true,
            title: true,
            dueAt: true,
            assignee: { select: { id: true, name: true } },
            project: { select: { id: true, title: true } },
          },
        }),
        prisma.task.findMany({
          where: {
            status: { in: ["todo", "in_progress", "in_review"] },
            dueAt: { lt: now },
          },
          orderBy: { dueAt: "asc" },
          take: 8,
          select: {
            id: true,
            title: true,
            dueAt: true,
            assignee: { select: { id: true, name: true } },
            project: { select: { id: true, title: true } },
          },
        }),
        prisma.photoShoot.findMany({
          where: {
            status: "scheduled",
            shootDate: { gte: now, lte: sevenDaysFromNow },
          },
          orderBy: { shootDate: "asc" },
          take: 8,
          select: {
            id: true,
            title: true,
            shootDate: true,
            location: true,
            status: true,
          },
        }),
        prisma.project.findMany({
          where: {
            status: "active",
            OR: [
              // Deadline within a week
              { deadlineAt: { gte: now, lte: sevenDaysFromNow } },
              // Deadline already passed but project still active
              { deadlineAt: { lt: now } },
            ],
          },
          orderBy: { deadlineAt: "asc" },
          take: 8,
          select: {
            id: true,
            title: true,
            deadlineAt: true,
            tasks: {
              where: {
                status: { in: ["todo", "in_progress", "in_review"] },
              },
              select: { id: true, dueAt: true },
            },
            brief: { select: { approvalStage: true } },
          },
        }),
      ])
    : [[], [], [], []];

  const overdueTasksWithDuration = overdueTaskRows.map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.dueAt,
    assignee: t.assignee,
    project: t.project,
    hoursOverdue: t.dueAt
      ? Math.max(0, (now.getTime() - t.dueAt.getTime()) / (60 * 60 * 1000))
      : 0,
  }));

  const atRiskWithCounts = atRiskProjectRows.map((p) => {
    const overdueTasks = p.tasks.filter(
      (t) => t.dueAt && t.dueAt.getTime() < now.getTime()
    ).length;
    const days = p.deadlineAt
      ? Math.ceil((p.deadlineAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    return {
      id: p.id,
      title: p.title,
      deadlineAt: p.deadlineAt,
      daysToDeadline: days,
      openTasks: p.tasks.length,
      overdueTasks,
      briefStage: p.brief?.approvalStage ?? "draft",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("page.overview.greeting")} {userName} 👋
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isEmpty
            ? t("page.overview.subtitleFresh")
            : t("page.overview.subtitle")}
        </p>
      </div>

      {/* KPI strip — money KPIs visible to admin only */}
      <div
        className={cn(
          "grid grid-cols-2 gap-4 sm:grid-cols-3",
          isAdmin ? "lg:grid-cols-7" : "lg:grid-cols-4"
        )}
      >
        <KpiCard
          label={t("kpi.activeProjects")}
          value={String(activeProjects)}
          icon={Briefcase}
        />
        <KpiCard
          label={t("kpi.openTasks")}
          value={String(openTasks)}
          sub={overdueTasks > 0 ? `${overdueTasks} ${t("tasks.overdue")}` : undefined}
          tone={overdueTasks > 0 ? "danger" : "default"}
          icon={KanbanSquare}
        />
        <KpiCard
          label={t("kpi.overdueTasks")}
          value={String(overdueTasks)}
          tone={overdueTasks > 0 ? "danger" : "default"}
          icon={KanbanSquare}
        />
        <KpiCard
          label={t("kpi.teamSize")}
          value={String(teamSize)}
          sub={t("common.activeEmployees")}
          icon={Users}
        />
        {isAdmin && (
          <>
            <KpiCard
              label={t("kpi.activeContracts")}
              value={formatQar(activeContractsValue, locale)}
              tone={activeContractsValue > 0 ? "positive" : "default"}
              sub={t("kpi.activeContractsSub")}
              icon={Briefcase}
            />
            <KpiCard
              label={t("kpi.revenue30")}
              value={formatQar(revenue, locale)}
              tone={revenue > 0 ? "positive" : "default"}
              icon={TrendingUp}
            />
            <KpiCard
              label={t("kpi.net30")}
              value={formatQar(net, locale, true)}
              tone={net > 0 ? "positive" : net < 0 ? "danger" : "default"}
              sub={`${t("common.expensesLabel")} ${formatQar(expenses, locale)}`}
              icon={DollarSign}
            />
          </>
        )}
      </div>

      {/* Smart Insights — visible to everyone but the content is role-aware
          (financial signals only show for owner). Computed server-side from
          live DB scans. */}
      <SmartInsightsPanel userRole={role} locale={locale} />

      {/* Creative Command Center — head+ only. Cross-department snapshot of
          the four risk vectors: urgent / overdue / upcoming shoots / at-risk
          projects. Hides itself when there's nothing to show. */}
      {showCommandCenter && (
        <CreativeCommandCenter
          urgentTasks={urgentTaskRows}
          overdueTasks={overdueTasksWithDuration}
          upcomingShoots={upcomingShootRows}
          atRiskProjects={atRiskWithCounts}
          locale={locale}
        />
      )}

      {isAdmin && <BackupHealthWidget locale={locale} />}

      {isEmpty && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              🚀
            </span>
            <h2 className="text-lg font-semibold text-zinc-100">
              {t("common.setupStart")}
            </h2>
          </div>
          <p className="mb-4 text-sm text-zinc-400">{t("common.setupDesc")}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SetupCard
              step={1}
              title={t("overview.setup.team.title")}
              description={t("overview.setup.team.desc")}
              href="/admin/users"
              cta={t("overview.setup.team.cta")}
              locale={locale}
            />
            <SetupCard
              step={2}
              title={t("overview.setup.project.title")}
              description={t("overview.setup.project.desc")}
              href="/projects"
              cta={t("overview.setup.project.cta")}
              locale={locale}
            />
            <SetupCard
              step={3}
              title={t("overview.setup.tasks.title")}
              description={t("overview.setup.tasks.desc")}
              href="/tasks"
              cta={t("overview.setup.tasks.cta")}
              locale={locale}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("common.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/projects" icon={Plus} label={t("action.newProject")} />
          <QuickAction href="/tasks" icon={Plus} label={t("action.newTask")} />
          {canRecordTx && (
            <QuickAction
              href="/finance"
              icon={DollarSign}
              label={t("action.recordTransaction")}
            />
          )}
          {canManageUsers && (
            <QuickAction
              href="/admin/users"
              icon={Users}
              label={t("action.addEmployee")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "danger"
      ? "text-rose-400"
      : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      <div className={cn("text-xl font-bold tabular-nums", toneClass)}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function SetupCard({
  step,
  title,
  description,
  href,
  cta,
  locale,
}: {
  step: number;
  title: string;
  description: string;
  href: string;
  cta: string;
  locale: Locale;
}) {
  const arrow = locale === "ar" ? "←" : "→";
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-900"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
          {step}
        </span>
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
      </div>
      <p className="text-[11px] text-zinc-500">{description}</p>
      <div className="mt-3 text-[11px] text-emerald-400 group-hover:text-emerald-300">
        {cta} {arrow}
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function formatQar(n: number, locale: Locale, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  const abs = Math.abs(Math.round(n));
  const currency = locale === "ar" ? "ر.ق" : "QAR";
  return `${n < 0 ? "−" : sign}${abs.toLocaleString("en")} ${currency}`;
}

```

---

## `app/projects/[id]/page.tsx`

**Lines:** 572

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  DollarSign,
  Users as UsersIcon,
} from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";
import {
  PRIORITY_COLOR,
  PROJECT_STATUS_COLOR,
  formatDate,
  formatQar,
  isOverdue,
} from "@/lib/db/helpers";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { isDeptLeadOrAbove, isOwner } from "@/lib/auth/roles";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { ProjectMembersManager } from "./members-manager";
import { ProjectActionsMenu } from "./project-actions-menu";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { InvoiceBadge } from "@/components/projects/invoice-badge";
import { ProjectPhases } from "@/components/projects/project-phases";
import { CreativeBrief } from "@/components/projects/creative-brief";
import { ProjectProfit } from "@/components/projects/project-profit";
import { PackageTracker } from "@/components/projects/package-tracker";
import { ProjectAssets } from "@/components/projects/project-assets";
import { ClientDeliveries } from "@/components/projects/client-deliveries";
import { ProjectFreelancers } from "@/components/projects/project-freelancers";
import { hasPermission } from "@/lib/auth/permissions";
import { getUserOverrides } from "@/lib/db/permissions";

export default async function ProjectDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const canManage = isDeptLeadOrAbove(session?.user.role);
  const viewer = session?.user
    ? { id: session.user.id, isOwner: isOwner(session.user.role) }
    : undefined;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      lead: { select: { id: true, name: true, email: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              jobTitle: true,
              department: true,
            },
          },
        },
      },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
          collaborators: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      },
      phases: {
        orderBy: { order: "asc" },
        include: {
          submittedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              dueAt: true,
              assignee: { select: { id: true, name: true } },
            },
            orderBy: [{ status: "asc" }, { dueAt: "asc" }],
          },
        },
      },
      brief: {
        include: {
          approvedBy: { select: { id: true, name: true } },
        },
      },
      package: true,
      assets: {
        include: {
          addedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      deliveries: {
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      freelancers: {
        include: {
          payments: {
            select: {
              id: true,
              amountQar: true,
              occurredAt: true,
              description: true,
            },
            orderBy: { occurredAt: "desc" },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!project) notFound();

  const [allUsers, allBadges] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobTitle: true,
        department: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.badge.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        labelAr: true,
        labelEn: true,
        icon: true,
        colorHex: true,
      },
    }),
  ]);

  const overdue = isOverdue(project.deadlineAt, project.status);
  const tasksOverdue = project.tasks.filter(
    (t) => t.dueAt && t.dueAt.getTime() < Date.now() && t.status !== "done"
  ).length;
  const tasksDone = project.tasks.filter((t) => t.status === "done").length;

  // Brief permission gates resolve overrides on top of role defaults.
  const userOverrides = session?.user
    ? await getUserOverrides(session.user.id)
    : [];
  const sessionUser = session?.user;
  const canEditBrief =
    !!sessionUser &&
    hasPermission(sessionUser, "brief", "edit", userOverrides);
  const canApproveBrief =
    !!sessionUser &&
    hasPermission(sessionUser, "brief", "approve", userOverrides);

  const canEditPackage =
    !!sessionUser &&
    hasPermission(sessionUser, "package", "edit", userOverrides);

  const canCreateAsset =
    !!sessionUser &&
    hasPermission(sessionUser, "assets", "create", userOverrides);
  const canDeleteAsset =
    !!sessionUser &&
    hasPermission(sessionUser, "assets", "delete", userOverrides);

  const canCreateDelivery =
    !!sessionUser &&
    hasPermission(sessionUser, "clientDelivery", "create", userOverrides);
  const canEditDelivery =
    !!sessionUser &&
    hasPermission(sessionUser, "clientDelivery", "edit", userOverrides);
  const canApproveDelivery =
    !!sessionUser &&
    hasPermission(sessionUser, "clientDelivery", "approve", userOverrides);
  const canDeleteDelivery =
    !!sessionUser &&
    hasPermission(sessionUser, "clientDelivery", "delete", userOverrides);

  const canViewFreelancers =
    !!sessionUser &&
    hasPermission(sessionUser, "freelancers", "view", userOverrides);
  const canCreateFreelancer =
    !!sessionUser &&
    hasPermission(sessionUser, "freelancers", "create", userOverrides);
  const canEditFreelancer =
    !!sessionUser &&
    hasPermission(sessionUser, "freelancers", "edit", userOverrides);
  const canApproveFreelancer =
    !!sessionUser &&
    hasPermission(sessionUser, "freelancers", "approve", userOverrides);
  const canDeleteFreelancer =
    !!sessionUser &&
    hasPermission(sessionUser, "freelancers", "delete", userOverrides);

  // Owner-only profit numbers — aggregate the project's transactions.
  const ownerView = isOwner(session?.user.role);
  let profitTotals: {
    income: number;
    expenses: number;
    net: number;
    marginPct: number | null;
    transactionCount: number;
  } | null = null;
  if (ownerView) {
    const txns = await prisma.transaction.findMany({
      where: { projectId: project.id },
      select: { kind: true, amountQar: true },
    });
    let income = 0;
    let expenses = 0;
    for (const tx of txns) {
      if (tx.kind === "income") income += tx.amountQar;
      else if (tx.kind === "expense") expenses += tx.amountQar;
    }
    const net = income - expenses;
    const marginPct = income > 0 ? (net / income) * 100 : null;
    profitTotals = {
      income,
      expenses,
      net,
      marginPct,
      transactionCount: txns.length,
    };
  }

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowRight className="h-3 w-3" />
        {t("projects.allProjects")}
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-emerald-400" />
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  PROJECT_STATUS_COLOR[project.status]
                )}
              >
                {t(`projectStatus.${project.status}`)}
              </span>
              <span className={cn("text-[11px]", PRIORITY_COLOR[project.priority])}>
                ● {t("projects.priorityPrefix")} {t(`priority.${project.priority}`)}
              </span>
              {project.type && (
                <span className="text-[11px] text-zinc-500">
                  {t(`projectType.${project.type}`)}
                </span>
              )}
              {project.billingType === "monthly" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
                  🔁 {t("billing.monthly")}
                </span>
              ) : (
                <span className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-500">
                  {t("billing.one_time")}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-zinc-100">{project.title}</h1>
            {project.client && (
              <div className="mt-1 text-sm text-zinc-400">
                {t("projects.field.client")}: {project.client.name}
              </div>
            )}
            {project.description && (
              <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                {project.description}
              </p>
            )}
          </div>
          {canManage && (
            <ProjectActionsMenu
              projectId={project.id}
              currentStatus={project.status}
              currentPriority={project.priority}
              currentTitle={project.title}
              currentBudget={project.budgetQar}
              currentDeadline={project.deadlineAt}
              currentProgress={project.progressPct}
              currentDescription={project.description}
              currentBillingType={project.billingType}
              currentBrandName={project.brandName}
              currentType={project.type}
            />
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3 md:grid-cols-4">
          <Stat
            icon={DollarSign}
            label={project.billingType === "monthly" ? t("projects.monthlyBudget") : t("projects.budget")}
            value={formatQar(project.budgetQar, { locale })}
            subtext={project.billingType === "monthly" ? t("projects.perMonthSubtext") : undefined}
          />
          <Stat
            icon={Calendar}
            label={t("projects.deadline")}
            value={formatDate(project.deadlineAt, locale)}
            tone={overdue ? "danger" : undefined}
          />
          <Stat
            icon={UsersIcon}
            label={t("kpi.teamSize")}
            value={`${project.members.length} ${t("common.activeEmployees")}`}
          />
          <Stat
            label={t("projects.progressLabel")}
            value={`${project.progressPct}%`}
            subtext={`${tasksDone}/${project.tasks.length} ${t("tasks.tasksCompletedShort")}`}
            tone={tasksOverdue > 0 ? "danger" : undefined}
          />
        </div>
        {tasksOverdue > 0 && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-xs text-rose-400">
            ⚠ {tasksOverdue} {t("projects.overdueTasksMsg")}
          </div>
        )}

        {project.billingType === "monthly" && project.nextInvoiceDueAt && (
          <div className="mt-3">
            <InvoiceBadge
              projectId={project.id}
              budgetQar={project.budgetQar}
              nextInvoiceDueAt={project.nextInvoiceDueAt}
              locale={locale}
              size="full"
            />
          </div>
        )}
      </div>

      {/* Owner-only project profit (computed from transactions). */}
      {ownerView && profitTotals && (
        <ProjectProfit
          totals={profitTotals}
          budgetQar={project.budgetQar}
          locale={locale}
        />
      )}

      {/* Creative brief — collapsible card. Anyone with brief:view can read,
          brief:edit can author, brief:approve can lock. */}
      <CreativeBrief
        projectId={project.id}
        brief={project.brief}
        canEdit={canEditBrief}
        canApprove={canApproveBrief}
        locale={locale}
      />

      {/* Package tracker — promised vs delivered counters per content type. */}
      <PackageTracker
        projectId={project.id}
        pkg={project.package}
        canEdit={canEditPackage}
        locale={locale}
      />

      {/* Moodboard / asset library — filterable grid of references and
          uploaded assets. */}
      <ProjectAssets
        projectId={project.id}
        assets={project.assets}
        canCreate={canCreateAsset}
        canDelete={canDeleteAsset}
        locale={locale}
      />

      {/* Client delivery tracking — internal log of what was sent, when the
          client viewed / requested changes / approved. */}
      <ClientDeliveries
        projectId={project.id}
        deliveries={project.deliveries}
        canCreate={canCreateDelivery}
        canEdit={canEditDelivery}
        canApprove={canApproveDelivery}
        canDelete={canDeleteDelivery}
        locale={locale}
      />

      {/* Project freelancers — per-project contractors paid out of the
          project's own budget. The "Record payment" action creates a
          Transaction (category=freelance) linked to both the project and
          the freelancer, so the project profit widget updates live. */}
      {canViewFreelancers && (
        <ProjectFreelancers
          projectId={project.id}
          freelancers={project.freelancers}
          canCreate={canCreateFreelancer}
          canEdit={canEditFreelancer}
          canApprove={canApproveFreelancer}
          canDelete={canDeleteFreelancer}
          locale={locale}
        />
      )}

      {/* Members */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("kpi.teamSize")} ({project.members.length})
          </h2>
          {canManage && (
            <ProjectMembersManager
              projectId={project.id}
              currentMembers={project.members.map((m) => ({
                userId: m.userId,
                role: m.role,
                user: m.user,
              }))}
              allUsers={allUsers}
            />
          )}
        </div>
        {project.members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
            {t("projects.noMembers")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {project.members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                  {m.user.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-100">{m.user.name}</div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {m.role ? m.role : m.user.jobTitle || m.user.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Phases */}
      <ProjectPhases
        projectId={project.id}
        canManage={canManage}
        isOwner={isOwner(session?.user.role)}
        viewerId={session?.user.id}
        phases={project.phases.map((p) => ({
          id: p.id,
          order: p.order,
          name: p.name,
          description: p.description,
          deadlineAt: p.deadlineAt,
          status: p.status,
          proofLinkUrl: p.proofLinkUrl,
          proofFileUrl: p.proofFileUrl,
          proofFileName: p.proofFileName,
          proofFileType: p.proofFileType,
          submittedAt: p.submittedAt,
          submittedBy: p.submittedBy,
          reviewNotes: p.reviewNotes,
          reviewedAt: p.reviewedAt,
          approvedBy: p.approvedBy,
          tasks: p.tasks,
        }))}
      />

      {/* Tasks Kanban */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("page.tasks.title")} ({project.tasks.length})
          </h2>
          <NewTaskButton
            users={allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
            badges={allBadges}
            defaultProjectId={project.id}
            label={t("projects.addTaskToProject")}
          />
        </div>
        {project.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
            {t("projects.noTasksYet")}
          </div>
        ) : (
          <KanbanBoard
            tasks={project.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              dueAt: t.dueAt,
              assignee: t.assignee,
              project: t.project,
              estimatedHours: t.estimatedHours,
              collaborators: t.collaborators,
              submissionUrl: t.submissionUrl,
              submissionFileUrl: t.submissionFileUrl,
              submissionFileName: t.submissionFileName,
              submissionFileType: t.submissionFileType,
              submissionNote: t.submissionNote,
              submittedAt: t.submittedAt,
              reviewNote: t.reviewNote,
              reviewedAt: t.reviewedAt,
            }))}
            users={allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
            viewer={viewer}
          />
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  subtext,
  tone,
}: {
  icon?: typeof Briefcase;
  label: string;
  value: string;
  subtext?: string;
  tone?: "danger";
}) {
  const color = tone === "danger" ? "text-rose-400" : "text-zinc-100";
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={cn("mt-1 text-sm font-semibold tabular-nums", color)}>
        {value}
      </div>
      {subtext && <div className="text-[10px] text-zinc-600">{subtext}</div>}
    </div>
  );
}

```

---

## `app/projects/[id]/project-actions-menu.tsx`

**Lines:** 278

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { MoreVertical, Settings2, Trash2, X } from "lucide-react";
import { deleteProjectAction, updateProjectAction } from "../actions";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

interface Props {
  projectId: string;
  currentStatus: string;
  currentPriority: string;
  currentTitle: string;
  currentBudget: number;
  currentDeadline: Date | null;
  currentProgress: number;
  currentDescription: string | null;
  currentBillingType: string;
  currentBrandName: string | null;
  currentType: string | null;
}

export function ProjectActionsMenu({
  projectId,
  currentStatus,
  currentPriority,
  currentTitle,
  currentBudget,
  currentDeadline,
  currentProgress,
  currentDescription,
  currentBillingType,
  currentBrandName,
  currentType,
}: Props) {
  const t = useT();
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const deadlineStr = currentDeadline
    ? new Date(currentDeadline).toISOString().slice(0, 10)
    : "";

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateProjectAction(projectId, formData);
        if (res.ok) setEditOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("common.error"));
      }
    });
  };

  const onDelete = () => {
    if (!confirm(t("projects.deleteConfirm"))) return;
    startTransition(async () => {
      await deleteProjectAction(projectId);
    });
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-md border border-zinc-700 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setEditOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-right text-xs text-zinc-300 hover:bg-zinc-800"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {t("projects.edit")}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-right text-xs text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("projects.delete")}
              </button>
            </div>
          </>
        )}
      </div>

      {editOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60"
          onClick={(e) => e.target === e.currentTarget && setEditOpen(false)}
        >
          <div
            className="flex min-h-full items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setEditOpen(false)}
          >
            <div className="my-4 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("projects.edit")}</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && (
              <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
                {error}
              </div>
            )}
            <form
              ref={formRef}
              action={onSubmit}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <Field label={t("projects.field.title")} full>
                <input
                  name="title"
                  defaultValue={currentTitle}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("projects.field.brand")}>
                <input
                  name="brandName"
                  defaultValue={currentBrandName ?? ""}
                  placeholder={t("projects.field.brandPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("projects.field.type")}>
                <select
                  name="type"
                  defaultValue={currentType ?? ""}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="video">{t("projectType.video")}</option>
                  <option value="photo">{t("projectType.photo")}</option>
                  <option value="event">{t("projectType.event")}</option>
                  <option value="digital_campaign">{t("projectType.digital_campaign")}</option>
                  <option value="web">{t("projectType.web")}</option>
                  <option value="design">{t("projectType.design")}</option>
                  <option value="branding">{t("projectType.branding")}</option>
                  <option value="other">{t("projectType.other")}</option>
                </select>
              </Field>
              <Field label={t("tasks.field.status")}>
                <select
                  name="status"
                  defaultValue={currentStatus}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="active">{t("projectStatus.active")}</option>
                  <option value="on_hold">{t("projectStatus.on_hold")}</option>
                  <option value="completed">{t("projectStatus.completed")}</option>
                  <option value="cancelled">{t("projectStatus.cancelled")}</option>
                </select>
              </Field>
              <Field label={t("projects.field.priority")}>
                <select
                  name="priority"
                  defaultValue={currentPriority}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="low">{t("priority.low")}</option>
                  <option value="normal">{t("priority.normal")}</option>
                  <option value="high">{t("priority.high")}</option>
                  <option value="urgent">{t("priority.urgent")}</option>
                </select>
              </Field>
              <Field label={t("projects.field.budget")}>
                <input
                  name="budgetQar"
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={currentBudget}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("projects.field.billingType")}>
                <select
                  name="billingType"
                  defaultValue={currentBillingType}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="one_time">{t("billing.one_time")}</option>
                  <option value="monthly">{t("billing.monthly")}</option>
                </select>
              </Field>
              <Field label={t("projects.field.deadline")}>
                <input
                  name="deadlineAt"
                  type="date"
                  defaultValue={deadlineStr}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={`${t("projects.progressLabel")} (${currentProgress}%)`} full>
                <input
                  name="progressPct"
                  type="range"
                  min="0"
                  max="100"
                  defaultValue={currentProgress}
                  className="w-full"
                />
              </Field>
              <Field label={t("projects.field.description")} full>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={currentDescription ?? ""}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <div className="flex items-center justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  {t("action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {isPending ? t("action.saving") : t("action.save")}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

```

---

## `app/projects/actions.ts`

**Lines:** 417

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { requireDeptLeadOrAbove } from "@/lib/auth-guards";
import {
  safeAmount,
  safeInt,
  safeString,
  MAX_LONG_TEXT,
  MAX_NAME_LEN,
  MAX_SHORT_TEXT,
  MAX_TITLE_LEN,
} from "@/lib/input-limits";
import {
  findTemplate,
  templatePhaseNames,
  type Locale as TemplateLocale,
} from "@/lib/projects/phase-templates";
import { findOrCreateClientByName } from "@/app/clients/actions";

export async function createProjectAction(formData: FormData) {
  const user = await requireDeptLeadOrAbove();

  let title: string | null;
  let clientName: string | null;
  let brandName: string | null;
  let clientPhone: string | null;
  let description: string | null;
  let budgetQar: number;
  try {
    title = safeString(formData.get("title"), MAX_TITLE_LEN);
    clientName = safeString(formData.get("clientName"), MAX_NAME_LEN);
    brandName = safeString(formData.get("brandName"), MAX_NAME_LEN);
    clientPhone = safeString(formData.get("clientPhone"), MAX_SHORT_TEXT);
    description = safeString(formData.get("description"), MAX_LONG_TEXT);
    budgetQar = safeAmount(formData.get("budgetQar"));
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const type = (formData.get("type") as string | null) || null;
  const priority = (formData.get("priority") as string | null) || "normal";
  const deadlineAtRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt = deadlineAtRaw ? new Date(deadlineAtRaw) : null;
  const leadId = (formData.get("leadId") as string | null) || null;
  const billingType = (formData.get("billingType") as string | null) || "one_time";
  const billingCycleDays = safeInt(formData.get("billingCycleDays"), 30, 1, 365);

  if (!title) {
    return { ok: false, message: "اسم المشروع مطلوب" };
  }
  if (!["one_time", "monthly"].includes(billingType)) {
    return { ok: false, message: "نوع التسعير غير صحيح" };
  }

  // Auto-link or auto-create the client. If the form supplied an existing
  // clientId (combobox pick), prefer that — it skips name normalization and
  // avoids duplicating "Aspire" because the user typed "aspire ".
  let clientId: string | null = null;
  const explicitClientId = (formData.get("clientId") as string | null) || null;
  if (explicitClientId) {
    const exists = await prisma.client.findUnique({
      where: { id: explicitClientId },
      select: { id: true },
    });
    clientId = exists?.id ?? null;
  }
  if (!clientId && clientName) {
    // Pass the supplied phone through so a brand-new client gets it stamped
    // on creation rather than being orphaned without contact info.
    const c = await findOrCreateClientByName(clientName, { phone: clientPhone });
    clientId = c?.id ?? null;
  }

  // Sync brand + phone onto the client. Both follow the same rule: only
  // fill if the client doesn't already have a value. Never overwrite —
  // the explicit way to change a client's brand or phone is on the
  // /clients/[id] form. This prevents project entry from accidentally
  // erasing the agency's CRM record when a typo happens in the form.
  if (clientId && (brandName || clientPhone)) {
    const existing = await prisma.client.findUnique({
      where: { id: clientId },
      select: { brandName: true, phone: true },
    });
    if (existing) {
      const updates: { brandName?: string; phone?: string } = {};
      if (brandName && !existing.brandName) updates.brandName = brandName;
      if (clientPhone && !existing.phone) updates.phone = clientPhone;
      if (Object.keys(updates).length > 0) {
        await prisma.client.update({ where: { id: clientId }, data: updates });
      }
    }
  }

  // For monthly projects, schedule the first invoice exactly one cycle after
  // the project is entered. Each subsequent cycle advances from the date the
  // invoice is actually recorded (see recordInvoiceAction).
  const now = new Date();
  const nextInvoiceDueAt =
    billingType === "monthly"
      ? new Date(now.getTime() + billingCycleDays * 24 * 60 * 60 * 1000)
      : null;

  const project = await prisma.project.create({
    data: {
      title,
      clientId,
      brandName,
      type,
      priority,
      budgetQar,
      deadlineAt,
      description,
      leadId: leadId || user.id,
      billingType,
      billingCycleDays,
      nextInvoiceDueAt,
    },
  });

  // If the user picked a starter phase template, seed the phases now.
  const templateKey = (formData.get("phaseTemplate") as string | null) || null;
  const localeRaw = (formData.get("locale") as string | null) || "ar";
  const tplLocale: TemplateLocale = localeRaw === "en" ? "en" : "ar";
  if (templateKey) {
    const tpl = findTemplate(templateKey);
    if (tpl) {
      const names = templatePhaseNames(tpl, tplLocale);
      await prisma.$transaction(
        names.map((name, idx) =>
          prisma.projectPhase.create({
            data: {
              projectId: project.id,
              name,
              order: idx + 1,
              status: idx === 0 ? "active" : "locked",
            },
          })
        )
      );
    }
  }

  // Automatically add the lead as a project member.
  if (project.leadId) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: project.id, userId: project.leadId },
      },
      create: {
        projectId: project.id,
        userId: project.leadId,
        role: "lead",
      },
      update: {},
    });
  }

  await logAudit({
    action: "project.create",
    target: { type: "project", id: project.id, label: project.title },
    metadata: {
      budgetQar: project.budgetQar,
      billingType,
      priority,
      type,
      ...(billingType === "monthly"
        ? { billingCycleDays, firstInvoiceAt: nextInvoiceDueAt?.toISOString() }
        : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true, id: project.id };
}

export async function updateProjectAction(id: string, formData: FormData) {
  await requireDeptLeadOrAbove();

  let title: string | null;
  let description: string | null | undefined;
  let brandName: string | null | undefined;
  let budgetQar: number | undefined;
  try {
    title = safeString(formData.get("title"), MAX_TITLE_LEN);
    const rawDescription = formData.get("description");
    description =
      rawDescription === null
        ? undefined
        : safeString(rawDescription, MAX_LONG_TEXT);
    const rawBrand = formData.get("brandName");
    brandName = rawBrand === null ? undefined : safeString(rawBrand, MAX_NAME_LEN);
    const budgetRaw = formData.get("budgetQar");
    budgetQar = budgetRaw === null ? undefined : safeAmount(budgetRaw);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "إدخال غير صحيح" };
  }
  const status = (formData.get("status") as string | null) || undefined;
  const priority = (formData.get("priority") as string | null) || undefined;
  const deadlineAtRaw = formData.get("deadlineAt") as string | null;
  const deadlineAt =
    deadlineAtRaw === null
      ? undefined
      : deadlineAtRaw === ""
      ? null
      : new Date(deadlineAtRaw);
  const progressRaw = formData.get("progressPct") as string | null;
  const progressPct = progressRaw ? parseInt(progressRaw) : undefined;
  const billingType = formData.get("billingType") as string | null;
  // `type` is one of the eight known values (or empty/—). We accept any
  // non-empty string so a future type added in the schema doesn't need a
  // code change here, but treat empty as "clear it".
  const typeRaw = formData.get("type");
  const typeUpdate: string | null | undefined =
    typeRaw === null ? undefined : typeRaw === "" ? null : String(typeRaw);

  const before = await prisma.project.findUnique({ where: { id } });

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(budgetQar !== undefined ? { budgetQar } : {}),
      ...(deadlineAt !== undefined ? { deadlineAt } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(brandName !== undefined ? { brandName } : {}),
      ...(typeUpdate !== undefined ? { type: typeUpdate } : {}),
      ...(progressPct !== undefined && !isNaN(progressPct)
        ? { progressPct: Math.max(0, Math.min(100, progressPct)) }
        : {}),
      ...(billingType && ["one_time", "monthly"].includes(billingType)
        ? { billingType }
        : {}),
      ...(status === "completed" ? { completedAt: new Date() } : {}),
    },
  });

  // Brand sync — if the user just set the project's brand AND the linked
  // client has no brand yet, propagate it to the client. Never overwrites.
  if (brandName && updated.clientId) {
    const c = await prisma.client.findUnique({
      where: { id: updated.clientId },
      select: { brandName: true },
    });
    if (c && !c.brandName) {
      await prisma.client.update({
        where: { id: updated.clientId },
        data: { brandName },
      });
    }
  }

  if (before && status && status !== before.status) {
    await logAudit({
      action: "project.status_change",
      target: { type: "project", id, label: updated.title },
      metadata: { from: before.status, to: status },
    });
  } else {
    await logAudit({
      action: "project.update",
      target: { type: "project", id, label: updated.title },
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProjectAction(id: string) {
  await requireDeptLeadOrAbove();
  const before = await prisma.project.findUnique({ where: { id } });
  await prisma.project.delete({ where: { id } });
  if (before) {
    await logAudit({
      action: "project.delete",
      target: { type: "project", id, label: before.title },
      metadata: { budgetQar: before.budgetQar, status: before.status },
    });
  }
  revalidatePath("/projects");
  redirect("/projects");
}

export async function addMemberAction(projectId: string, userId: string, role?: string) {
  await requireDeptLeadOrAbove();
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: role ?? null },
    update: { role: role ?? null },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeMemberAction(projectId: string, userId: string) {
  await requireDeptLeadOrAbove();
  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Monthly-invoice lifecycle
// ---------------------------------------------------------------------------

/**
 * Record this cycle's invoice as collected. Creates an income transaction using
 * the project's monthly budget, advances nextInvoiceDueAt by one cycle, and
 * clears this cycle's reminder flags so the next cycle fires fresh alerts.
 *
 * Permission: dept_lead+ only — recording invoices creates a financial
 * transaction, which is gated to the same tier as createTransactionAction.
 * (Previously this was open to any active user — a hole.)
 *
 * Idempotent enough that a double-click in the UI won't double-record — the
 * button disables itself during the transition.
 */
export async function recordInvoiceAction(projectId: string) {
  const user = await requireDeptLeadOrAbove();
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, message: "المشروع غير موجود" };
  if (project.billingType !== "monthly") {
    return { ok: false, message: "المشروع مو شهري" };
  }
  if (!project.budgetQar || project.budgetQar <= 0) {
    return { ok: false, message: "حدد مبلغ الفاتورة في الميزانية الشهرية" };
  }

  const now = new Date();
  // Next cycle anchors from what was due, not from now — that way a 2-day-late
  // collection doesn't shift the whole calendar 2 days forward.
  const anchor = project.nextInvoiceDueAt ?? now;
  const newDueAt = new Date(
    anchor.getTime() + project.billingCycleDays * 24 * 60 * 60 * 1000
  );

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        kind: "income",
        category: "project_payment",
        amountQar: project.budgetQar,
        description: `فاتورة شهرية · ${project.title}`,
        projectId: project.id,
        occurredAt: now,
        recurrence: "none",
        createdById: user.id,
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        lastInvoicedAt: now,
        nextInvoiceDueAt: newDueAt,
        invoiceReminderBeforeSentAt: null,
        invoiceReminderDueSentAt: null,
        invoiceReminderOverdueSentAt: null,
      },
    }),
  ]);

  await logAudit({
    action: "tx.create",
    target: {
      type: "project",
      id: project.id,
      label: `فاتورة شهرية: ${project.title}`,
    },
    metadata: {
      amountQar: project.budgetQar,
      dueAt: project.nextInvoiceDueAt?.toISOString(),
      nextDueAt: newDueAt.toISOString(),
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Mark a per-cycle reminder as fired so polling tabs don't double-alert.
 * `which`: "before" = 3 days before · "due" = day of · "overdue" = follow-up.
 *
 * Permission: dept_lead+ — marking invoice reminders ties into the financial
 * cycle (project budget visible on the project page), and we don't want
 * employees silencing reminders for projects they have no business with.
 * Owners/managers/dept_leads can mark; everyone else is rejected.
 */
export async function markInvoiceReminderSentAction(
  projectId: string,
  which: "before" | "due" | "overdue"
) {
  await requireDeptLeadOrAbove();
  const field =
    which === "before"
      ? "invoiceReminderBeforeSentAt"
      : which === "due"
      ? "invoiceReminderDueSentAt"
      : "invoiceReminderOverdueSentAt";
  await prisma.project.updateMany({
    where: { id: projectId, [field]: null },
    data: { [field]: new Date() },
  });
  return { ok: true };
}

```

---

## `app/projects/asset-actions.ts`

**Lines:** 107

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { saveUploadedFile, sanitizeLinkUrl } from "@/lib/uploads";

const KINDS = new Set(["moodboard", "reference", "brand", "deliverable", "other"]);

export async function addAssetAction(projectId: string, formData: FormData) {
  const actor = await requirePermission("assets", "create");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  const kindRaw = (formData.get("kind") as string | null) ?? "moodboard";
  const kind = KINDS.has(kindRaw) ? kindRaw : "moodboard";
  const title = (formData.get("title") as string | null)?.trim() || null;
  const caption = (formData.get("caption") as string | null)?.trim() || null;

  let fileUrl: string | null = null;
  let fileName: string | null = null;
  let fileType: string | null = null;

  const fileEntry = formData.get("file");
  if (fileEntry && typeof fileEntry !== "string") {
    const file = fileEntry as File;
    if (file.size > 0) {
      try {
        const saved = await saveUploadedFile(file, "assets");
        fileUrl = saved.url;
        fileName = saved.fileName;
        fileType = saved.fileType;
      } catch (err) {
        return {
          ok: false as const,
          message: err instanceof Error ? err.message : "فشل رفع الملف",
        };
      }
    }
  }

  let externalUrl: string | null = null;
  try {
    externalUrl = sanitizeLinkUrl(formData.get("externalUrl"));
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "رابط غير صحيح",
    };
  }

  if (!fileUrl && !externalUrl) {
    return {
      ok: false as const,
      message: "أرفق ملف أو رابط",
    };
  }

  await prisma.projectAsset.create({
    data: {
      projectId,
      kind,
      title,
      caption,
      fileUrl,
      fileName,
      fileType,
      externalUrl,
      addedById: actor.id,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: { surface: "assets", op: "add", kind },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function deleteAssetAction(assetId: string) {
  await requirePermission("assets", "delete");

  const asset = await prisma.projectAsset.findUnique({
    where: { id: assetId },
    select: { id: true, projectId: true, kind: true },
  });
  if (!asset) return { ok: false as const, message: "العنصر غير موجود" };

  await prisma.projectAsset.delete({ where: { id: assetId } });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: asset.projectId },
    metadata: { surface: "assets", op: "delete", kind: asset.kind },
  });

  revalidatePath(`/projects/${asset.projectId}`);
  return { ok: true as const };
}

```

---

## `app/projects/brief-actions.ts`

**Lines:** 91

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireActiveUser } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { upsertBrief } from "@/lib/db/brief";
import { prisma } from "@/lib/db/prisma";

function pickString(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function saveBriefAction(projectId: string, formData: FormData) {
  await requirePermission("brief", "edit");
  await requireActiveUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  await upsertBrief({
    projectId,
    patch: {
      objective: pickString(formData, "objective"),
      targetAudience: pickString(formData, "targetAudience"),
      styleNotes: pickString(formData, "styleNotes"),
      refs: pickString(formData, "refs"),
      deliverables: pickString(formData, "deliverables"),
      platforms: pickString(formData, "platforms"),
      sizes: pickString(formData, "sizes"),
      notes: pickString(formData, "notes"),
    },
  });

  // Brief edits aren't catastrophic but we still log them so the audit trail
  // captures who tweaked the brief on the eve of a delivery deadline.
  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: { surface: "brief" },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function setBriefStageAction(
  projectId: string,
  stage: "draft" | "pending_review" | "approved"
) {
  // Only brief:approve can flip to "approved". Anyone with brief:edit can
  // move between draft and pending_review.
  if (stage === "approved") {
    await requirePermission("brief", "approve");
  } else {
    await requirePermission("brief", "edit");
  }
  const actor = await requireActiveUser();

  const brief = await prisma.projectBrief.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!brief) {
    // Auto-create an empty draft so there's something to update.
    await upsertBrief({ projectId, patch: {} });
  }

  await prisma.projectBrief.update({
    where: { projectId },
    data: {
      approvalStage: stage,
      approvedById: stage === "approved" ? actor.id : null,
      approvedAt: stage === "approved" ? new Date() : null,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId },
    metadata: { surface: "brief", stage },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

```

---

## `app/projects/delivery-actions.ts`

**Lines:** 163

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { sanitizeLinkUrl } from "@/lib/uploads";
import { prisma } from "@/lib/db/prisma";

const DELIVERY_KINDS = new Set(["post", "reel", "video", "photo", "other"]);
const DELIVERY_STATUSES = new Set([
  "drafting",
  "sent",
  "viewed",
  "changes_requested",
  "approved",
]);

export async function createDeliveryAction(
  projectId: string,
  formData: FormData
) {
  const actor = await requirePermission("clientDelivery", "create");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) {
    return { ok: false as const, message: "العنوان مطلوب" };
  }
  const kindRaw = (formData.get("kind") as string | null) ?? "post";
  const kind = DELIVERY_KINDS.has(kindRaw) ? kindRaw : "post";

  let deliveryUrl: string | null = null;
  let previewUrl: string | null = null;
  try {
    deliveryUrl = sanitizeLinkUrl(formData.get("deliveryUrl"));
    previewUrl = sanitizeLinkUrl(formData.get("previewUrl"));
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "رابط غير صحيح",
    };
  }

  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const created = await prisma.clientDelivery.create({
    data: {
      projectId,
      title: title.slice(0, 200),
      kind,
      deliveryUrl,
      previewUrl,
      notes,
      createdById: actor.id,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: { surface: "delivery", op: "create", id: created.id },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function setDeliveryStatusAction(args: {
  deliveryId: string;
  status: string;
  feedback?: string | null;
}) {
  if (!DELIVERY_STATUSES.has(args.status)) {
    return { ok: false as const, message: "حالة غير صحيحة" };
  }
  const status = args.status as
    | "drafting"
    | "sent"
    | "viewed"
    | "changes_requested"
    | "approved";

  // Approving is its own permission; everything else just needs edit.
  if (status === "approved") {
    await requirePermission("clientDelivery", "approve");
  } else {
    await requirePermission("clientDelivery", "edit");
  }

  const delivery = await prisma.clientDelivery.findUnique({
    where: { id: args.deliveryId },
    select: { id: true, projectId: true, title: true, status: true },
  });
  if (!delivery) return { ok: false as const, message: "العنصر غير موجود" };

  const now = new Date();
  const data: Record<string, unknown> = { status };
  // Stamp the relevant timestamp on entry. Earlier timestamps are preserved
  // so we keep a record of when it FIRST hit each milestone.
  if (status === "sent") data.sentAt = now;
  if (status === "viewed") data.viewedAt = now;
  if (status === "changes_requested") {
    data.changesRequestedAt = now;
    if (args.feedback !== undefined) {
      data.clientFeedback = args.feedback?.trim() || null;
    }
  }
  if (status === "approved") data.approvedAt = now;

  await prisma.clientDelivery.update({
    where: { id: args.deliveryId },
    data,
  });

  await logAudit({
    action: "project.update",
    target: {
      type: "project",
      id: delivery.projectId,
      label: delivery.title,
    },
    metadata: {
      surface: "delivery",
      op: "status",
      id: delivery.id,
      from: delivery.status,
      to: status,
    },
  });

  revalidatePath(`/projects/${delivery.projectId}`);
  return { ok: true as const };
}

export async function deleteDeliveryAction(deliveryId: string) {
  await requirePermission("clientDelivery", "delete");

  const delivery = await prisma.clientDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, projectId: true, title: true },
  });
  if (!delivery) return { ok: false as const, message: "العنصر غير موجود" };

  await prisma.clientDelivery.delete({ where: { id: deliveryId } });

  await logAudit({
    action: "project.update",
    target: {
      type: "project",
      id: delivery.projectId,
      label: delivery.title,
    },
    metadata: { surface: "delivery", op: "delete", id: delivery.id },
  });

  revalidatePath(`/projects/${delivery.projectId}`);
  return { ok: true as const };
}

```

---

## `app/projects/freelancer-actions.ts`

**Lines:** 284

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { safeAmount, safeString, MAX_LONG_TEXT } from "@/lib/input-limits";

const VALID_ROLES = new Set([
  "photographer",
  "designer",
  "videographer",
  "editor",
  "sound",
  "writer",
  "developer",
  "other",
]);

const VALID_STATUSES = new Set(["active", "completed", "cancelled"]);

function pickRole(value: unknown): string {
  if (typeof value !== "string") return "other";
  const trimmed = value.trim().toLowerCase();
  return VALID_ROLES.has(trimmed) ? trimmed : "other";
}

export async function createFreelancerAction(
  projectId: string,
  formData: FormData
) {
  const actor = await requirePermission("freelancers", "create");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { ok: false as const, message: "اسم الفري لانسر مطلوب" };

  const role = pickRole(formData.get("role"));
  const phone = safeString(formData.get("phone"), 40) ?? null;
  const email = safeString(formData.get("email"), 200) ?? null;
  const paymentTerms = safeString(formData.get("paymentTerms"), MAX_LONG_TEXT) ?? null;
  const notes = safeString(formData.get("notes"), MAX_LONG_TEXT) ?? null;

  let agreedAmountQar = 0;
  try {
    const raw = formData.get("agreedAmountQar");
    if (raw && String(raw).trim() !== "") {
      agreedAmountQar = safeAmount(raw);
    }
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "مبلغ غير صحيح",
    };
  }

  const created = await prisma.projectFreelancer.create({
    data: {
      projectId,
      name: name.slice(0, 200),
      role,
      phone,
      email,
      agreedAmountQar,
      paymentTerms,
      notes,
      createdById: actor.id,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: {
      surface: "freelancers",
      op: "create",
      id: created.id,
      role,
      agreedAmountQar,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

export async function updateFreelancerAction(
  freelancerId: string,
  formData: FormData
) {
  await requirePermission("freelancers", "edit");

  const before = await prisma.projectFreelancer.findUnique({
    where: { id: freelancerId },
    select: { id: true, projectId: true, name: true },
  });
  if (!before) return { ok: false as const, message: "الفري لانسر غير موجود" };

  const name = (formData.get("name") as string | null)?.trim() || before.name;
  const role = pickRole(formData.get("role"));
  const phone = safeString(formData.get("phone"), 40) ?? null;
  const email = safeString(formData.get("email"), 200) ?? null;
  const paymentTerms = safeString(formData.get("paymentTerms"), MAX_LONG_TEXT) ?? null;
  const notes = safeString(formData.get("notes"), MAX_LONG_TEXT) ?? null;
  const statusRaw = (formData.get("status") as string | null) ?? "active";
  const status = VALID_STATUSES.has(statusRaw) ? statusRaw : "active";

  let agreedAmountQar = 0;
  try {
    const raw = formData.get("agreedAmountQar");
    if (raw && String(raw).trim() !== "") {
      agreedAmountQar = safeAmount(raw);
    }
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "مبلغ غير صحيح",
    };
  }

  await prisma.projectFreelancer.update({
    where: { id: freelancerId },
    data: {
      name: name.slice(0, 200),
      role,
      phone,
      email,
      agreedAmountQar,
      paymentTerms,
      notes,
      status,
    },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: before.projectId, label: before.name },
    metadata: { surface: "freelancers", op: "update", id: freelancerId, status },
  });

  revalidatePath(`/projects/${before.projectId}`);
  return { ok: true as const };
}

export async function deleteFreelancerAction(freelancerId: string) {
  await requirePermission("freelancers", "delete");

  const before = await prisma.projectFreelancer.findUnique({
    where: { id: freelancerId },
    include: { _count: { select: { payments: true } } },
  });
  if (!before) return { ok: false as const, message: "الفري لانسر غير موجود" };

  // If there are linked payments, prefer cancellation over deletion so the
  // financial trail stays intact. Owner can still hard-delete via Prisma if
  // truly needed; the UI nudges toward "cancel" in that case.
  if (before._count.payments > 0) {
    await prisma.projectFreelancer.update({
      where: { id: freelancerId },
      data: { status: "cancelled" },
    });
    await logAudit({
      action: "project.update",
      target: {
        type: "project",
        id: before.projectId,
        label: before.name,
      },
      metadata: {
        surface: "freelancers",
        op: "cancel_with_payments",
        id: freelancerId,
        paymentsCount: before._count.payments,
      },
    });
    revalidatePath(`/projects/${before.projectId}`);
    return {
      ok: true as const,
      cancelled: true,
      message: "تم تحويله لـ ملغي بدل الحذف لوجود دفعات مسجّلة",
    };
  }

  await prisma.projectFreelancer.delete({ where: { id: freelancerId } });
  await logAudit({
    action: "project.update",
    target: {
      type: "project",
      id: before.projectId,
      label: before.name,
    },
    metadata: { surface: "freelancers", op: "delete", id: freelancerId },
  });
  revalidatePath(`/projects/${before.projectId}`);
  return { ok: true as const };
}

/**
 * Record a payment to a freelancer. Creates a Transaction with category =
 * "freelance" linked to both the project and the freelancer, so the project
 * profit widget AND the freelancer's "paid so far" total update in one shot.
 *
 * Permission split:
 *   - `freelancers:approve` is required (this is the "money moves" gate).
 *   - dept_lead has create/edit but NOT approve, so they can hire and adjust
 *     terms but can't actually disburse — only manager+ can.
 */
export async function recordFreelancerPaymentAction(
  freelancerId: string,
  formData: FormData
) {
  const actor = await requirePermission("freelancers", "approve");

  const freelancer = await prisma.projectFreelancer.findUnique({
    where: { id: freelancerId },
    select: { id: true, name: true, role: true, projectId: true },
  });
  if (!freelancer) return { ok: false as const, message: "الفري لانسر غير موجود" };

  let amount: number;
  try {
    amount = safeAmount(formData.get("amountQar"));
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "مبلغ غير صحيح",
    };
  }
  if (amount <= 0) {
    return { ok: false as const, message: "المبلغ لازم يكون موجب" };
  }

  const occurredAtRaw = formData.get("occurredAt") as string | null;
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return { ok: false as const, message: "تاريخ غير صحيح" };
  }

  const userDescription = safeString(formData.get("description"), MAX_LONG_TEXT);
  const description =
    userDescription ??
    `دفعة لـ ${freelancer.name} (${freelancer.role}) — مشروع`;

  const tx = await prisma.transaction.create({
    data: {
      kind: "expense",
      category: "freelance",
      amountQar: amount,
      description,
      projectId: freelancer.projectId,
      freelancerId: freelancer.id,
      occurredAt,
      recurrence: "none",
      createdById: actor.id,
    },
  });

  await logAudit({
    action: "tx.create",
    target: {
      type: "transaction",
      id: tx.id,
      label: `−${amount.toLocaleString("en")} · freelance · ${freelancer.name}`,
    },
    metadata: {
      kind: "expense",
      category: "freelance",
      amountQar: amount,
      projectId: freelancer.projectId,
      freelancerId: freelancer.id,
      surface: "freelancers",
    },
  });

  revalidatePath(`/projects/${freelancer.projectId}`);
  revalidatePath("/finance");
  revalidatePath("/");
  return { ok: true as const };
}

```

---

## `app/projects/new-project-button.tsx`

**Lines:** 313

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createProjectAction } from "./actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { PHASE_TEMPLATES } from "@/lib/projects/phase-templates";
import { ClientCombobox } from "@/components/projects/client-combobox";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function NewProjectButton({ users }: { users: User[] }) {
  const t = useT();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [billingType, setBillingType] = useState<"one_time" | "monthly">("one_time");
  const [templateKey, setTemplateKey] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const onSubmit = (formData: FormData) => {
    setError(null);
    formData.set("locale", locale);
    if (templateKey) formData.set("phaseTemplate", templateKey);
    else formData.delete("phaseTemplate");
    startTransition(async () => {
      const res = await createProjectAction(formData);
      if (res.ok && res.id) {
        setOpen(false);
        formRef.current?.reset();
        setBillingType("one_time");
        setTemplateKey("");
        router.push(`/projects/${res.id}`);
      } else {
        setError(res.message ?? t("common.errorGeneric"));
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
      >
        <Plus className="h-4 w-4" />
        {t("action.newProject")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="flex min-h-full items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="my-4 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("projects.new.title")}</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
                {error}
              </div>
            )}

            <form
              ref={formRef}
              action={onSubmit}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <Field label={t("projects.field.title")} full>
                <input
                  name="title"
                  required
                  placeholder={t("projects.field.titlePlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("projects.field.client")}>
                <ClientCombobox
                  placeholder={t("projects.field.clientPlaceholder")}
                />
              </Field>
              <Field label={t("projects.field.brand")}>
                <input
                  name="brandName"
                  placeholder={t("projects.field.brandPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("projects.field.clientPhone")}>
                <input
                  name="clientPhone"
                  dir="ltr"
                  placeholder={t("projects.field.clientPhonePlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("projects.field.type")}>
                <select
                  name="type"
                  defaultValue=""
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="video">{t("projectType.video")}</option>
                  <option value="photo">{t("projectType.photo")}</option>
                  <option value="event">{t("projectType.event")}</option>
                  <option value="digital_campaign">{t("projectType.digital_campaign")}</option>
                  <option value="web">{t("projectType.web")}</option>
                  <option value="design">{t("projectType.design")}</option>
                  <option value="branding">{t("projectType.branding")}</option>
                  <option value="other">{t("projectType.other")}</option>
                </select>
              </Field>
              <Field label={t("projects.field.priority")}>
                <select
                  name="priority"
                  defaultValue="normal"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="low">{t("priority.low")}</option>
                  <option value="normal">{t("priority.normal")}</option>
                  <option value="high">{t("priority.high")}</option>
                  <option value="urgent">{t("priority.urgent")}</option>
                </select>
              </Field>
              <Field label={t("projects.field.billingType")} full>
                <div className="grid grid-cols-2 gap-2">
                  <label className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm has-[:checked]:border-emerald-500/40 has-[:checked]:bg-emerald-500/10 has-[:checked]:text-emerald-400">
                    <input
                      type="radio"
                      name="billingType"
                      value="one_time"
                      defaultChecked
                      onChange={() => setBillingType("one_time")}
                      className="ml-2 accent-emerald-500"
                    />
                    {t("billing.one_time")}
                  </label>
                  <label className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm has-[:checked]:border-emerald-500/40 has-[:checked]:bg-emerald-500/10 has-[:checked]:text-emerald-400">
                    <input
                      type="radio"
                      name="billingType"
                      value="monthly"
                      onChange={() => setBillingType("monthly")}
                      className="ml-2 accent-emerald-500"
                    />
                    {t("billing.monthly")}
                  </label>
                </div>
              </Field>
              {billingType === "monthly" && (
                <Field label={t("projects.field.billingCycleDays")} full>
                  <div className="flex items-center gap-2">
                    <input
                      name="billingCycleDays"
                      type="number"
                      min={1}
                      max={365}
                      defaultValue={30}
                      className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-500">
                      {t("projects.field.billingCycleHint")}
                    </span>
                  </div>
                </Field>
              )}
              <Field label={t("projects.field.budget")}>
                <input
                  name="budgetQar"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="50000"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("projects.field.deadline")}>
                <input
                  name="deadlineAt"
                  type="date"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("projects.field.lead")} full>
                <select
                  name="leadId"
                  defaultValue=""
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">{t("tasks.unassigned")}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("projects.field.description")} full>
                <textarea
                  name="description"
                  rows={3}
                  placeholder={t("projects.field.descPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <Field label={t("phases.startFromTemplate")} full>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setTemplateKey("")}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-xs transition",
                      templateKey === ""
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-emerald-500/30"
                    )}
                  >
                    {t("phases.template.none")}
                  </button>
                  {PHASE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => setTemplateKey(tpl.key)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs transition",
                        templateKey === tpl.key
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                          : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-emerald-500/30"
                      )}
                    >
                      {locale === "en" ? tpl.labelEn : tpl.labelAr}
                    </button>
                  ))}
                </div>
                {templateKey && (
                  <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-2 text-[11px] text-zinc-500">
                    <ul className="space-y-0.5">
                      {(PHASE_TEMPLATES.find((x) => x.key === templateKey)?.phases ?? [])
                        .map((p, i) => (
                          <li key={i}>
                            {i + 1}. {locale === "en" ? p.en : p.ar}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </Field>

              <div className="flex items-center justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  {t("action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {isPending ? t("action.creating") : t("projects.create")}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

```

---

## `app/projects/package-actions.ts`

**Lines:** 109

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";

const TARGET_FIELDS = [
  "targetPosts",
  "targetReels",
  "targetVideos",
  "targetShoots",
  "targetStories",
] as const;
const COMPLETED_FIELDS = [
  "completedPosts",
  "completedReels",
  "completedVideos",
  "completedShoots",
  "completedStories",
] as const;

const ALL_FIELDS = [...TARGET_FIELDS, ...COMPLETED_FIELDS];
type PackageField = (typeof ALL_FIELDS)[number];

function clampInt(n: unknown): number {
  const num = typeof n === "string" ? Number(n) : typeof n === "number" ? n : NaN;
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(9999, Math.round(num)));
}

/**
 * Replace the project's package counters wholesale. Used by the "Save package"
 * form on the project page. We upsert because most projects start without a
 * package row.
 */
export async function savePackageAction(projectId: string, formData: FormData) {
  await requirePermission("package", "edit");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, message: "المشروع غير موجود" };

  const data: Partial<Record<PackageField, number>> = {};
  for (const field of ALL_FIELDS) {
    data[field] = clampInt(formData.get(field));
  }
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  await prisma.projectPackage.upsert({
    where: { projectId },
    create: { projectId, notes, ...data },
    update: { notes, ...data },
  });

  await logAudit({
    action: "project.update",
    target: { type: "project", id: projectId, label: project.title },
    metadata: { surface: "package" },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

/**
 * Quick-increment a single completed counter. Lets the project lead bump
 * "completedPosts" from 3 to 4 without opening the edit form. We never
 * decrement past 0.
 */
export async function bumpPackageCompletedAction(args: {
  projectId: string;
  field: string; // one of the completed* fields
  delta: number; // +1 or -1
}) {
  await requirePermission("package", "edit");

  if (!(COMPLETED_FIELDS as readonly string[]).includes(args.field)) {
    return { ok: false as const, message: "حقل غير صحيح" };
  }
  const field = args.field as (typeof COMPLETED_FIELDS)[number];
  const delta = args.delta === 1 ? 1 : args.delta === -1 ? -1 : 0;
  if (delta === 0) return { ok: false as const, message: "delta غير صحيح" };

  // Read → clamp → write inside a transaction so concurrent bumps don't race.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.projectPackage.findUnique({
      where: { projectId: args.projectId },
    });
    const current = existing?.[field] ?? 0;
    const next = Math.max(0, current + delta);
    if (existing) {
      await tx.projectPackage.update({
        where: { projectId: args.projectId },
        data: { [field]: next },
      });
    } else if (delta > 0) {
      // First-ever bump auto-creates the row.
      await tx.projectPackage.create({
        data: { projectId: args.projectId, [field]: next },
      });
    }
  });

  revalidatePath(`/projects/${args.projectId}`);
  return { ok: true as const };
}

```

---

## `app/shoots/[id]/call-sheet/client-print-button.tsx`

**Lines:** 16

```tsx
"use client";

import { Printer } from "lucide-react";

export function ClientPrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs text-zinc-100 transition hover:bg-zinc-800"
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

```

---

## `app/shoots/[id]/call-sheet/page.tsx`

**Lines:** 301

```tsx
// Print-friendly call sheet for a photo shoot. Standalone page (no sidebar /
// topbar / mobile nav) so the user can hit Cmd/Ctrl+P and print straight to
// PDF or paper. Crew gets all the info they need on-site at a glance.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/server";
import { isDeptLeadOrAbove } from "@/lib/auth/roles";
import { ClientPrintButton } from "./client-print-button";

export const dynamic = "force-dynamic";

export default async function CallSheetPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const isAr = locale === "ar";
  if (!session?.user) redirect("/login");
  if (!isDeptLeadOrAbove(session.user.role)) {
    return (
      <div className="p-12 text-center">
        <h1 className="text-lg font-bold text-rose-400">
          {isAr ? "صلاحيات غير كافية" : "Permission denied"}
        </h1>
      </div>
    );
  }

  const shoot = await prisma.photoShoot.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true, client: { select: { name: true } } } },
      crew: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              jobTitle: true,
              phone: true,
              email: true,
            },
          },
        },
      },
      equipment: {
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
              category: true,
              brand: true,
              model: true,
              serialNumber: true,
            },
          },
        },
      },
    },
  });
  if (!shoot) notFound();

  const dateLabel = new Date(shoot.shootDate).toLocaleString(isAr ? "en" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = new Date(
    shoot.shootDate.getTime() + shoot.durationHours * 60 * 60 * 1000
  ).toLocaleString(isAr ? "en" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="min-h-dvh bg-white text-zinc-900 print:bg-white" dir={isAr ? "rtl" : "ltr"}>
      {/* Toolbar — hidden on print */}
      <div className="border-b border-zinc-300 bg-zinc-100 p-3 print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link
            href={`/shoots/${id}`}
            className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
          >
            <ArrowRight className="h-3 w-3" />
            {isAr ? "ارجع للجلسة" : "Back to shoot"}
          </Link>
          <PrintButton labelAr="اطبع / احفظ PDF" labelEn="Print / Save PDF" isAr={isAr} />
        </div>
      </div>

      {/* The actual call sheet */}
      <article className="mx-auto max-w-3xl space-y-4 p-6 text-[12px] leading-relaxed">
        <header className="border-b-2 border-zinc-900 pb-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold">{shoot.title}</h1>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              {isAr ? "كول شيت — SRB" : "Call sheet — SRB"}
            </div>
          </div>
          {shoot.project && (
            <div className="mt-1 text-sm text-zinc-600">
              {isAr ? "المشروع" : "Project"}: <strong>{shoot.project.title}</strong>
              {shoot.project.client && ` · ${shoot.project.client.name}`}
            </div>
          )}
        </header>

        <Row labelAr="الوقت" labelEn="Time" isAr={isAr}>
          <strong>{dateLabel}</strong>
          {" → "}
          {endTime}
          {" · "}
          {shoot.durationHours}h
        </Row>

        <Row labelAr="الموقع" labelEn="Location" isAr={isAr}>
          <div>
            <div className="font-semibold">{shoot.location}</div>
            {shoot.locationNotes && (
              <div className="text-zinc-700">{shoot.locationNotes}</div>
            )}
            {shoot.mapUrl && (
              <a
                href={shoot.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-700 underline print:no-underline"
              >
                {shoot.mapUrl}
              </a>
            )}
          </div>
        </Row>

        {shoot.clientContact && (
          <Row labelAr="الاتصال في الموقع" labelEn="On-site contact" isAr={isAr}>
            {shoot.clientContact}
          </Row>
        )}

        <section>
          <h2 className="mb-1 border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
            {isAr ? "الفريق" : "Crew"} ({shoot.crew.length})
          </h2>
          {shoot.crew.length === 0 ? (
            <p className="text-zinc-500">
              {isAr ? "ما تم إسناد فريق بعد" : "No crew assigned yet"}
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-1 text-start">{isAr ? "الاسم" : "Name"}</th>
                  <th className="py-1 text-start">{isAr ? "الدور" : "Role"}</th>
                  <th className="py-1 text-start">{isAr ? "الهاتف" : "Phone"}</th>
                </tr>
              </thead>
              <tbody>
                {shoot.crew.map((c) => (
                  <tr key={c.userId} className="border-t border-zinc-200">
                    <td className="py-1 font-medium">{c.user.name}</td>
                    <td className="py-1 text-zinc-700">
                      {c.role ?? c.user.jobTitle ?? "—"}
                    </td>
                    <td className="py-1 text-zinc-700 tabular-nums" dir="ltr">
                      {c.user.phone ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="mb-1 border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
            {isAr ? "المعدات" : "Equipment"} ({shoot.equipment.length})
          </h2>
          {shoot.equipment.length === 0 ? (
            <p className="text-zinc-500">
              {isAr ? "ما تم حجز معدات" : "No equipment reserved"}
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-1 text-start">{isAr ? "العنصر" : "Item"}</th>
                  <th className="py-1 text-start">{isAr ? "الفئة" : "Category"}</th>
                  <th className="py-1 text-start">{isAr ? "الرقم التسلسلي" : "Serial"}</th>
                </tr>
              </thead>
              <tbody>
                {shoot.equipment.map((e) => (
                  <tr key={e.equipmentId} className="border-t border-zinc-200">
                    <td className="py-1 font-medium">
                      {e.equipment.brand
                        ? `${e.equipment.brand} ${e.equipment.model ?? ""}`.trim()
                        : e.equipment.name}
                    </td>
                    <td className="py-1 text-zinc-700">
                      {e.equipment.category}
                    </td>
                    <td className="py-1 text-zinc-700 tabular-nums" dir="ltr">
                      {e.equipment.serialNumber ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {shoot.shotList && (
          <section>
            <h2 className="mb-1 border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
              {isAr ? "قائمة اللقطات / البريف" : "Shot list / brief"}
            </h2>
            <div className="whitespace-pre-wrap text-[11px] text-zinc-800">
              {shoot.shotList}
            </div>
          </section>
        )}

        {shoot.referenceUrl && (
          <Row labelAr="مرجع" labelEn="Reference" isAr={isAr}>
            <a
              href={shoot.referenceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline print:no-underline"
            >
              {shoot.referenceUrl}
            </a>
          </Row>
        )}

        {shoot.notes && (
          <section>
            <h2 className="mb-1 border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
              {isAr ? "ملاحظات" : "Notes"}
            </h2>
            <div className="whitespace-pre-wrap text-[11px] text-zinc-800">
              {shoot.notes}
            </div>
          </section>
        )}

        <footer className="mt-6 border-t border-zinc-300 pt-2 text-[9px] text-zinc-500">
          {isAr
            ? "تم التوليد بواسطة نظام SRB الداخلي · "
            : "Generated by SRB Internal · "}
          {new Date().toLocaleString("en-US")}
        </footer>
      </article>
    </div>
  );
}

function Row({
  labelAr,
  labelEn,
  isAr,
  children,
}: {
  labelAr: string;
  labelEn: string;
  isAr: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 border-b border-zinc-200 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {isAr ? labelAr : labelEn}
      </div>
      <div className="text-[12px] text-zinc-900">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client island — the toolbar's "Print" button needs window.print().
// ---------------------------------------------------------------------------
function PrintButton({
  labelAr,
  labelEn,
  isAr,
}: {
  labelAr: string;
  labelEn: string;
  isAr: boolean;
}) {
  return <ClientPrintButton label={isAr ? labelAr : labelEn} />;
}

```

---

## `app/shoots/[id]/page.tsx`

**Lines:** 597

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Clock,
  MapPin,
  Users,
  Package,
  ExternalLink,
  Briefcase,
  FileText,
  Phone,
  Calendar as CalIcon,
  Download,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";
import { ShootActions } from "../shoot-actions";
import { isDeptLeadOrAbove } from "@/lib/auth/roles";

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-zinc-700/40 text-zinc-400 border-zinc-700",
  postponed: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const CONDITION_STYLE: Record<string, string> = {
  new: "text-emerald-400",
  good: "text-sky-400",
  fair: "text-amber-400",
  needs_repair: "text-orange-400",
  broken: "text-rose-400",
};

/**
 * Turn a Google Maps URL into an embeddable iframe src.
 *
 * Strategy:
 *   1. If the user pasted a maps.app.goo.gl short link OR a maps.google.com
 *      URL with explicit lat/lng, we embed THAT — preserves the exact pin
 *      they shared.
 *   2. Otherwise we fall back to a search query of the text location, which
 *      always works without a Google API key.
 *
 * `output=embed` is the public, key-less embed mode — same one Google's own
 * "Share → Embed a map" dialog generates.
 */
function buildMapEmbed(rawLocation: string, mapUrl: string | null): string {
  // 1. Pin-preserving path — explicit short link or coords URL.
  if (mapUrl) {
    try {
      const u = new URL(mapUrl);
      // Short link from the Google Maps mobile share sheet — can't be parsed
      // for coords, but the embed iframe will follow the redirect and show
      // the pinned location.
      if (
        u.hostname === "maps.app.goo.gl" ||
        u.hostname === "goo.gl" ||
        u.hostname === "g.co"
      ) {
        return `https://www.google.com/maps?q=${encodeURIComponent(mapUrl)}&output=embed`;
      }
      // Already an embed URL — pass through.
      if (u.searchParams.get("output") === "embed") {
        return mapUrl;
      }
      // Standard maps.google.com URL with q= or @lat,lng.
      if (u.hostname.endsWith("google.com") && u.pathname.startsWith("/maps")) {
        const q = u.searchParams.get("q");
        if (q) return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
        const atMatch = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (atMatch) {
          return `https://www.google.com/maps?q=${atMatch[1]},${atMatch[2]}&output=embed`;
        }
      }
    } catch {
      // mapUrl wasn't a parseable URL — fall through to text search
    }
  }

  // 2. Text-search fallback — always renders something useful.
  const q = encodeURIComponent(rawLocation);
  return `https://www.google.com/maps?q=${q}&output=embed`;
}

export default async function ShootDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const user = session?.user;
  if (!user) return null;
  const canManage = isDeptLeadOrAbove(user.role);

  const shoot = await prisma.photoShoot.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true } },
      crew: {
        include: {
          user: {
            select: { id: true, name: true, email: true, jobTitle: true, role: true },
          },
        },
      },
      equipment: {
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
              category: true,
              brand: true,
              model: true,
              condition: true,
            },
          },
        },
      },
    },
  });

  if (!shoot) notFound();

  const now = new Date();
  const msUntil = shoot.shootDate.getTime() - now.getTime();
  const isUpcoming = shoot.status === "scheduled" && msUntil > 0;
  const isToday =
    shoot.shootDate.getDate() === now.getDate() &&
    shoot.shootDate.getMonth() === now.getMonth() &&
    shoot.shootDate.getFullYear() === now.getFullYear();

  const [users, projects, equipment] = canManage
    ? await Promise.all([
        prisma.user.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.project.findMany({
          where: { status: { in: ["active", "on_hold"] } },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
        }),
        prisma.equipment.findMany({
          select: { id: true, name: true, category: true },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        }),
      ])
    : [[], [], []];

  const mapSrc = buildMapEmbed(shoot.location, shoot.mapUrl);
  const endsAt = new Date(
    shoot.shootDate.getTime() + shoot.durationHours * 3600_000
  );

  return (
    <div className="space-y-5">
      <Link
        href="/shoots"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowRight className="h-3 w-3" />
        {t("shoots.backToAll")}
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Camera
                className="h-4 w-4"
                style={{ color: "var(--color-brand)" }}
              />
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  STATUS_STYLE[shoot.status] ?? "border-zinc-700 text-zinc-400"
                )}
              >
                {t(`shoots.status.${shoot.status}`)}
              </span>
              {isToday && isUpcoming && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  ⚡ {t("shoots.today")}
                </span>
              )}
              {shoot.project && (
                <Link
                  href={`/projects/${shoot.project.id}`}
                  className="flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-sky-400 hover:bg-zinc-800"
                >
                  <Briefcase className="h-2.5 w-2.5" />
                  {shoot.project.title}
                </Link>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-zinc-100">
              {shoot.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/shoots/${shoot.id}/ics`}
              download={`shoot-${shoot.id}.ics`}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5" />
              {t("shoots.addToCalendar")}
            </a>
            {/* Generate a print-friendly call sheet — opens in a new tab so the
                user can hit Cmd/Ctrl+P and save as PDF or print straight to
                paper for the crew. */}
            <Link
              href={`/shoots/${shoot.id}/call-sheet`}
              target="_blank"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-300 hover:border-emerald-400/50"
            >
              <FileText className="h-3.5 w-3.5" />
              {locale === "ar" ? "كول شيت" : "Call sheet"}
            </Link>
            {canManage && (
              <ShootActions
                shoot={{
                  id: shoot.id,
                  title: shoot.title,
                  projectId: shoot.projectId,
                  shootDate: shoot.shootDate,
                  durationHours: shoot.durationHours,
                  location: shoot.location,
                  locationNotes: shoot.locationNotes,
                  mapUrl: shoot.mapUrl,
                  clientContact: shoot.clientContact,
                  shotList: shoot.shotList,
                  referenceUrl: shoot.referenceUrl,
                  notes: shoot.notes,
                  status: shoot.status,
                  crew: shoot.crew.map((c) => ({
                    user: { id: c.user.id, name: c.user.name },
                  })),
                  equipment: shoot.equipment.map((e) => ({
                    equipment: {
                      id: e.equipment.id,
                      name: e.equipment.name,
                      category: e.equipment.category,
                    },
                  })),
                }}
                users={users}
                projects={projects}
                equipment={equipment}
              />
            )}
          </div>
        </div>

        {/* Key stats row */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-800 pt-4 md:grid-cols-3">
          <InfoBlock
            icon={CalIcon}
            label={t("shoots.field.date")}
            primary={shoot.shootDate.toLocaleString(
              locale === "en" ? "en-US" : "en",
              {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }
            )}
            secondary={`⏱ ${shoot.durationHours}${t(
              "shoots.hoursShort"
            )} · ${t("shoots.endsAt")} ${endsAt.toLocaleTimeString(
              locale === "en" ? "en-US" : "en",
              { hour: "2-digit", minute: "2-digit", hour12: true }
            )}`}
          />
          <InfoBlock
            icon={Users}
            label={t("shoots.field.crew")}
            primary={`${shoot.crew.length} ${t("shoots.crewCount")}`}
            secondary={
              shoot.crew.length > 0
                ? shoot.crew.map((c) => c.user.name).join(" · ")
                : t("shoots.noCrew")
            }
          />
          <InfoBlock
            icon={Package}
            label={t("shoots.field.equipment")}
            primary={`${shoot.equipment.length} ${t("shoots.itemsCount")}`}
            secondary={
              shoot.equipment.length > 0
                ? shoot.equipment.map((e) => e.equipment.name).join(" · ")
                : t("shoots.noEquipment")
            }
          />
        </div>
      </div>

      {/* Location + Map */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <MapPin
                className="h-4 w-4"
                style={{ color: "var(--color-brand)" }}
              />
              {t("shoots.field.location")}
            </div>
            <div className="text-lg font-semibold text-zinc-100">
              {shoot.location}
            </div>
            {shoot.locationNotes && (
              <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
                📍 {shoot.locationNotes}
              </div>
            )}
            {shoot.clientContact && (
              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
                <Phone
                  className="h-3 w-3"
                  style={{ color: "var(--color-accent)" }}
                />
                {shoot.clientContact}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {shoot.mapUrl && (
                <a
                  href={shoot.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:opacity-90"
                  style={{ background: "var(--color-brand)" }}
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("shoots.openInMaps")}
                </a>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  shoot.location
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                <MapPin className="h-3 w-3" />
                {t("shoots.getDirections")}
              </a>
            </div>
          </div>
        </div>

        {/* Embedded map — uses text location as search query (works without an API key) */}
        <div className="lg:col-span-3">
          <div className="h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <iframe
              title="Map"
              src={mapSrc}
              className="h-full min-h-[240px] w-full"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>

      {/* Crew detail */}
      {shoot.crew.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Users
              className="h-4 w-4"
              style={{ color: "var(--color-brand)" }}
            />
            {t("shoots.field.crew")} · {shoot.crew.length}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shoot.crew.map((c) => (
              <Link
                key={c.user.id}
                href={`/team/${c.user.id}`}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                  {c.user.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-100">
                    {c.user.name}
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {c.user.jobTitle ?? t(`role.${c.user.role}`)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Equipment detail */}
      {shoot.equipment.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Package
              className="h-4 w-4"
              style={{ color: "var(--color-brand)" }}
            />
            {t("shoots.field.equipment")} · {shoot.equipment.length}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shoot.equipment.map((e) => (
              <div
                key={e.equipment.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-100">
                      {e.equipment.name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      {[e.equipment.brand, e.equipment.model]
                        .filter(Boolean)
                        .join(" · ") || t(`equipment.category.${e.equipment.category}`)}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[10px]",
                      CONDITION_STYLE[e.equipment.condition] ?? "text-zinc-500"
                    )}
                  >
                    {t(`equipment.condition.${e.equipment.condition}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shot list */}
      {shoot.shotList && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <FileText
              className="h-4 w-4"
              style={{ color: "var(--color-brand)" }}
            />
            {t("shoots.field.shotList")}
          </div>
          <div className="whitespace-pre-wrap text-sm text-zinc-300">
            {shoot.shotList}
          </div>
        </section>
      )}

      {/* Reference */}
      {shoot.referenceUrl && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-2 text-sm font-semibold text-zinc-200">
            {t("shoots.openReference")}
          </div>
          <a
            href={shoot.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: "var(--color-accent)" }}
          >
            <ExternalLink className="h-4 w-4" />
            {shoot.referenceUrl}
          </a>
        </section>
      )}

      {/* Notes */}
      {shoot.notes && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-2 text-sm font-semibold text-zinc-200">
            {t("shoots.field.notes")}
          </div>
          <div className="whitespace-pre-wrap text-sm text-zinc-300">
            {shoot.notes}
          </div>
        </section>
      )}

      {/* Reminder status */}
      {shoot.status === "scheduled" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 text-sm font-semibold text-zinc-200">
            {t("shoots.reminders.title")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReminderStatus
              label={t("shoots.reminders.dayBefore")}
              sentAt={shoot.reminderDayBeforeSentAt}
              t={t}
              locale={locale}
            />
            <ReminderStatus
              label={t("shoots.reminders.hourBefore")}
              sentAt={shoot.reminderHourBeforeSentAt}
              t={t}
              locale={locale}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  primary,
  secondary,
}: {
  icon: typeof Clock;
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{primary}</div>
      {secondary && (
        <div className="mt-0.5 text-[11px] text-zinc-500">{secondary}</div>
      )}
    </div>
  );
}

function ReminderStatus({
  label,
  sentAt,
  t,
  locale,
}: {
  label: string;
  sentAt: Date | null;
  t: (k: string) => string;
  locale: "ar" | "en";
}) {
  if (sentAt) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-emerald-300">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="text-xs font-semibold">{label}</div>
          <div className="text-[11px] opacity-80">
            {t("shoots.reminders.sentAt")}{" "}
            {new Date(sentAt).toLocaleString(
              locale === "en" ? "en-US" : "en",
              { hour: "2-digit", minute: "2-digit", hour12: true, day: "numeric", month: "short" }
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-400">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-[11px] text-zinc-500">
          {t("shoots.reminders.pending")}
        </div>
      </div>
    </div>
  );
}

```

---

## `components/creative-command-center.tsx`

**Lines:** 324

```tsx
// Creative Command Center — at-a-glance ops panel for owner / manager / head.
// Shows: urgent tasks, overdue tasks, upcoming shoots (next 7 days), and
// at-risk projects (deadline within a week or already overdue).
//
// Pure presentation. The page that renders it computes the rows server-side
// from Prisma so it ships zero extra client JS.

import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Camera,
  Flame,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/db/helpers";

interface UrgentTask {
  id: string;
  title: string;
  dueAt: Date | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; title: string } | null;
}

interface OverdueTask {
  id: string;
  title: string;
  dueAt: Date | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; title: string } | null;
  hoursOverdue: number;
}

interface UpcomingShoot {
  id: string;
  title: string;
  shootDate: Date;
  location: string;
  status: string;
}

interface AtRiskProject {
  id: string;
  title: string;
  deadlineAt: Date | null;
  daysToDeadline: number;
  openTasks: number;
  overdueTasks: number;
  briefStage: string;
}

interface Props {
  urgentTasks: UrgentTask[];
  overdueTasks: OverdueTask[];
  upcomingShoots: UpcomingShoot[];
  atRiskProjects: AtRiskProject[];
  locale: "ar" | "en";
}

export function CreativeCommandCenter({
  urgentTasks,
  overdueTasks,
  upcomingShoots,
  atRiskProjects,
  locale,
}: Props) {
  const isAr = locale === "ar";

  const empty =
    urgentTasks.length === 0 &&
    overdueTasks.length === 0 &&
    upcomingShoots.length === 0 &&
    atRiskProjects.length === 0;

  if (empty) return null;

  return (
    <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-violet-300" />
          <h2 className="text-sm font-semibold text-violet-200">
            {isAr ? "مركز القيادة الإبداعي" : "Creative Command Center"}
          </h2>
        </div>
        <span className="text-[10px] text-violet-300/70">
          {isAr
            ? "نظرة سريعة على ما يحتاج اهتمامك الآن"
            : "What needs your attention right now"}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* Urgent */}
        <Card
          icon={Flame}
          tone="rose"
          title={isAr ? "عاجل" : "Urgent"}
          count={urgentTasks.length}
        >
          {urgentTasks.length === 0 ? (
            <Empty isAr={isAr} kind="urgent" />
          ) : (
            <ul className="space-y-1.5">
              {urgentTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link
                    href={t.project ? `/projects/${t.project.id}` : "/tasks"}
                    className="block rounded-md border border-rose-500/20 bg-rose-500/5 p-2 text-[11px] hover:border-rose-400/40"
                  >
                    <div className="line-clamp-1 font-medium text-zinc-100">
                      {t.title}
                    </div>
                    <div className="line-clamp-1 text-[10px] text-zinc-500">
                      {t.assignee?.name ?? (isAr ? "غير مُسنَدة" : "Unassigned")}
                      {t.project && ` · ${t.project.title}`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Overdue */}
        <Card
          icon={AlertTriangle}
          tone="amber"
          title={isAr ? "متأخّرة" : "Overdue"}
          count={overdueTasks.length}
        >
          {overdueTasks.length === 0 ? (
            <Empty isAr={isAr} kind="overdue" />
          ) : (
            <ul className="space-y-1.5">
              {overdueTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link
                    href={t.project ? `/projects/${t.project.id}` : "/tasks"}
                    className="block rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] hover:border-amber-400/40"
                  >
                    <div className="line-clamp-1 font-medium text-zinc-100">
                      {t.title}
                    </div>
                    <div className="text-[10px] text-amber-300/80 tabular-nums">
                      {isAr
                        ? `متأخّر ${formatDuration(t.hoursOverdue, "ar")}`
                        : `${formatDuration(t.hoursOverdue, "en")} overdue`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming shoots */}
        <Card
          icon={Camera}
          tone="sky"
          title={isAr ? "تصوير قريب" : "Upcoming shoots"}
          count={upcomingShoots.length}
        >
          {upcomingShoots.length === 0 ? (
            <Empty isAr={isAr} kind="shoots" />
          ) : (
            <ul className="space-y-1.5">
              {upcomingShoots.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/shoots/${s.id}`}
                    className="block rounded-md border border-sky-500/20 bg-sky-500/5 p-2 text-[11px] hover:border-sky-400/40"
                  >
                    <div className="line-clamp-1 font-medium text-zinc-100">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      <Calendar className="me-0.5 inline h-2.5 w-2.5" />
                      {formatDate(s.shootDate, locale)} · {s.location}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* At risk */}
        <Card
          icon={Briefcase}
          tone="emerald"
          title={isAr ? "مشاريع تحت المراقبة" : "Projects at risk"}
          count={atRiskProjects.length}
        >
          {atRiskProjects.length === 0 ? (
            <Empty isAr={isAr} kind="risk" />
          ) : (
            <ul className="space-y-1.5">
              {atRiskProjects.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className={cn(
                      "block rounded-md border p-2 text-[11px]",
                      p.daysToDeadline < 0
                        ? "border-rose-500/30 bg-rose-500/5 hover:border-rose-400/50"
                        : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/40"
                    )}
                  >
                    <div className="line-clamp-1 font-medium text-zinc-100">
                      {p.title}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {p.daysToDeadline < 0
                        ? isAr
                          ? `تجاوز الموعد بـ ${Math.abs(p.daysToDeadline)} يوم`
                          : `${Math.abs(p.daysToDeadline)}d past deadline`
                        : isAr
                        ? `${p.daysToDeadline} يوم متبقي · ${p.overdueTasks} مهمة متأخّرة`
                        : `${p.daysToDeadline}d left · ${p.overdueTasks} overdue tasks`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

function Card({
  icon: Icon,
  tone,
  title,
  count,
  children,
}: {
  icon: typeof Flame;
  tone: "rose" | "amber" | "sky" | "emerald";
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const toneStyles: Record<string, { border: string; chip: string; head: string }> = {
    rose: {
      border: "border-rose-500/30",
      chip: "bg-rose-500/10 text-rose-300",
      head: "text-rose-200",
    },
    amber: {
      border: "border-amber-500/30",
      chip: "bg-amber-500/10 text-amber-300",
      head: "text-amber-200",
    },
    sky: {
      border: "border-sky-500/30",
      chip: "bg-sky-500/10 text-sky-300",
      head: "text-sky-200",
    },
    emerald: {
      border: "border-emerald-500/30",
      chip: "bg-emerald-500/10 text-emerald-300",
      head: "text-emerald-200",
    },
  };
  const style = toneStyles[tone];
  return (
    <div className={cn("rounded-lg border bg-zinc-900/40 p-3", style.border)}>
      <div className="mb-2 flex items-center justify-between">
        <div className={cn("flex items-center gap-1.5 text-[11px] font-semibold", style.head)}>
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
            style.chip
          )}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function Empty({
  isAr,
  kind,
}: {
  isAr: boolean;
  kind: "urgent" | "overdue" | "shoots" | "risk";
}) {
  const ar: Record<string, string> = {
    urgent: "ما فيه شي عاجل ✓",
    overdue: "ما فيه متأخر ✓",
    shoots: "ما فيه تصوير هذا الأسبوع",
    risk: "كل المشاريع على المسار ✓",
  };
  const en: Record<string, string> = {
    urgent: "Nothing urgent ✓",
    overdue: "Nothing overdue ✓",
    shoots: "No shoots this week",
    risk: "All projects on track ✓",
  };
  return (
    <div className="rounded-md border border-dashed border-zinc-800 px-2 py-3 text-center text-[10px] text-zinc-600">
      {(isAr ? ar : en)[kind]}
    </div>
  );
}

function formatDuration(hours: number, locale: "ar" | "en"): string {
  if (hours < 24) {
    return locale === "ar" ? `${Math.round(hours)} ساعة` : `${Math.round(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  return locale === "ar" ? `${days} يوم` : `${days}d`;
}

```

---

## `components/mobile-bottom-nav.tsx`

**Lines:** 130

```tsx
"use client";

// Mobile bottom navigation — shown ONLY below md (≥768px the sidebar takes
// over). The 4 tabs match the simplified employee surface called for in the
// internal-OS spec: مهامي · جدولي · إشعاراتي · الرئيسية. Higher-tier roles
// see the same 4 quick tabs PLUS a "More" button that opens the full
// sidebar drawer (the drawer is implemented in components/sidebar.tsx — we
// don't duplicate it; we only forward the open-state via a custom event).
//
// Why a separate component instead of folding into <Sidebar/>?
// - Sidebar is a full-height drawer; bottom-nav is a 64px-tall persistent
//   bar. Different layout primitives, different lifecycles.
// - The bar must stay above safe-area-inset-bottom on iOS, which is easier
//   to manage in isolation.
// - Sidebar is already large; splitting keeps each file < 300 lines.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Calendar, Home, KanbanSquare, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { type Role } from "@/lib/auth/roles";

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof Home;
}

// 4 tabs is the iOS / Material guideline maximum before tabs become hard to
// hit. We keep these identical for every role so muscle memory works no
// matter who's signed in. Higher roles get the "More" trigger as a 5th item.
const TABS: NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: Home },
  { href: "/tasks", labelKey: "bottomNav.myTasks", icon: KanbanSquare },
  { href: "/shoots", labelKey: "bottomNav.mySchedule", icon: Calendar },
  { href: "/notifications", labelKey: "bottomNav.notifications", icon: Bell },
];

interface Props {
  role: Role;
}

function dispatchOpenDrawer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("srb:open-mobile-nav"));
}

export function MobileBottomNav({ role }: Props) {
  const onOpenDrawer = dispatchOpenDrawer;
  const pathname = usePathname();
  const t = useT();

  // Only employees see the strict 4-tab view. Everyone else gets a 5th
  // "More" button that pops the sidebar drawer for full nav (admin pages,
  // finance, projects, etc). This way the bottom nav still gives muscle
  // memory for the common 4 actions without hiding power-user routes.
  const showDrawerButton = role !== "employee";

  const items: { kind: "link" | "drawer"; item?: NavItem }[] = TABS.map(
    (item) => ({ kind: "link" as const, item })
  );
  if (showDrawerButton) {
    items.push({ kind: "drawer" as const });
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden",
        // safe-area: iPhone home-indicator clearance
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <ul
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((entry) => {
          if (entry.kind === "drawer") {
            return (
              <li key="drawer">
                <button
                  type="button"
                  onClick={onOpenDrawer}
                  className="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[10px] text-zinc-400 transition active:bg-zinc-900"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                  <span>{t("bottomNav.more")}</span>
                </button>
              </li>
            );
          }

          const item = entry.item!;
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[10px] transition active:bg-zinc-900",
                  active ? "text-zinc-100" : "text-zinc-400"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn("h-5 w-5", active && "drop-shadow-[0_0_4px_currentColor]")}
                  style={active ? { color: "var(--color-brand)" } : undefined}
                />
                <span style={active ? { color: "var(--color-brand)" } : undefined}>
                  {t(item.labelKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

```

---

## `components/projects/client-combobox.tsx`

**Lines:** 213

```tsx
"use client";

// Client combobox — replaces the free-text "client name" input on the
// new-project form. Live-searches /api/clients/search as the user types,
// dedupes against the existing client roster, and surfaces an explicit
// "➕ add new client" option when nothing matches. Picking an existing
// row sets the hidden `clientId`; picking the add-new option falls
// through to `clientName` so the server can auto-create on save.

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

interface ClientResult {
  id: string;
  name: string;
  phone: string | null;
  projectsCount: number;
}

interface Props {
  // Names of the hidden form fields submitted with the surrounding <form>.
  // The new-project action prefers `clientId` when present, falls back to
  // `clientName` otherwise.
  idFieldName?: string;
  nameFieldName?: string;
  placeholder?: string;
  defaultName?: string;
  defaultId?: string;
}

export function ClientCombobox({
  idFieldName = "clientId",
  nameFieldName = "clientName",
  placeholder,
  defaultName = "",
  defaultId = "",
}: Props) {
  const t = useT();
  const [query, setQuery] = useState(defaultName);
  const [selectedId, setSelectedId] = useState<string>(defaultId);
  const [selectedName, setSelectedName] = useState<string>(defaultName);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced fetch — 150 ms is enough to coalesce typing without feeling
  // sluggish, and avoids hammering the API at 60+ req/s while typing.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/clients/search?q=${encodeURIComponent(query)}&limit=8`,
          { signal: ctrl.signal }
        );
        if (!res.ok) return;
        const json = (await res.json()) as { ok: boolean; results: ClientResult[] };
        if (json.ok) setResults(json.results);
      } catch {
        // ignored — likely an aborted request
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [query, open]);

  const trimmed = query.trim();
  const exactMatch = results.find(
    (r) => r.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  const showAddNew = trimmed.length > 0 && !exactMatch;

  const onPick = (r: ClientResult) => {
    setSelectedId(r.id);
    setSelectedName(r.name);
    setQuery(r.name);
    setOpen(false);
  };

  const onAddNew = () => {
    setSelectedId("");
    setSelectedName(trimmed);
    setQuery(trimmed);
    setOpen(false);
  };

  const onClear = () => {
    setSelectedId("");
    setSelectedName("");
    setQuery("");
    setOpen(true);
  };

  const onChangeQuery = (v: string) => {
    setQuery(v);
    // Typing invalidates the previous selection — the user is searching again.
    if (selectedId) setSelectedId("");
    setOpen(true);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={idFieldName} value={selectedId} />
      <input type="hidden" name={nameFieldName} value={selectedName || query} />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 start-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 ps-9 pe-9 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
        />
        {(query || selectedId) && (
          <button
            type="button"
            onClick={onClear}
            title={t("clients.combobox.clear")}
            className="absolute top-1/2 -translate-y-1/2 end-2 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {selectedId && !open && (
        <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
          <Check className="h-3 w-3" />
          {t("clients.combobox.linked")}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
          {loading && (
            <div className="px-3 py-2 text-[11px] text-zinc-500">…</div>
          )}

          {!loading && results.length === 0 && trimmed === "" && (
            <div className="px-3 py-2 text-[11px] text-zinc-500">
              {t("clients.combobox.empty")}
            </div>
          )}

          {!loading && results.length === 0 && trimmed !== "" && !showAddNew && (
            <div className="px-3 py-2 text-[11px] text-zinc-500">
              {t("clients.combobox.noResults")}
            </div>
          )}

          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition hover:bg-zinc-900",
                selectedId === r.id && "bg-emerald-500/10"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-zinc-100">{r.name}</div>
                {r.phone && (
                  <div className="truncate text-[10px] text-zinc-500" dir="ltr">
                    {r.phone}
                  </div>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
                {r.projectsCount}
              </span>
            </button>
          ))}

          {showAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="flex w-full items-center gap-2 border-t border-zinc-800 bg-emerald-500/5 px-3 py-2 text-start text-sm text-emerald-400 transition hover:bg-emerald-500/10"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {t("clients.combobox.addNew")} <strong>{trimmed}</strong>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

```

---

## `components/projects/client-deliveries.tsx`

**Lines:** 548

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  MessageSquareWarning,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  createDeliveryAction,
  deleteDeliveryAction,
  setDeliveryStatusAction,
} from "@/app/projects/delivery-actions";

interface DeliveryRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  deliveryUrl: string | null;
  previewUrl: string | null;
  sentAt: Date | string | null;
  viewedAt: Date | string | null;
  changesRequestedAt: Date | string | null;
  approvedAt: Date | string | null;
  clientFeedback: string | null;
  notes: string | null;
  createdAt: Date | string;
  createdBy: { id: string; name: string } | null;
}

interface Props {
  projectId: string;
  deliveries: DeliveryRow[];
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  locale: "ar" | "en";
}

const STATUS_ORDER = ["drafting", "sent", "viewed", "changes_requested", "approved"];

const STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  drafting: { ar: "تجهيز", en: "Drafting" },
  sent: { ar: "مرسل", en: "Sent" },
  viewed: { ar: "تمت المشاهدة", en: "Viewed" },
  changes_requested: { ar: "طلب تعديل", en: "Changes" },
  approved: { ar: "معتمد", en: "Approved" },
};

const STATUS_TONE: Record<string, string> = {
  drafting: "border-zinc-700 bg-zinc-900/40 text-zinc-300",
  sent: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  viewed: "border-violet-500/30 bg-violet-500/5 text-violet-300",
  changes_requested: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  approved: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
};

const KIND_LABEL: Record<string, { ar: string; en: string }> = {
  post: { ar: "بوست", en: "Post" },
  reel: { ar: "ريل", en: "Reel" },
  video: { ar: "فيديو", en: "Video" },
  photo: { ar: "صورة", en: "Photo" },
  other: { ar: "أخرى", en: "Other" },
};

export function ClientDeliveries({
  projectId,
  deliveries,
  canCreate,
  canEdit,
  canApprove,
  canDelete,
  locale,
}: Props) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(deliveries.length > 0);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = deliveries.filter((d) => d.status === s).length;
    return acc;
  }, {});

  function onCreate(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createDeliveryAction(projectId, fd);
      if (!res.ok) {
        setError(res.message ?? "فشل");
      } else {
        setAdding(false);
      }
    });
  }

  function changeStatus(id: string, status: string, feedback?: string | null) {
    startTransition(async () => {
      await setDeliveryStatusAction({ deliveryId: id, status, feedback });
    });
  }

  function onDelete(id: string) {
    if (!confirm(isAr ? "حذف هذا التسليم؟" : "Delete this delivery?")) return;
    startTransition(async () => {
      await deleteDeliveryAction(id);
    });
  }

  return (
    <section className="rounded-xl border border-violet-500/30 bg-violet-500/5">
      <header className="flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <Send className="h-5 w-5 text-violet-300" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "تسليمات العميل" : "Client deliveries"}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-violet-300/80">
              <span>{deliveries.length}</span>
              {STATUS_ORDER.map(
                (s) =>
                  counts[s] > 0 && (
                    <span
                      key={s}
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px]",
                        STATUS_TONE[s]
                      )}
                    >
                      {counts[s]} · {STATUS_LABEL[s][isAr ? "ar" : "en"]}
                    </span>
                  )
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {canCreate && !adding && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 text-[11px] text-violet-200 hover:border-violet-400/50"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? "تسليم جديد" : "New delivery"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/60"
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {open && (
        <div className="space-y-3 border-t border-violet-500/20 p-4">
          {adding && canCreate && (
            <form
              action={(fd) => onCreate(fd)}
              className="space-y-2 rounded-lg border border-violet-500/30 bg-zinc-900/40 p-3"
            >
              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "العنوان" : "Title"}
                  </span>
                  <input
                    type="text"
                    name="title"
                    required
                    maxLength={200}
                    placeholder={
                      isAr ? "مثلاً: ريل أكتوبر #٣" : "e.g. October Reel #3"
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "النوع" : "Kind"}
                  </span>
                  <select
                    name="kind"
                    defaultValue="post"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
                  >
                    {Object.entries(KIND_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>
                        {isAr ? l.ar : l.en}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "رابط التسليم" : "Delivery URL"}
                  </span>
                  <input
                    type="url"
                    name="deliveryUrl"
                    placeholder="https://..."
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "رابط معاينة (اختياري)" : "Preview URL (optional)"}
                  </span>
                  <input
                    type="url"
                    name="previewUrl"
                    placeholder="https://..."
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
              </div>
              <label className="block">
                <span className="block text-[10px] text-zinc-500">
                  {isAr ? "ملاحظات داخلية" : "Internal notes"}
                </span>
                <textarea
                  name="notes"
                  rows={2}
                  className="mt-1 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                  }}
                  className="flex h-9 items-center gap-1 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
                >
                  <X className="h-3 w-3" />
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex h-9 items-center gap-1 rounded-md bg-violet-500/20 px-3 text-xs text-violet-200 transition hover:bg-violet-500/30 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {isAr ? "أضف" : "Add"}
                </button>
              </div>
            </form>
          )}

          {deliveries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
              {isAr
                ? "ما فيه تسليمات بعد"
                : "No deliveries yet"}
            </div>
          ) : (
            <ul className="space-y-2">
              {deliveries.map((d) => (
                <DeliveryRowItem
                  key={d.id}
                  delivery={d}
                  canEdit={canEdit}
                  canApprove={canApprove}
                  canDelete={canDelete}
                  isAr={isAr}
                  isPending={isPending}
                  onChangeStatus={changeStatus}
                  onDelete={() => onDelete(d.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function DeliveryRowItem({
  delivery,
  canEdit,
  canApprove,
  canDelete,
  isAr,
  isPending,
  onChangeStatus,
  onDelete,
}: {
  delivery: DeliveryRow;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  isAr: boolean;
  isPending: boolean;
  onChangeStatus: (
    id: string,
    status: string,
    feedback?: string | null
  ) => void;
  onDelete: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  const status = delivery.status;
  const sentSince = delivery.sentAt
    ? formatDuration(new Date(delivery.sentAt), new Date(), isAr)
    : null;

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                STATUS_TONE[status]
              )}
            >
              {STATUS_LABEL[status][isAr ? "ar" : "en"]}
            </span>
            <span className="rounded-full bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {(KIND_LABEL[delivery.kind] ?? KIND_LABEL.other)[isAr ? "ar" : "en"]}
            </span>
            {sentSince && (
              <span className="text-[10px] text-zinc-500">
                {isAr ? "أُرسل قبل" : "Sent"} {sentSince}
              </span>
            )}
          </div>
          <h3 className="mt-1 line-clamp-1 text-sm font-medium text-zinc-100">
            {delivery.title}
          </h3>
          {delivery.notes && (
            <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
              {delivery.notes}
            </p>
          )}
          {delivery.clientFeedback && (
            <p className="mt-1 rounded border-s-2 border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-200">
              <MessageSquareWarning className="me-1 inline h-3 w-3" />
              {delivery.clientFeedback}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
            {delivery.deliveryUrl && (
              <a
                href={delivery.deliveryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
              >
                <ExternalLink className="h-3 w-3" />
                {isAr ? "رابط التسليم" : "Delivery link"}
              </a>
            )}
            {delivery.previewUrl && (
              <a
                href={delivery.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
              >
                <Eye className="h-3 w-3" />
                {isAr ? "معاينة" : "Preview"}
              </a>
            )}
            {delivery.createdBy && (
              <span>
                {isAr ? "أنشأه" : "by"} {delivery.createdBy.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {canEdit && status === "drafting" && (
            <ActionButton
              onClick={() => onChangeStatus(delivery.id, "sent")}
              tone="sky"
              disabled={isPending}
              icon={Send}
              label={isAr ? "أرسل" : "Mark sent"}
            />
          )}
          {canEdit && status === "sent" && (
            <ActionButton
              onClick={() => onChangeStatus(delivery.id, "viewed")}
              tone="violet"
              disabled={isPending}
              icon={Eye}
              label={isAr ? "تمت المشاهدة" : "Viewed"}
            />
          )}
          {canEdit && (status === "sent" || status === "viewed") && !showFeedback && (
            <ActionButton
              onClick={() => setShowFeedback(true)}
              tone="amber"
              disabled={isPending}
              icon={MessageSquareWarning}
              label={isAr ? "تعديل" : "Changes"}
            />
          )}
          {canApprove && status !== "approved" && (
            <ActionButton
              onClick={() => onChangeStatus(delivery.id, "approved")}
              tone="emerald"
              disabled={isPending}
              icon={CheckCircle2}
              label={isAr ? "اعتمد" : "Approve"}
            />
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-30"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {showFeedback && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder={
              isAr
                ? "ملاحظات العميل / التعديلات المطلوبة"
                : "What changes did the client request?"
            }
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowFeedback(false)}
              className="h-8 rounded-md border border-zinc-800 px-2.5 text-[11px] text-zinc-400 hover:border-zinc-700"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                onChangeStatus(delivery.id, "changes_requested", feedback);
                setShowFeedback(false);
                setFeedback("");
              }}
              className="h-8 rounded-md bg-amber-500/20 px-2.5 text-[11px] text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
            >
              {isAr ? "احفظ التعديل" : "Save change request"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ActionButton({
  onClick,
  tone,
  disabled,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  tone: "sky" | "violet" | "amber" | "emerald";
  disabled: boolean;
  icon: typeof Send;
  label: string;
}) {
  const styles: Record<string, string> = {
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:border-sky-400/50",
    violet:
      "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:border-violet-400/50",
    amber:
      "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400/50",
    emerald:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] disabled:opacity-50",
        styles[tone]
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function formatDuration(then: Date, now: Date, isAr: boolean): string {
  const ms = now.getTime() - then.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return isAr ? `${minutes} دقيقة` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isAr ? `${hours} ساعة` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return isAr ? `${days} يوم` : `${days}d`;
}

```

---

## `components/projects/creative-brief.tsx`

**Lines:** 428

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ClipboardCheck,
  FileText,
  Lock,
  PenLine,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  saveBriefAction,
  setBriefStageAction,
} from "@/app/projects/brief-actions";

interface BriefRow {
  approvalStage: string;
  approvedAt: Date | null;
  approvedBy: { id: string; name: string } | null;
  objective: string | null;
  targetAudience: string | null;
  styleNotes: string | null;
  refs: string | null;
  deliverables: string | null;
  platforms: string | null;
  sizes: string | null;
  notes: string | null;
}

interface Props {
  projectId: string;
  brief: BriefRow | null;
  // Permission gates resolved server-side and passed in.
  canEdit: boolean;
  canApprove: boolean;
  locale: "ar" | "en";
}

const STAGE_TONE: Record<string, string> = {
  draft: "bg-zinc-700/40 text-zinc-300 border-zinc-700",
  pending_review: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

const STAGE_LABEL: Record<string, { ar: string; en: string }> = {
  draft: { ar: "مسوّدة", en: "Draft" },
  pending_review: { ar: "قيد المراجعة", en: "Pending review" },
  approved: { ar: "معتمد", en: "Approved" },
};

interface Field {
  key: keyof BriefRow;
  labelAr: string;
  labelEn: string;
  placeholderAr: string;
  placeholderEn: string;
  multiline?: boolean;
}

const FIELDS: Field[] = [
  {
    key: "objective",
    labelAr: "الهدف",
    labelEn: "Objective",
    placeholderAr: "الهدف من المشروع — وش نبي نحقق؟",
    placeholderEn: "What is the goal of this project?",
    multiline: true,
  },
  {
    key: "targetAudience",
    labelAr: "الجمهور المستهدف",
    labelEn: "Target audience",
    placeholderAr: "العمر، الجنس، المنطقة، الاهتمامات",
    placeholderEn: "Age, gender, region, interests",
    multiline: true,
  },
  {
    key: "styleNotes",
    labelAr: "الستايل والمزاج",
    labelEn: "Style & mood",
    placeholderAr: "ألوان، نبرة، مرجع بصري",
    placeholderEn: "Colors, tone, visual references",
    multiline: true,
  },
  {
    key: "refs",
    labelAr: "المراجع والروابط",
    labelEn: "References & links",
    placeholderAr: "ضع كل رابط في سطر منفصل",
    placeholderEn: "One URL per line",
    multiline: true,
  },
  {
    key: "deliverables",
    labelAr: "المخرجات",
    labelEn: "Deliverables",
    placeholderAr: "كم بوست؟ كم ريل؟ كم فيديو طويل؟",
    placeholderEn: "How many posts, reels, long-form videos?",
    multiline: true,
  },
  {
    key: "platforms",
    labelAr: "المنصات",
    labelEn: "Platforms",
    placeholderAr: "Instagram, TikTok, YouTube",
    placeholderEn: "Instagram, TikTok, YouTube",
  },
  {
    key: "sizes",
    labelAr: "المقاسات والأبعاد",
    labelEn: "Sizes",
    placeholderAr: "1080×1080, 1080×1920, 16:9",
    placeholderEn: "1080×1080, 1080×1920, 16:9",
  },
  {
    key: "notes",
    labelAr: "ملاحظات إضافية",
    labelEn: "Additional notes",
    placeholderAr: "أي شي ثاني الفريق لازم يعرفه",
    placeholderEn: "Anything else the team should know",
    multiline: true,
  },
];

export function CreativeBrief({
  projectId,
  brief,
  canEdit,
  canApprove,
  locale,
}: Props) {
  const isAr = locale === "ar";
  const stage = brief?.approvalStage ?? "draft";
  const isApproved = stage === "approved";
  const lockedForEdit = isApproved && !canApprove;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const filledCount = FIELDS.reduce((acc, f) => {
    const v = brief?.[f.key] as string | null;
    return acc + (v && v.trim().length > 0 ? 1 : 0);
  }, 0);
  const completion = Math.round((filledCount / FIELDS.length) * 100);

  function summary(): string {
    const lines: string[] = [];
    for (const f of FIELDS) {
      const v = brief?.[f.key] as string | null;
      if (!v?.trim()) continue;
      lines.push(`${isAr ? f.labelAr : f.labelEn}: ${v.split("\n").join(" / ")}`);
    }
    return lines.length > 0
      ? lines.join("\n")
      : isAr
      ? "البريف فاضي بعد."
      : "Brief is empty.";
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fall through silently
    }
  }

  async function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await saveBriefAction(projectId, formData);
      if (res.ok) {
        setEditing(false);
        setFlash(isAr ? "تم الحفظ" : "Saved");
        setTimeout(() => setFlash(null), 1800);
      } else {
        setFlash(res.message ?? (isAr ? "فشل الحفظ" : "Save failed"));
        setTimeout(() => setFlash(null), 2500);
      }
    });
  }

  function changeStage(next: "draft" | "pending_review" | "approved") {
    startTransition(async () => {
      await setBriefStageAction(projectId, next);
    });
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <header
        className="flex flex-wrap items-center justify-between gap-3 p-4"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <FileText className="h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "البريف الإبداعي" : "Creative brief"}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  STAGE_TONE[stage]
                )}
              >
                {(STAGE_LABEL[stage] ?? STAGE_LABEL.draft)[isAr ? "ar" : "en"]}
              </span>
              <span className="tabular-nums">
                {completion}% {isAr ? "مكتمل" : "complete"}
              </span>
              {brief?.approvedAt && brief.approvedBy && (
                <span className="hidden sm:inline">
                  {isAr ? "اعتمده" : "approved by"} {brief.approvedBy.name}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copySummary}
            className="flex h-9 items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 text-[11px] text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
            aria-label={isAr ? "نسخ ملخص البريف" : "Copy brief summary"}
          >
            {copied ? (
              <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Clipboard className="h-3.5 w-3.5" />
            )}
            <Sparkles className="h-3 w-3 text-amber-400" />
            {isAr ? "ملخص" : "Summary"}
          </button>
          {canEdit && !editing && !lockedForEdit && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 text-[11px] text-emerald-300 transition hover:border-emerald-400/50"
            >
              <PenLine className="h-3.5 w-3.5" />
              {isAr ? "تعديل" : "Edit"}
            </button>
          )}
          {lockedForEdit && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Lock className="h-3 w-3" />
              {isAr ? "مقفل" : "Locked"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/60"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {open && (
        <div className="border-t border-zinc-800 p-4">
          {flash && (
            <div className="mb-3 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-300">
              {flash}
            </div>
          )}

          {editing && canEdit ? (
            <form
              action={(fd) => onSubmit(fd)}
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              {FIELDS.map((f) => {
                const initial = (brief?.[f.key] as string | null) ?? "";
                return (
                  <div
                    key={f.key as string}
                    className={cn(f.multiline && "md:col-span-2")}
                  >
                    <label
                      htmlFor={`brief-${String(f.key)}`}
                      className="mb-1 block text-[11px] text-zinc-400"
                    >
                      {isAr ? f.labelAr : f.labelEn}
                    </label>
                    {f.multiline ? (
                      <textarea
                        id={`brief-${String(f.key)}`}
                        name={String(f.key)}
                        defaultValue={initial}
                        placeholder={isAr ? f.placeholderAr : f.placeholderEn}
                        rows={3}
                        className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                      />
                    ) : (
                      <input
                        id={`brief-${String(f.key)}`}
                        name={String(f.key)}
                        defaultValue={initial}
                        placeholder={isAr ? f.placeholderAr : f.placeholderEn}
                        className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-10 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 rounded-md bg-emerald-500/15 px-4 text-xs text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {isPending
                    ? isAr
                      ? "يحفظ..."
                      : "Saving..."
                    : isAr
                    ? "حفظ البريف"
                    : "Save brief"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {FIELDS.map((f) => {
                const v = (brief?.[f.key] as string | null) ?? "";
                return (
                  <div
                    key={f.key as string}
                    className="rounded-lg border border-zinc-800/60 p-3"
                  >
                    <div className="text-[11px] text-zinc-500">
                      {isAr ? f.labelAr : f.labelEn}
                    </div>
                    {v.trim().length > 0 ? (
                      <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-100">
                        {v}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-zinc-600">
                        {isAr ? "ما تعبّى بعد" : "Not filled in yet"}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Approval controls */}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800 pt-3">
                {canEdit && stage === "draft" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => changeStage("pending_review")}
                    className="h-9 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 text-[11px] text-amber-300 disabled:opacity-50"
                  >
                    {isAr ? "أرسل للمراجعة" : "Submit for review"}
                  </button>
                )}
                {canEdit && stage === "pending_review" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => changeStage("draft")}
                    className="h-9 rounded-md border border-zinc-800 px-3 text-[11px] text-zinc-300 disabled:opacity-50"
                  >
                    {isAr ? "إرجاع لمسوّدة" : "Back to draft"}
                  </button>
                )}
                {canApprove && stage !== "approved" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => changeStage("approved")}
                    className="h-9 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 text-[11px] text-emerald-300 disabled:opacity-50"
                  >
                    <CheckCircle2 className="me-1 inline h-3.5 w-3.5" />
                    {isAr ? "اعتمد البريف" : "Approve brief"}
                  </button>
                )}
                {canApprove && stage === "approved" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => changeStage("draft")}
                    className="h-9 rounded-md border border-zinc-800 px-3 text-[11px] text-zinc-400 disabled:opacity-50"
                  >
                    {isAr ? "إعادة فتح" : "Re-open"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

```

---

## `components/projects/package-tracker.tsx`

**Lines:** 361

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Film,
  Image as ImageIcon,
  Layers,
  Minus,
  Package as PackageIcon,
  PenLine,
  Plus,
  Save,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  bumpPackageCompletedAction,
  savePackageAction,
} from "@/app/projects/package-actions";

interface PackageRow {
  targetPosts: number;
  targetReels: number;
  targetVideos: number;
  targetShoots: number;
  targetStories: number;
  completedPosts: number;
  completedReels: number;
  completedVideos: number;
  completedShoots: number;
  completedStories: number;
  notes: string | null;
}

interface Props {
  projectId: string;
  pkg: PackageRow | null;
  canEdit: boolean;
  locale: "ar" | "en";
}

interface Item {
  key:
    | "Posts"
    | "Reels"
    | "Videos"
    | "Shoots"
    | "Stories";
  labelAr: string;
  labelEn: string;
  icon: typeof ImageIcon;
}

const ITEMS: Item[] = [
  { key: "Posts", labelAr: "بوست", labelEn: "Posts", icon: ImageIcon },
  { key: "Reels", labelAr: "ريل", labelEn: "Reels", icon: Film },
  { key: "Videos", labelAr: "فيديو", labelEn: "Videos", icon: Video },
  { key: "Shoots", labelAr: "تصوير", labelEn: "Shoots", icon: Camera },
  { key: "Stories", labelAr: "ستوري", labelEn: "Stories", icon: Layers },
];

const EMPTY: PackageRow = {
  targetPosts: 0,
  targetReels: 0,
  targetVideos: 0,
  targetShoots: 0,
  targetStories: 0,
  completedPosts: 0,
  completedReels: 0,
  completedVideos: 0,
  completedShoots: 0,
  completedStories: 0,
  notes: null,
};

export function PackageTracker({ projectId, pkg, canEdit, locale }: Props) {
  const isAr = locale === "ar";
  const data: PackageRow = pkg ?? EMPTY;
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totals = ITEMS.reduce(
    (acc, item) => {
      const target = data[`target${item.key}` as keyof PackageRow] as number;
      const done = data[`completed${item.key}` as keyof PackageRow] as number;
      acc.target += target;
      acc.done += done;
      return acc;
    },
    { target: 0, done: 0 }
  );
  const overallPct =
    totals.target > 0
      ? Math.min(100, Math.round((totals.done / totals.target) * 100))
      : 0;

  // If there are no targets at all and the user can't edit, hide the card.
  // Saves visual noise on projects that don't use the package model.
  if (totals.target === 0 && totals.done === 0 && !canEdit) return null;

  function bump(field: string, delta: 1 | -1) {
    startTransition(async () => {
      await bumpPackageCompletedAction({ projectId, field, delta });
    });
  }

  async function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await savePackageAction(projectId, formData);
      if (res.ok) setEditing(false);
    });
  }

  return (
    <section className="rounded-xl border border-sky-500/30 bg-sky-500/5">
      <header className="flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <PackageIcon className="h-5 w-5 text-sky-300" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "الباقة (الالتزام مع العميل)" : "Package tracker"}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-sky-300/80">
              {totals.target > 0 ? (
                <>
                  <span className="tabular-nums">
                    {totals.done} / {totals.target}{" "}
                    {isAr ? "تم تسليمه" : "delivered"}
                  </span>
                  <span className="font-semibold tabular-nums">
                    · {overallPct}%
                  </span>
                </>
              ) : (
                <span className="text-zinc-500">
                  {isAr
                    ? "ما تم تحديد أهداف بعد"
                    : "No targets set yet"}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 text-[11px] text-sky-200 hover:border-sky-400/50"
            >
              <PenLine className="h-3.5 w-3.5" />
              {isAr ? "تعديل الأهداف" : "Edit targets"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/60"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {open && (
        <div className="border-t border-sky-500/20 p-4">
          {editing && canEdit ? (
            <form
              action={(fd) => onSubmit(fd)}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      className="rounded-lg border border-sky-500/20 bg-zinc-900/40 p-3"
                    >
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-100">
                        <Icon className="h-3.5 w-3.5 text-sky-300" />
                        {isAr ? item.labelAr : item.labelEn}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500">
                            {isAr ? "الهدف" : "Target"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            name={`target${item.key}`}
                            defaultValue={
                              data[`target${item.key}` as keyof PackageRow] as number
                            }
                            className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm tabular-nums text-zinc-100 focus:border-zinc-700 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500">
                            {isAr ? "تم تسليمه" : "Delivered"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            name={`completed${item.key}`}
                            defaultValue={
                              data[
                                `completed${item.key}` as keyof PackageRow
                              ] as number
                            }
                            className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm tabular-nums text-zinc-100 focus:border-zinc-700 focus:outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="block">
                <span className="block text-[10px] text-zinc-500">
                  {isAr ? "ملاحظات على الباقة" : "Package notes"}
                </span>
                <textarea
                  name="notes"
                  defaultValue={data.notes ?? ""}
                  rows={2}
                  className="mt-1 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  placeholder={
                    isAr
                      ? "ضع أي تفاصيل عن الباقة (مثلاً: ٥ بوست شهرياً، حملة أسبوعين)"
                      : "Any notes about this package's scope"
                  }
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex h-10 items-center gap-1.5 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
                >
                  <X className="h-3.5 w-3.5" />
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex h-10 items-center gap-1.5 rounded-md bg-sky-500/20 px-4 text-xs text-sky-200 transition hover:bg-sky-500/30 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isAr ? "حفظ" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {ITEMS.map((item) => {
                const target = data[`target${item.key}` as keyof PackageRow] as number;
                const done = data[`completed${item.key}` as keyof PackageRow] as number;
                if (target === 0 && done === 0) return null;
                const pct =
                  target > 0
                    ? Math.min(100, Math.round((done / target) * 100))
                    : 0;
                const Icon = item.icon;
                const completed = target > 0 && done >= target;
                return (
                  <div
                    key={item.key}
                    className={cn(
                      "rounded-lg border p-3",
                      completed
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-sky-500/20 bg-zinc-900/40"
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                        <Icon className="h-3.5 w-3.5 text-sky-300" />
                        {isAr ? item.labelAr : item.labelEn}
                      </div>
                      {target > 0 && (
                        <span
                          className={cn(
                            "text-[10px] tabular-nums",
                            completed ? "text-emerald-300" : "text-sky-300"
                          )}
                        >
                          {pct}%
                        </span>
                      )}
                    </div>
                    <div className="text-base font-bold tabular-nums text-zinc-100">
                      {done}{" "}
                      <span className="text-xs font-normal text-zinc-500">
                        / {target}
                      </span>
                    </div>
                    {/* Bar */}
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={cn(
                          "h-full transition-all",
                          completed ? "bg-emerald-400" : "bg-sky-400"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {canEdit && (
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => bump(`completed${item.key}`, -1)}
                          disabled={isPending || done === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 hover:border-zinc-700 disabled:opacity-30"
                          aria-label="-1"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => bump(`completed${item.key}`, +1)}
                          disabled={isPending}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50 disabled:opacity-50"
                          aria-label="+1"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {data.notes && !editing && (
            <p className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-[12px] text-zinc-300">
              {data.notes}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

```

---

## `components/projects/project-assets.tsx`

**Lines:** 406

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  addAssetAction,
  deleteAssetAction,
} from "@/app/projects/asset-actions";

interface AssetRow {
  id: string;
  kind: string;
  title: string | null;
  caption: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  externalUrl: string | null;
  createdAt: Date | string;
  addedBy: { id: string; name: string } | null;
}

interface Props {
  projectId: string;
  assets: AssetRow[];
  canCreate: boolean;
  canDelete: boolean;
  locale: "ar" | "en";
}

const KINDS = [
  { key: "moodboard", labelAr: "موود بورد", labelEn: "Moodboard" },
  { key: "reference", labelAr: "مراجع", labelEn: "References" },
  { key: "brand", labelAr: "أصول الهوية", labelEn: "Brand assets" },
  { key: "deliverable", labelAr: "مخرجات نهائية", labelEn: "Final deliverables" },
  { key: "other", labelAr: "أخرى", labelEn: "Other" },
] as const;

const KIND_TONE: Record<string, string> = {
  moodboard: "border-pink-500/30 bg-pink-500/5",
  reference: "border-sky-500/30 bg-sky-500/5",
  brand: "border-amber-500/30 bg-amber-500/5",
  deliverable: "border-emerald-500/30 bg-emerald-500/5",
  other: "border-zinc-700 bg-zinc-900/40",
};

function isImageMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

export function ProjectAssets({
  projectId,
  assets,
  canCreate,
  canDelete,
  locale,
}: Props) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered =
    activeKind === "all"
      ? assets
      : assets.filter((a) => a.kind === activeKind);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addAssetAction(projectId, formData);
      if (!res.ok) {
        setError(res.message ?? (isAr ? "فشل الإضافة" : "Failed"));
      } else {
        setAdding(false);
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm(isAr ? "حذف هذا العنصر؟" : "Delete this asset?")) return;
    startTransition(async () => {
      await deleteAssetAction(id);
    });
  }

  return (
    <section className="rounded-xl border border-pink-500/30 bg-pink-500/5">
      <header className="flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <Layers className="h-5 w-5 text-pink-300" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "الموود بورد والأصول" : "Moodboard & assets"}
            </h2>
            <div className="mt-0.5 text-[11px] text-pink-300/80">
              {assets.length}{" "}
              {isAr ? "عنصر مرفوع" : "assets uploaded"}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {canCreate && !adding && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-pink-500/30 bg-pink-500/10 px-2.5 text-[11px] text-pink-200 hover:border-pink-400/50"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? "أضف" : "Add"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/60"
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {open && (
        <div className="border-t border-pink-500/20 p-4">
          {/* Kind filter chips */}
          {assets.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <KindChip
                active={activeKind === "all"}
                onClick={() => setActiveKind("all")}
                label={isAr ? "الكل" : "All"}
                count={assets.length}
              />
              {KINDS.map((k) => {
                const count = assets.filter((a) => a.kind === k.key).length;
                if (count === 0) return null;
                return (
                  <KindChip
                    key={k.key}
                    active={activeKind === k.key}
                    onClick={() => setActiveKind(k.key)}
                    label={isAr ? k.labelAr : k.labelEn}
                    count={count}
                  />
                );
              })}
            </div>
          )}

          {adding && canCreate && (
            <form
              action={(fd) => onSubmit(fd)}
              className="mb-3 space-y-2 rounded-lg border border-pink-500/30 bg-zinc-900/40 p-3"
              encType="multipart/form-data"
            >
              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "النوع" : "Kind"}
                  </span>
                  <select
                    name="kind"
                    defaultValue="moodboard"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
                  >
                    {KINDS.map((k) => (
                      <option key={k.key} value={k.key}>
                        {isAr ? k.labelAr : k.labelEn}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "العنوان (اختياري)" : "Title (optional)"}
                  </span>
                  <input
                    type="text"
                    name="title"
                    maxLength={120}
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
              </div>
              <label className="block">
                <span className="block text-[10px] text-zinc-500">
                  {isAr ? "وصف قصير" : "Short caption"}
                </span>
                <input
                  type="text"
                  name="caption"
                  maxLength={300}
                  className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "ملف (JPG/PNG/PDF)" : "File (JPG/PNG/PDF)"}
                  </span>
                  <input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/gif,application/pdf"
                    className="mt-1 block w-full text-xs text-zinc-300 file:me-2 file:rounded-md file:border-0 file:bg-zinc-800 file:px-2.5 file:py-1.5 file:text-zinc-200 hover:file:bg-zinc-700"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "أو رابط خارجي" : "Or external URL"}
                  </span>
                  <input
                    type="url"
                    name="externalUrl"
                    placeholder="https://..."
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                  }}
                  className="flex h-9 items-center gap-1 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
                >
                  <X className="h-3 w-3" />
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex h-9 items-center gap-1 rounded-md bg-pink-500/20 px-3 text-xs text-pink-200 transition hover:bg-pink-500/30 disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  {isAr ? "ارفع" : "Upload"}
                </button>
              </div>
            </form>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
              {isAr
                ? "ما فيه عناصر هنا بعد"
                : "No assets here yet"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  canDelete={canDelete}
                  onDelete={() => onDelete(a.id)}
                  isAr={isAr}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function KindChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] transition",
        active
          ? "border-pink-400/60 bg-pink-500/15 text-pink-100"
          : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
      )}
    >
      {label}
      <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] tabular-nums">
        {count}
      </span>
    </button>
  );
}

function AssetCard({
  asset,
  canDelete,
  onDelete,
  isAr,
}: {
  asset: AssetRow;
  canDelete: boolean;
  onDelete: () => void;
  isAr: boolean;
}) {
  const isImage = isImageMime(asset.fileType);
  const target = asset.externalUrl ?? asset.fileUrl ?? "#";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border",
        KIND_TONE[asset.kind] ?? KIND_TONE.other
      )}
    >
      <a href={target} target="_blank" rel="noreferrer" className="block">
        <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-950">
          {asset.fileUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.fileUrl}
              alt={asset.title ?? asset.caption ?? "asset"}
              className="h-full w-full object-cover transition group-hover:scale-105"
              loading="lazy"
            />
          ) : asset.externalUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
              <ExternalLink className="h-6 w-6" />
              <span className="line-clamp-2 px-2 text-center text-[10px]" dir="ltr">
                {asset.externalUrl}
              </span>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500">
              {asset.fileType === "application/pdf" ? (
                <FileText className="h-8 w-8" />
              ) : (
                <ImageIcon className="h-8 w-8" />
              )}
            </div>
          )}
        </div>
        <div className="p-2">
          <div className="line-clamp-1 text-xs font-medium text-zinc-100">
            {asset.title || asset.fileName || asset.kind}
          </div>
          {asset.caption && (
            <div className="line-clamp-2 text-[10px] text-zinc-400">
              {asset.caption}
            </div>
          )}
          {asset.addedBy && (
            <div className="mt-0.5 text-[9px] text-zinc-600">
              {isAr ? "أضافه" : "by"} {asset.addedBy.name}
            </div>
          )}
        </div>
      </a>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute end-2 top-2 hidden h-7 w-7 items-center justify-center rounded-md bg-zinc-950/80 text-rose-400 hover:bg-rose-500/20 group-hover:flex"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

```

---

## `components/projects/project-freelancers.tsx`

**Lines:** 825

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code,
  DollarSign,
  Edit3,
  Mic,
  Palette,
  PenTool,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatQar } from "@/lib/db/helpers";
import {
  createFreelancerAction,
  deleteFreelancerAction,
  recordFreelancerPaymentAction,
  updateFreelancerAction,
} from "@/app/projects/freelancer-actions";

interface PaymentRow {
  id: string;
  amountQar: number;
  occurredAt: Date | string;
  description: string | null;
}

interface FreelancerRow {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  agreedAmountQar: number;
  paymentTerms: string | null;
  status: string;
  notes: string | null;
  createdAt: Date | string;
  payments: PaymentRow[];
}

interface Props {
  projectId: string;
  freelancers: FreelancerRow[];
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean; // mark a payment as paid
  canDelete: boolean;
  locale: "ar" | "en";
}

const ROLE_OPTIONS = [
  { key: "photographer", labelAr: "مصوّر", labelEn: "Photographer", icon: Camera, tone: "sky" },
  { key: "videographer", labelAr: "مصوّر فيديو", labelEn: "Videographer", icon: Video, tone: "indigo" },
  { key: "designer", labelAr: "ديزاينر", labelEn: "Designer", icon: Palette, tone: "pink" },
  { key: "editor", labelAr: "مونتير", labelEn: "Video editor", icon: Edit3, tone: "violet" },
  { key: "sound", labelAr: "صوت", labelEn: "Sound", icon: Mic, tone: "amber" },
  { key: "writer", labelAr: "كاتب محتوى", labelEn: "Copywriter", icon: PenTool, tone: "emerald" },
  { key: "developer", labelAr: "مطوّر", labelEn: "Developer", icon: Code, tone: "cyan" },
  { key: "other", labelAr: "أخرى", labelEn: "Other", icon: UserRound, tone: "zinc" },
] as const;

const ROLE_TONE: Record<string, string> = {
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  pink: "border-pink-500/30 bg-pink-500/10 text-pink-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  zinc: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
};

const STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  active: { ar: "نشط", en: "Active" },
  completed: { ar: "مكتمل", en: "Completed" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

const STATUS_TONE: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  completed: "border-zinc-700 bg-zinc-800/40 text-zinc-400",
  cancelled: "border-rose-500/30 bg-rose-500/5 text-rose-300",
};

function roleSpec(role: string) {
  return ROLE_OPTIONS.find((r) => r.key === role) ?? ROLE_OPTIONS[ROLE_OPTIONS.length - 1];
}

export function ProjectFreelancers({
  projectId,
  freelancers,
  canCreate,
  canEdit,
  canApprove,
  canDelete,
  locale,
}: Props) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(freelancers.length > 0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Aggregates for the header
  const totals = freelancers.reduce(
    (acc, f) => {
      const paid = f.payments.reduce((sum, p) => sum + p.amountQar, 0);
      acc.agreed += f.agreedAmountQar;
      acc.paid += paid;
      if (f.status === "active") acc.active += 1;
      return acc;
    },
    { agreed: 0, paid: 0, active: 0 }
  );
  const remaining = Math.max(0, totals.agreed - totals.paid);

  function flashMsg(m: string) {
    setFlash(m);
    setTimeout(() => setFlash(null), 2500);
  }

  function onCreate(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createFreelancerAction(projectId, fd);
      if (!res.ok) setError(res.message ?? (isAr ? "فشل" : "Failed"));
      else {
        setAdding(false);
        flashMsg(isAr ? "تم إضافة الفري لانسر" : "Freelancer added");
      }
    });
  }

  function onUpdate(freelancerId: string, fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateFreelancerAction(freelancerId, fd);
      if (!res.ok) setError(res.message ?? "");
      else {
        setEditingId(null);
        flashMsg(isAr ? "تم الحفظ" : "Saved");
      }
    });
  }

  function onDelete(freelancerId: string, name: string) {
    if (
      !confirm(
        isAr
          ? `حذف ${name}؟ (إذا فيه دفعات مسجّلة راح يتحول لملغي)`
          : `Delete ${name}? (If payments exist it'll be cancelled instead)`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteFreelancerAction(freelancerId);
      if (res.ok && "cancelled" in res && res.cancelled) {
        flashMsg(res.message ?? (isAr ? "تم تحويله إلى ملغي" : "Moved to cancelled"));
      } else if (res.ok) {
        flashMsg(isAr ? "تم الحذف" : "Deleted");
      }
    });
  }

  function onPay(freelancerId: string, fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await recordFreelancerPaymentAction(freelancerId, fd);
      if (!res.ok) setError(res.message ?? "");
      else {
        setPayingId(null);
        flashMsg(isAr ? "تم تسجيل الدفعة" : "Payment recorded");
      }
    });
  }

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <Users className="h-5 w-5 text-amber-300" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "الفري لانسرز (موظفو المشروع)" : "Project freelancers"}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-amber-300/80">
              <span>
                {freelancers.length}{" "}
                {isAr ? `(${totals.active} نشط)` : `(${totals.active} active)`}
              </span>
              {totals.agreed > 0 && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span>
                    {isAr ? "متفق عليه" : "Agreed"}: {formatQar(totals.agreed, { locale })}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className={remaining === 0 ? "text-emerald-300" : "text-amber-200"}>
                    {isAr ? "مدفوع" : "Paid"}: {formatQar(totals.paid, { locale })}
                  </span>
                  {remaining > 0 && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-rose-300">
                        {isAr ? "متبقي" : "Outstanding"}: {formatQar(remaining, { locale })}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {canCreate && !adding && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 text-[11px] text-amber-200 hover:border-amber-400/50"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? "أضف فري لانسر" : "Add freelancer"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/60"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {open && (
        <div className="space-y-3 border-t border-amber-500/20 p-4">
          {flash && (
            <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-1.5 text-[11px] text-emerald-300">
              {flash}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-300">
              {error}
            </div>
          )}

          {adding && canCreate && (
            <FreelancerForm
              isAr={isAr}
              isPending={isPending}
              onCancel={() => {
                setAdding(false);
                setError(null);
              }}
              onSubmit={onCreate}
              submitLabel={isAr ? "أضف" : "Add"}
            />
          )}

          {freelancers.length === 0 && !adding ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
              {isAr
                ? "ما فيه فري لانسرز على هذا المشروع. أضف مصوّر / ديزاينر / مونتير ... كلهم يوصل معاشهم من ميزانية المشروع."
                : "No freelancers on this project yet. Add photographers / designers / editors — their pay comes out of this project's budget."}
            </div>
          ) : (
            <ul className="space-y-2">
              {freelancers.map((f) => (
                <li key={f.id}>
                  <FreelancerCard
                    freelancer={f}
                    isAr={isAr}
                    locale={locale}
                    isPending={isPending}
                    canEdit={canEdit}
                    canApprove={canApprove}
                    canDelete={canDelete}
                    isEditing={editingId === f.id}
                    isPaying={payingId === f.id}
                    onEdit={() => {
                      setEditingId(f.id);
                      setPayingId(null);
                      setError(null);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    onSubmitEdit={(fd) => onUpdate(f.id, fd)}
                    onStartPay={() => {
                      setPayingId(f.id);
                      setEditingId(null);
                      setError(null);
                    }}
                    onCancelPay={() => setPayingId(null)}
                    onSubmitPay={(fd) => onPay(f.id, fd)}
                    onDelete={() => onDelete(f.id, f.name)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function FreelancerCard({
  freelancer: f,
  isAr,
  locale,
  isPending,
  canEdit,
  canApprove,
  canDelete,
  isEditing,
  isPaying,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
  onStartPay,
  onCancelPay,
  onSubmitPay,
  onDelete,
}: {
  freelancer: FreelancerRow;
  isAr: boolean;
  locale: "ar" | "en";
  isPending: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  isEditing: boolean;
  isPaying: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (fd: FormData) => void;
  onStartPay: () => void;
  onCancelPay: () => void;
  onSubmitPay: (fd: FormData) => void;
  onDelete: () => void;
}) {
  const role = roleSpec(f.role);
  const RoleIcon = role.icon;
  const paid = f.payments.reduce((sum, p) => sum + p.amountQar, 0);
  const remaining = Math.max(0, f.agreedAmountQar - paid);
  const overpaid = paid > f.agreedAmountQar;
  const fullyPaid = f.agreedAmountQar > 0 && paid >= f.agreedAmountQar;
  const pct =
    f.agreedAmountQar > 0
      ? Math.min(100, Math.round((paid / f.agreedAmountQar) * 100))
      : 0;

  const phoneE164 = f.phone?.replace(/[^\d+]/g, "");

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                ROLE_TONE[role.tone]
              )}
            >
              <RoleIcon className="h-3 w-3" />
              {isAr ? role.labelAr : role.labelEn}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                STATUS_TONE[f.status] ?? STATUS_TONE.active
              )}
            >
              {(STATUS_LABEL[f.status] ?? STATUS_LABEL.active)[isAr ? "ar" : "en"]}
            </span>
            {fullyPaid && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                <CheckCircle2 className="me-0.5 inline h-3 w-3" />
                {isAr ? "تم الدفع كامل" : "Fully paid"}
              </span>
            )}
            {overpaid && (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">
                {isAr ? "تجاوز المتفق" : "Over agreed"}
              </span>
            )}
          </div>

          <h3 className="mt-1 text-sm font-semibold text-zinc-100">{f.name}</h3>

          {(f.phone || f.email) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
              {f.phone && (
                <a
                  href={`tel:${phoneE164}`}
                  className="inline-flex items-center gap-1 hover:text-zinc-200"
                  dir="ltr"
                >
                  <Phone className="h-3 w-3" />
                  {f.phone}
                </a>
              )}
              {f.email && (
                <a
                  href={`mailto:${f.email}`}
                  className="hover:text-zinc-200"
                  dir="ltr"
                >
                  {f.email}
                </a>
              )}
            </div>
          )}

          {f.paymentTerms && (
            <p className="mt-1 text-[11px] text-zinc-500">
              {isAr ? "شروط الدفع" : "Terms"}: {f.paymentTerms}
            </p>
          )}
          {f.notes && (
            <p className="mt-0.5 text-[11px] text-zinc-500">{f.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {canApprove && f.status === "active" && (
            <button
              type="button"
              onClick={onStartPay}
              disabled={isPending || isPaying}
              className="flex h-8 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 text-[11px] text-emerald-300 hover:border-emerald-400/50 disabled:opacity-50"
            >
              <DollarSign className="h-3 w-3" />
              {isAr ? "سجّل دفعة" : "Record payment"}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-8 items-center gap-1 rounded-md border border-zinc-800 px-2 text-[11px] text-zinc-300 hover:border-zinc-700"
            >
              <Edit3 className="h-3 w-3" />
              {isAr ? "عدّل" : "Edit"}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-30"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Money summary + progress bar */}
      {(f.agreedAmountQar > 0 || paid > 0) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Money
            label={isAr ? "متفق عليه" : "Agreed"}
            value={formatQar(f.agreedAmountQar, { locale })}
            tone="zinc"
          />
          <Money
            label={isAr ? "مدفوع" : "Paid"}
            value={formatQar(paid, { locale })}
            tone={fullyPaid ? "emerald" : "sky"}
          />
          <Money
            label={isAr ? "متبقي" : "Remaining"}
            value={formatQar(overpaid ? -1 * (paid - f.agreedAmountQar) : remaining, {
              locale,
              sign: overpaid,
            })}
            tone={remaining === 0 ? "emerald" : "rose"}
          />
        </div>
      )}
      {f.agreedAmountQar > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={cn(
              "h-full transition-all",
              fullyPaid ? "bg-emerald-400" : "bg-sky-400",
              overpaid && "bg-rose-400"
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}

      {/* Payment history */}
      {f.payments.length > 0 && (
        <details className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1.5 text-[11px] open:bg-zinc-950/60">
          <summary className="cursor-pointer select-none text-zinc-300">
            <Wallet className="me-1 inline h-3 w-3" />
            {isAr ? "سجل الدفعات" : "Payment history"} · {f.payments.length}
          </summary>
          <ul className="mt-1.5 space-y-1">
            {f.payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded border border-zinc-800/60 bg-zinc-900/40 px-2 py-1"
              >
                <span className="line-clamp-1 text-zinc-400">
                  {p.description ??
                    new Date(p.occurredAt).toLocaleDateString("en-US")}
                </span>
                <span className="font-semibold tabular-nums text-zinc-100">
                  −{formatQar(p.amountQar, { locale })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Inline payment form */}
      {isPaying && canApprove && (
        <form
          action={(fd) => onSubmitPay(fd)}
          className="mt-3 space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="block text-[10px] text-zinc-500">
                {isAr ? "المبلغ (ر.ق)" : "Amount (QAR)"}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="amountQar"
                required
                defaultValue={remaining > 0 ? remaining : ""}
                placeholder={remaining > 0 ? String(remaining) : "0"}
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm tabular-nums text-zinc-100 focus:border-zinc-700 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] text-zinc-500">
                {isAr ? "تاريخ الدفع" : "Date"}
              </span>
              <input
                type="date"
                name="occurredAt"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
              />
            </label>
            <label className="block sm:col-span-1">
              <span className="block text-[10px] text-zinc-500">
                {isAr ? "ملاحظات (اختياري)" : "Note (optional)"}
              </span>
              <input
                type="text"
                name="description"
                placeholder={
                  isAr
                    ? `دفعة لـ ${f.name} (${role.labelAr})`
                    : `Payment to ${f.name}`
                }
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
              />
            </label>
          </div>
          <p className="text-[10px] text-emerald-300/70">
            {isAr
              ? "هذي الدفعة تُسجَّل كمصروف على المشروع وتُخصَم من ربحيته تلقائياً."
              : "Recorded as a project expense; project profit updates automatically."}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancelPay}
              className="flex h-9 items-center gap-1 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
            >
              <X className="h-3 w-3" />
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex h-9 items-center gap-1 rounded-md bg-emerald-500/20 px-3 text-xs text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <DollarSign className="h-3 w-3" />
              {isAr ? "سجّل الدفعة" : "Record payment"}
            </button>
          </div>
        </form>
      )}

      {/* Inline edit form */}
      {isEditing && canEdit && (
        <FreelancerForm
          isAr={isAr}
          isPending={isPending}
          initial={f}
          showStatus
          onCancel={onCancelEdit}
          onSubmit={(fd) => onSubmitEdit(fd)}
          submitLabel={isAr ? "احفظ" : "Save"}
        />
      )}
    </div>
  );
}

function FreelancerForm({
  initial,
  isAr,
  isPending,
  onCancel,
  onSubmit,
  submitLabel,
  showStatus,
}: {
  initial?: Partial<FreelancerRow>;
  isAr: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
  submitLabel: string;
  showStatus?: boolean;
}) {
  return (
    <form
      action={(fd) => onSubmit(fd)}
      className="mt-3 space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-3"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "الاسم" : "Name"}
          </span>
          <input
            type="text"
            name="name"
            required
            maxLength={200}
            defaultValue={initial?.name ?? ""}
            placeholder={isAr ? "مثلاً: أحمد المصور" : "e.g. Ahmed (photographer)"}
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "التخصص" : "Role"}
          </span>
          <select
            name="role"
            defaultValue={initial?.role ?? "photographer"}
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>
                {isAr ? r.labelAr : r.labelEn}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "الجوال (اختياري)" : "Phone (optional)"}
          </span>
          <input
            type="tel"
            name="phone"
            maxLength={40}
            defaultValue={initial?.phone ?? ""}
            placeholder="+974 ..."
            dir="ltr"
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "الإيميل (اختياري)" : "Email (optional)"}
          </span>
          <input
            type="email"
            name="email"
            maxLength={200}
            defaultValue={initial?.email ?? ""}
            dir="ltr"
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "المبلغ المتفق عليه (ر.ق)" : "Agreed amount (QAR)"}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="agreedAmountQar"
            defaultValue={initial?.agreedAmountQar ?? 0}
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm tabular-nums text-zinc-100 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "شروط الدفع" : "Payment terms"}
          </span>
          <input
            type="text"
            name="paymentTerms"
            maxLength={400}
            defaultValue={initial?.paymentTerms ?? ""}
            placeholder={
              isAr
                ? "مثلاً: ٥٠٪ مقدّم + ٥٠٪ عند التسليم"
                : "e.g. 50% upfront, 50% on delivery"
            }
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        {showStatus && (
          <label className="block sm:col-span-2">
            <span className="block text-[10px] text-zinc-500">
              {isAr ? "الحالة" : "Status"}
            </span>
            <select
              name="status"
              defaultValue={initial?.status ?? "active"}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
            >
              {Object.keys(STATUS_LABEL).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s][isAr ? "ar" : "en"]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="block">
        <span className="block text-[10px] text-zinc-500">
          {isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}
        </span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ""}
          className="mt-1 w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 items-center gap-1 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
        >
          <X className="h-3 w-3" />
          {isAr ? "إلغاء" : "Cancel"}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex h-9 items-center gap-1 rounded-md bg-amber-500/20 px-3 text-xs text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Money({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "zinc" | "sky" | "emerald" | "rose";
}) {
  const t: Record<string, string> = {
    zinc: "text-zinc-100",
    sky: "text-sky-300",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
  };
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/30 p-2">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={cn("mt-0.5 text-sm font-bold tabular-nums", t[tone])}>
        {value}
      </div>
    </div>
  );
}


```

---

## `components/projects/project-profit.tsx`

**Lines:** 137

```tsx
// Owner-only project profit widget — costs / income / margin computed from
// the existing Transactions table. Intentionally pure presentation; the
// numbers are crunched server-side and passed in.

import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatQar } from "@/lib/db/helpers";

interface Props {
  totals: {
    income: number;
    expenses: number;
    net: number;
    marginPct: number | null; // null if income is 0 (margin undefined)
    transactionCount: number;
  };
  budgetQar: number;
  locale: "ar" | "en";
}

export function ProjectProfit({ totals, budgetQar, locale }: Props) {
  const isAr = locale === "ar";
  const netTone: "positive" | "danger" | "neutral" =
    totals.net > 0 ? "positive" : totals.net < 0 ? "danger" : "neutral";

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-amber-200">
            {isAr ? "ربحية المشروع (للرئيس فقط)" : "Project profit (Owner only)"}
          </h2>
        </div>
        <span className="text-[10px] text-amber-300/70">
          {totals.transactionCount}{" "}
          {isAr ? "معاملة مسجّلة" : "tracked transactions"}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={TrendingUp}
          label={isAr ? "الإيرادات" : "Income"}
          value={formatQar(totals.income, { locale })}
          tone="positive"
        />
        <Stat
          icon={TrendingDown}
          label={isAr ? "المصاريف" : "Expenses"}
          value={formatQar(totals.expenses, { locale })}
          tone="danger"
        />
        <Stat
          label={isAr ? "صافي الربح" : "Net profit"}
          value={formatQar(totals.net, { locale, sign: true })}
          tone={netTone}
          big
        />
        <Stat
          label={isAr ? "هامش الربح" : "Margin"}
          value={
            totals.marginPct === null
              ? "—"
              : `${totals.marginPct > 0 ? "+" : ""}${totals.marginPct.toFixed(1)}%`
          }
          tone={
            totals.marginPct === null
              ? "neutral"
              : totals.marginPct >= 0
              ? "positive"
              : "danger"
          }
        />
      </div>

      {budgetQar > 0 && (
        <div className="mt-3 text-[11px] text-amber-300/80">
          {isAr ? "الميزانية المتوقعة" : "Planned budget"}:{" "}
          <span className="font-semibold">{formatQar(budgetQar, { locale })}</span>
          {totals.income > 0 && (
            <>
              {" · "}
              {isAr ? "نسبة التحصيل" : "Collection"}:{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  totals.income >= budgetQar ? "text-emerald-300" : "text-amber-200"
                )}
              >
                {Math.round((totals.income / budgetQar) * 100)}%
              </span>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  big = false,
}: {
  icon?: typeof Wallet;
  label: string;
  value: string;
  tone: "positive" | "danger" | "neutral";
  big?: boolean;
}) {
  const t =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "danger"
      ? "text-rose-400"
      : "text-zinc-100";
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-amber-300/70">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-bold tabular-nums",
          big ? "text-base" : "text-sm",
          t
        )}
      >
        {value}
      </div>
    </div>
  );
}

```

---

## `components/sidebar.tsx`

**Lines:** 288

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Home,
  Briefcase,
  Users,
  UserSquare,
  DollarSign,
  KanbanSquare,
  FileText,
  ShieldCheck,
  LogOut,
  Shield,
  Archive,
  Palette,
  Calendar,
  Camera,
  Package,
  Menu,
  X,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";
import {
  isDeptLeadOrAbove,
  isManagerOrAbove,
  isOwner,
  type Role,
} from "@/lib/auth/roles";

// Hide most of the local part of an email so the address can still be
// recognised by its owner without exposing it to anyone glancing at the screen.
//   "ahmed.ali@gmail.com"  → "a***@gmail.com"
//   "x@gmail.com"          → "x***@gmail.com"
//   "no-domain"            → "no-domain"   (untouched)
function maskEmail(email: string): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 1);
  return `${head}***${domain}`;
}

// minRole controls which tier can see a sidebar entry. We resolve it against
// the user's role via meets() — so e.g. minRole="manager" hides the entry from
// employees + dept_leads but shows it to managers and owners.
type MinRole = "owner" | "manager" | "dept_lead" | "any";

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof Home;
  highlight?: boolean;
  minRole?: MinRole;
}

const nav: NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: Home },
  { href: "/projects", labelKey: "nav.projects", icon: Briefcase, highlight: true },
  { href: "/tasks", labelKey: "nav.tasks", icon: KanbanSquare, highlight: true },
  { href: "/clients", labelKey: "nav.clients", icon: UserSquare },
  { href: "/team", labelKey: "nav.team", icon: Users },
  { href: "/meetings", labelKey: "nav.meetings", icon: Calendar, highlight: true },
  { href: "/shoots", labelKey: "nav.shoots", icon: Camera, highlight: true },
  { href: "/equipment", labelKey: "nav.equipment", icon: Package },
  // Finance: dept_lead and above can OPEN the page (to record transactions).
  // The owner-only totals view is enforced inside the page itself.
  { href: "/finance", labelKey: "nav.finance", icon: DollarSign, minRole: "dept_lead" },
  { href: "/reports", labelKey: "nav.reports", icon: FileText, minRole: "owner" },
  // User approval is now manager-accessible. Owner sees it too via inheritance.
  { href: "/admin/users", labelKey: "nav.admin_users", icon: ShieldCheck, minRole: "manager" },
  { href: "/admin/permissions", labelKey: "nav.admin_permissions", icon: KeyRound, minRole: "owner" },
  { href: "/admin/audit", labelKey: "nav.admin_audit", icon: Shield, minRole: "owner" },
  { href: "/admin/backup", labelKey: "nav.admin_backup", icon: Archive, minRole: "owner" },
  { href: "/admin/theme", labelKey: "nav.admin_theme", icon: Palette, minRole: "owner" },
];

function visibleTo(role: Role, min: MinRole | undefined): boolean {
  if (!min || min === "any") return true;
  if (min === "owner") return isOwner(role);
  if (min === "manager") return isManagerOrAbove(role);
  if (min === "dept_lead") return isDeptLeadOrAbove(role);
  return true;
}

interface Props {
  userRole: Role;
  userName: string;
  userEmail: string;
  logoPath?: string;
}

export function Sidebar({ userRole, userName, userEmail, logoPath }: Props) {
  const pathname = usePathname();
  const t = useT();
  const { locale } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close the mobile drawer when the user navigates.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Listen for the bottom-nav "More" button. We use a window-level custom
  // event so the bottom nav (a sibling component, not a parent) can trigger
  // the drawer without lifting state into a wrapper. Pairs with the
  // dispatcher in components/mobile-bottom-nav.tsx → MobileBottomNavMount.
  useEffect(() => {
    const onOpen = () => setMobileOpen(true);
    window.addEventListener("srb:open-mobile-nav", onOpen);
    return () => window.removeEventListener("srb:open-mobile-nav", onOpen);
  }, []);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const activeIndicatorClass =
    locale === "ar"
      ? "mr-auto h-1.5 w-1.5 rounded-full"
      : "ml-auto h-1.5 w-1.5 rounded-full";

  const panel = (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col gap-1 bg-zinc-900/95 p-4 md:bg-zinc-900/40",
        "md:relative md:h-auto md:translate-x-0 md:border-zinc-800 md:border-s",
        // Mobile: fixed drawer overlay
        "fixed inset-y-0 z-40 h-screen border-zinc-800 border-s transition-transform duration-200",
        locale === "ar" ? "right-0" : "left-0",
        mobileOpen
          ? "translate-x-0"
          : locale === "ar"
          ? "translate-x-full md:translate-x-0"
          : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-2 px-2 py-3 md:block">
        <div className="flex-1">
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "var(--color-brand-dim)" }}
          >
            <img
              src={logoPath || "/srb-logo-white.png"}
              alt="SRB"
              className="h-7 w-full object-contain object-center"
            />
          </div>
          <div className="mt-2 text-center text-[10px] text-zinc-500">
            {t("brand.system")}
          </div>
        </div>
        {/* Close button — mobile only. 44px min size meets iOS touch target guidance. */}
        <button
          onClick={() => setMobileOpen(false)}
          className="mt-2 flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {nav.map((item) => {
          if (!visibleTo(userRole, item.minRole)) return null;
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const isHighlight = "highlight" in item && item.highlight;

          const classes = cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
            active
              ? "bg-zinc-800/80 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
          );

          const highlightStyle =
            isHighlight && !active ? { color: "var(--color-brand)" } : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={classes}
              style={highlightStyle}
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.labelKey)}</span>
              {active && (
                <span
                  className={activeIndicatorClass}
                  style={{ background: "var(--color-brand)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-zinc-800 pt-3">
        <div className="mb-2 rounded-lg bg-zinc-800/40 p-2.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-zinc-200">
                {userName}
              </div>
              <div
                className="truncate text-[10px] text-zinc-500"
                dir="ltr"
                title={userEmail}
              >
                {maskEmail(userEmail)}
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px]",
                userRole === "admin"
                  ? "bg-rose-500/10 text-rose-400"
                  : userRole === "manager"
                  ? "bg-amber-500/10 text-amber-400"
                  : userRole === "department_lead"
                  ? "bg-sky-500/10 text-sky-400"
                  : "bg-emerald-500/10 text-emerald-400"
              )}
            >
              {t(`role.${userRole}`)}
            </span>
          </div>
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-700 py-1 text-[10px] text-zinc-400 transition hover:border-rose-500/30 hover:text-rose-400"
          >
            <LogOut className="h-3 w-3" />
            {t("auth.signout")}
          </button>
        </div>
        <div className="text-[10px] text-zinc-600">v1.0.0 · Phase 2 real</div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger — only shown below md. Safe-area-inset keeps the
          button below the iPhone Dynamic Island / notch. */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-200 shadow-lg md:hidden"
        style={{
          top: "max(12px, env(safe-area-inset-top))",
          ...(locale === "ar"
            ? { right: "max(12px, env(safe-area-inset-right))" }
            : { left: "max(12px, env(safe-area-inset-left))" }),
        }}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop — clicking closes the drawer */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-hidden
        />
      )}

      {panel}
    </>
  );
}

```

---

## `components/tasks/task-submission-section.tsx`

**Lines:** 899

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  CornerDownLeft,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { detectLinkType } from "@/lib/links";
import { cn } from "@/lib/cn";

export interface SubmissionLite {
  id: string;
  linkUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  note: string | null;
  status: string;
  // Revision number — 1 for the first submission on a task, increments
  // whenever the assignee re-submits after "request changes". Falls back to
  // a derived index if older rows didn't have the column populated.
  revisionNumber?: number | null;
  reviewNotes: string | null;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  submitter: { id: string; name: string };
  reviewer: { id: string; name: string } | null;
}

interface Props {
  taskId: string;
  /** Currently unused inside the section — kept on the props so callers
   *  can pass it for future copy ("submitted [Title]") without having to
   *  thread a new prop through. */
  taskTitle?: string;
  taskStatus: string;
  isAssignee: boolean;
  isOwner: boolean;
  // Latest snapshot (from Task row)
  submissionUrl: string | null;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
  submissionFileType: string | null;
  submissionNote: string | null;
  submittedAt: Date | string | null;
  reviewNote: string | null;
  reviewedAt: Date | string | null;
  // Optional history (small list rendered below review actions)
  submissions?: SubmissionLite[];
  /** Called after a successful submit / approve / reject — modal closes. */
  onAfterAction?: () => void;
}

const ACCEPT_MIME =
  "image/jpeg,image/png,image/gif,application/pdf";
const ACCEPT_EXT = ".jpg,.jpeg,.png,.gif,.pdf";
const MAX_BYTES = 10 * 1024 * 1024;

interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface Toast {
  kind: "success" | "warning" | "error";
  message: string;
}

export function TaskSubmissionSection({
  taskId,
  taskStatus,
  isAssignee,
  isOwner,
  submissionUrl,
  submissionFileUrl,
  submissionFileName,
  submissionFileType,
  submissionNote,
  submittedAt,
  reviewNote,
  reviewedAt,
  submissions,
  onAfterAction,
}: Props) {
  const t = useT();
  const router = useRouter();

  // ---- form state ----
  const [linkUrl, setLinkUrl] = useState("");
  const [note, setNote] = useState("");
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- review state ----
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewing, startReview] = useTransition();

  // ---- toast ----
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isInReview = taskStatus === "in_review";
  const isDone = taskStatus === "done";
  const wasRejected = !!reviewNote && taskStatus === "in_progress";

  // Anyone who can act on this task. The assignee + collaborators are the
  // primary case; the owner (admin) can submit on behalf because they manage
  // every project end-to-end and routinely test the flow.
  const canSubmit = isAssignee || isOwner;

  // The form is shown when the task isn't currently under review or already
  // done AND the viewer is somebody who can submit work on it.
  const showForm = canSubmit && !isInReview && !isDone;
  const showOwnerReview = isOwner && isInReview;

  // ----------------------------------------------------------------------
  // File handling
  // ----------------------------------------------------------------------
  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("submission.tooLarge"));
      return;
    }
    if (!ACCEPT_MIME.split(",").includes(file.type)) {
      setError(t("submission.badType"));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/tasks/upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as
        | { ok: true; url: string; fileName: string; fileType: string; fileSize: number }
        | { error: string };
      if (!res.ok || !("ok" in data)) {
        const msg = "error" in data ? data.error : t("submission.uploadFailed");
        setError(msg);
        return;
      }
      setUploaded({
        url: data.url,
        name: data.fileName,
        type: data.fileType,
        size: data.fileSize,
      });
    } catch {
      setError(t("submission.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const removeFile = () => {
    setUploaded(null);
    setError(null);
  };

  // ----------------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------------
  const onSubmit = async () => {
    setError(null);
    const trimmedLink = linkUrl.trim();
    if (!trimmedLink && !uploaded) {
      setError(t("submission.requireOne"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkUrl: trimmedLink || null,
          fileUrl: uploaded?.url ?? null,
          fileName: uploaded?.name ?? null,
          fileType: uploaded?.type ?? null,
          note: note.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("common.error"));
        return;
      }
      setToast({
        kind: "success",
        message: t("submission.toastSubmitted"),
      });
      router.refresh();
      // Brief delay so the user sees the toast before the modal closes.
      setTimeout(() => onAfterAction?.(), 700);
    } catch {
      setError(t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------------------------
  // Owner: approve / reject
  // ----------------------------------------------------------------------
  const onApprove = () => {
    setError(null);
    startReview(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/approve`, {
          method: "POST",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? t("common.error"));
          return;
        }
        setToast({ kind: "success", message: t("submission.toastApproved") });
        router.refresh();
        setTimeout(() => onAfterAction?.(), 700);
      } catch {
        setError(t("common.error"));
      }
    });
  };

  const onReject = () => {
    if (!reason.trim()) {
      setError(t("submission.reasonRequired"));
      return;
    }
    setError(null);
    startReview(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? t("common.error"));
          return;
        }
        setToast({ kind: "warning", message: t("submission.toastRejected") });
        router.refresh();
        setTimeout(() => onAfterAction?.(), 700);
      } catch {
        setError(t("common.error"));
      }
    });
  };

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  const linkPreviewType = detectLinkType(linkUrl);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-300">
        <Paperclip className="h-3.5 w-3.5 text-emerald-400" />
        {t("submission.title")}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
            toast.kind === "success" &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
            toast.kind === "warning" &&
              "border-amber-500/40 bg-amber-500/10 text-amber-300",
            toast.kind === "error" &&
              "border-rose-500/40 bg-rose-500/10 text-rose-300"
          )}
        >
          {toast.message}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Owner review panel — shown when status is in_review */}
      {showOwnerReview && (
        <ReviewPanel
          submissionUrl={submissionUrl}
          submissionFileUrl={submissionFileUrl}
          submissionFileName={submissionFileName}
          submissionFileType={submissionFileType}
          submissionNote={submissionNote}
          submittedAt={submittedAt}
          rejectMode={rejectMode}
          setRejectMode={setRejectMode}
          reason={reason}
          setReason={setReason}
          onApprove={onApprove}
          onReject={onReject}
          reviewing={reviewing}
          t={t}
        />
      )}

      {/* Assignee waiting view */}
      {isAssignee && isInReview && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            {t("submission.assigneeWaiting")}
          </div>
          <SubmissionPreview
            url={submissionUrl}
            fileUrl={submissionFileUrl}
            fileName={submissionFileName}
            fileType={submissionFileType}
            note={submissionNote}
            t={t}
            compact
          />
        </div>
      )}

      {/* Approved view (status: done) */}
      {isDone && (submissionUrl || submissionFileUrl) && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("submission.approvedHeader")}
          </div>
          <SubmissionPreview
            url={submissionUrl}
            fileUrl={submissionFileUrl}
            fileName={submissionFileName}
            fileType={submissionFileType}
            note={submissionNote}
            t={t}
            compact
          />
        </div>
      )}

      {/* Rejected — show reviewNote prominently above the form so the
          employee sees what they need to fix when they resubmit. */}
      {showForm && wasRejected && (
        <div className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/5 p-3">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-rose-300">
            <CornerDownLeft className="h-3 w-3" />
            {t("submission.changesRequestedHeader")}
          </div>
          <p className="text-xs text-rose-200 whitespace-pre-wrap">
            {reviewNote}
          </p>
          {reviewedAt && (
            <p className="mt-1 text-[10px] text-rose-300/70">
              {new Date(reviewedAt).toLocaleString("en")}
            </p>
          )}
        </div>
      )}

      {/* Submission form — assignee only, when not in_review/done */}
      {showForm && (
        <div className="space-y-3">
          {/* Smart URL field */}
          <div>
            <label
              htmlFor={`sub-url-${taskId}`}
              className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-zinc-400"
            >
              <span className="flex items-center gap-1">
                🔗 {t("submission.urlLabel")}
              </span>
              {linkUrl.trim() && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                    linkPreviewType.toneClass
                  )}
                >
                  <span>{linkPreviewType.icon}</span>
                  <span>{linkPreviewType.label}</span>
                </span>
              )}
            </label>
            <input
              id={`sub-url-${taskId}`}
              type="url"
              dir="ltr"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={t("submission.urlPlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>

          {/* File / image drop zone */}
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-[11px] text-zinc-400">
              📎 {t("submission.fileLabel")}
            </label>
            {!uploaded ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                disabled={uploading}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 transition",
                  uploading
                    ? "cursor-wait border-zinc-700 bg-zinc-900/40"
                    : dragging
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-950/40 hover:border-emerald-500/40 hover:bg-zinc-900/40"
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                    <span className="text-xs text-zinc-400">
                      {t("submission.uploading")}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload
                      className={cn(
                        "h-5 w-5",
                        dragging ? "text-emerald-300" : "text-zinc-500"
                      )}
                    />
                    <span className="text-xs text-zinc-300">
                      {dragging
                        ? t("submission.dropZoneActive")
                        : t("submission.dropZoneIdle")}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {t("submission.fileHint")}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <UploadedPreview
                file={uploaded}
                onRemove={removeFile}
                onReplace={() => fileInputRef.current?.click()}
                t={t}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_EXT}
              onChange={onPickFile}
              className="hidden"
            />
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor={`sub-note-${taskId}`}
              className="mb-1.5 block text-[11px] text-zinc-400"
            >
              {t("submission.noteLabel")}
            </label>
            <textarea
              id={`sub-note-${taskId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t("submission.notePlaceholder")}
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>

          {/* Big emerald submit button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("submission.submitting")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {t("submission.submitButton")}
              </>
            )}
          </button>
        </div>
      )}

      {/* History list — small, collapsed below */}
      {submissions && submissions.length > 0 && (
        <details className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/30 px-3 py-2 text-[11px] text-zinc-400 open:bg-zinc-950/40">
          <summary className="cursor-pointer select-none text-zinc-300">
            {t("submission.history")} · {submissions.length}
          </summary>
          <ul className="mt-2 space-y-1">
            {submissions.slice(0, 10).map((s, idx) => {
              // Display revision label. When the column is null (legacy rows
              // saved before this migration), derive it from order: oldest
              // submission = Revision 1, etc. The list is descending so the
              // last item is the oldest.
              const totalCount = submissions.length;
              const fallbackRev = totalCount - idx;
              const rev = s.revisionNumber ?? fallbackRev;
              const isFinal = totalCount > 1 && idx === 0 && s.status === "approved";
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        isFinal
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-zinc-800/80 text-zinc-300"
                      )}
                      title={`Revision ${rev}`}
                    >
                      {isFinal ? "FINAL" : `R${rev}`}
                    </span>
                    <Clock className="h-3 w-3 text-zinc-500" />
                    {new Date(s.createdAt).toLocaleString("en", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="text-zinc-500">
                    {t(`submission.status.${s.status}`)}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* Empty state — only when the viewer truly has nothing to do (e.g.
          a teammate browsing someone else's task that has no submission). */}
      {!showForm &&
        !showOwnerReview &&
        !isInReview &&
        !isDone &&
        !canSubmit &&
        !(submissionUrl || submissionFileUrl) && (
          <div className="rounded-md border border-dashed border-zinc-800 px-3 py-2 text-[11px] text-zinc-600">
            {t("submission.empty")}
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function UploadedPreview({
  file,
  onRemove,
  onReplace,
  t,
}: {
  file: UploadedFile;
  onRemove: () => void;
  onReplace: () => void;
  t: (key: string) => string;
}) {
  const isImage = file.type.startsWith("image/");
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
      <div className="flex items-start gap-3">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.name}
            className="h-16 w-16 shrink-0 rounded-md border border-zinc-800 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
            <FileText className="h-7 w-7 text-rose-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-zinc-100">
            {file.name}
          </div>
          <div className="text-[10px] text-zinc-500">
            {formatBytes(file.size)} · {file.type.split("/")[1]?.toUpperCase()}
          </div>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onReplace}
              className="text-[10px] text-emerald-400 hover:text-emerald-300"
            >
              {t("submission.replaceFile")}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-0.5 text-[10px] text-rose-400 hover:text-rose-300"
            >
              <Trash2 className="h-3 w-3" />
              {t("submission.removeFile")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubmissionPreview({
  url,
  fileUrl,
  fileName,
  fileType,
  note,
  t,
  compact,
}: {
  url: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  note: string | null;
  t: (key: string) => string;
  compact?: boolean;
}) {
  const linkType = detectLinkType(url);
  const isImage = fileType?.startsWith("image/");

  if (!url && !fileUrl && !note) return null;

  return (
    <div className={cn("space-y-2", compact ? "text-xs" : "text-sm")}>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className={cn(
            "flex w-full items-center gap-2 rounded-md border px-3 py-2 transition hover:brightness-125",
            linkType.toneClass
          )}
        >
          <span className="text-base leading-none">{linkType.icon}</span>
          <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold">
            {linkType.label}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs">{url}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
        </a>
      )}
      {fileUrl && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-stretch gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-2 transition hover:border-emerald-500/40"
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={fileName ?? "preview"}
              className="h-16 w-16 shrink-0 rounded-md border border-zinc-800 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
              <FileText className="h-7 w-7 text-rose-400" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="truncate text-xs font-semibold text-zinc-100">
              {fileName ?? t("submission.attachment")}
            </span>
            <span className="text-[10px] text-zinc-500">
              {(fileType ?? "").split("/")[1]?.toUpperCase() || "FILE"}
            </span>
          </div>
          {isImage ? (
            <ImageIcon className="m-2 h-4 w-4 self-start text-zinc-600" />
          ) : (
            <FileText className="m-2 h-4 w-4 self-start text-zinc-600" />
          )}
        </a>
      )}
      {note && (
        <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300 whitespace-pre-wrap">
          {note}
        </div>
      )}
    </div>
  );
}

function ReviewPanel({
  submissionUrl,
  submissionFileUrl,
  submissionFileName,
  submissionFileType,
  submissionNote,
  submittedAt,
  rejectMode,
  setRejectMode,
  reason,
  setReason,
  onApprove,
  onReject,
  reviewing,
  t,
}: {
  submissionUrl: string | null;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
  submissionFileType: string | null;
  submissionNote: string | null;
  submittedAt: Date | string | null;
  rejectMode: boolean;
  setRejectMode: (v: boolean) => void;
  reason: string;
  setReason: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  reviewing: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
        <span className="font-semibold">{t("submission.reviewTitle")}</span>
        {submittedAt && (
          <span className="ms-auto text-[10px] text-amber-300/80">
            {new Date(submittedAt).toLocaleString("en", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        )}
      </div>

      <SubmissionPreview
        url={submissionUrl}
        fileUrl={submissionFileUrl}
        fileName={submissionFileName}
        fileType={submissionFileType}
        note={submissionNote}
        t={t}
      />

      {!rejectMode ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={reviewing}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reviewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {t("submission.approveButton")}
          </button>
          <button
            type="button"
            onClick={() => setRejectMode(true)}
            disabled={reviewing}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-sm font-bold text-rose-950 shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CornerDownLeft className="h-4 w-4" />
            {t("submission.rejectButton")}
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder={t("submission.reasonPlaceholderRich")}
            className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-rose-500/60 focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectMode(false);
                setReason("");
              }}
              disabled={reviewing}
              className="flex items-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-400 hover:bg-zinc-800"
            >
              <X className="h-3 w-3" />
              {t("action.cancel")}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={reviewing}
              className="flex items-center gap-1 rounded-md bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-rose-950 hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reviewing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {t("submission.send")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

```

---

## `instrumentation.ts`

**Lines:** 61

```tsx
// Runs once when the Next.js server boots. We use it to start the smart backup
// scheduler — the only background process the app needs in real (Phase 2) mode.
//
// Restricted to `nodejs` runtime — the scheduler uses better-sqlite3 + setInterval
// which don't exist in the edge runtime.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip in build phase — Next runs `register()` once during `next build` to
  // collect telemetry, and we don't want to spawn timers from a build process.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Allow ops to disable the scheduler via env if they ever need to.
  if (process.env.SRB_DISABLE_AUTO_BACKUP === "1") {
    console.log("[instrumentation] auto backup disabled via SRB_DISABLE_AUTO_BACKUP");
    return;
  }

  // Seed the default skill badges if missing — idempotent.
  try {
    const { ensureDefaultBadges } = await import("./lib/db/badges");
    await ensureDefaultBadges();
  } catch (err) {
    console.error("[instrumentation] ensureDefaultBadges failed:", err);
  }

  // One-shot data migration — the deprecated `head` (رئيس جميع الأقسام)
  // role was removed in favour of a flat 4-tier hierarchy (admin / manager
  // / department_lead / employee). Any account still flagged as `head` is
  // promoted to `manager` so it keeps working with no manual intervention.
  // Idempotent: the WHERE clause matches zero rows once the migration has
  // run, so subsequent boots are no-ops.
  try {
    const { prisma } = await import("./lib/db/prisma");
    const migrated = await prisma.user.updateMany({
      where: { role: "head" },
      data: { role: "manager" },
    });
    if (migrated.count > 0) {
      console.log(
        `[instrumentation] migrated ${migrated.count} 'head' user(s) → 'manager'`
      );
    }
  } catch (err) {
    console.error("[instrumentation] head→manager migration failed:", err);
  }

  const { startScheduler } = await import("./lib/db/backup-scheduler");
  startScheduler();

  // Reminder scheduler — fires meeting / shoot / task / invoice alerts every
  // minute regardless of whether anyone has the page open. This is the
  // pipeline that delivers Web Push to phones.
  try {
    const { startReminderScheduler } = await import("./lib/reminders/scheduler");
    startReminderScheduler();
  } catch (err) {
    console.error("[instrumentation] reminder scheduler failed to start:", err);
  }
}

```

---

## `lib/auth-guards.ts`

**Lines:** 106

```tsx
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

```

---

## `lib/auth/permissions.ts`

**Lines:** 429

```tsx
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
  "clients",
  "freelancers",
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
    key: "clients",
    labelAr: "العملاء",
    labelEn: "Clients",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "freelancers",
    labelAr: "الفري لانسر",
    labelEn: "Freelancers",
    // "approve" doubles as "mark a payment as paid" — only the owner +
    // manager get it by default so a dept_lead can ADD a freelancer and
    // record the agreed amount but can't actually move money.
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
  // Clients (CRM)
  p("clients", "view"),
  p("clients", "create"),
  p("clients", "edit"),
  p("clients", "delete"),
  // Freelancers — full control for manager (records payments).
  p("freelancers", "view"),
  p("freelancers", "create"),
  p("freelancers", "edit"),
  p("freelancers", "delete"),
  p("freelancers", "approve"),
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

// Team lead (رئيس الفريق) — manages their team's pipeline.
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
  // Clients — dept lead manages the CRM for the projects they run;
  // delete is held back to manager+ to keep the company's contact book stable.
  p("clients", "view"),
  p("clients", "create"),
  p("clients", "edit"),
  // Dept lead can hire and edit freelancers in their dept; "approve"
  // (= mark a payment as paid) stays manager+ to keep money moves locked.
  p("freelancers", "view"),
  p("freelancers", "create"),
  p("freelancers", "edit"),
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
  p("clients", "view"),
  p("shoots", "view"),
  p("meetings", "view"),
  p("equipment", "view"),
  p("team", "view"),
  p("projects", "view"),
]);

const ROLE_DEFAULTS: Record<Role, PermissionSet> = {
  admin: OWNER_PERMS,
  manager: MANAGER_PERMS,
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

```

---

## `lib/auth/roles.ts`

**Lines:** 107

```tsx
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

```

---

## `lib/db/audit.ts`

**Lines:** 222

```tsx
// Audit log helper — every sensitive mutation should call logAudit so the
// admin can later see who did what, when, and against which target.
//
// Design notes:
// - actorEmail is snapshotted because actors can be deleted while history stays.
// - metadata is JSON-stringified (SQLite has no native JSON column in this schema).
// - Failures to log are swallowed (best-effort) — we never block a user action
//   just because logging failed. Real production would alert on this instead.

import { prisma } from "./prisma";
import { auth } from "@/auth";

export type AuditAction =
  // User management
  | "user.create"
  | "user.approve"
  | "user.reject"
  | "user.delete"
  | "user.deactivate"
  | "user.activate"
  | "user.role_change"
  | "user.department_change"
  | "user.profile_change"
  | "user.badge_add"
  | "user.badge_remove"
  // Permission overrides — Owner-only Permission Control Panel
  | "permission.grant"
  | "permission.revoke"
  | "permission.reset"
  // Project
  | "project.create"
  | "project.update"
  | "project.delete"
  | "project.status_change"
  | "project.member_add"
  | "project.member_remove"
  // Task
  | "task.create"
  | "task.update"
  | "task.delete"
  | "task.assignee_change"
  | "task.status_change"
  // Meeting
  | "meeting.create"
  | "meeting.update"
  | "meeting.delete"
  // Photo shoot
  | "shoot.create"
  | "shoot.update"
  | "shoot.delete"
  // Equipment
  | "equipment.create"
  | "equipment.update"
  | "equipment.delete"
  | "equipment.checkout"
  // Finance
  | "tx.create"
  | "tx.update"
  | "tx.delete"
  // Client (CRM)
  | "client.create"
  | "client.update"
  | "client.delete"
  // Backup
  | "backup.run";

export interface AuditTarget {
  type:
    | "user"
    | "project"
    | "task"
    | "transaction"
    | "backup"
    | "meeting"
    | "shoot"
    | "equipment"
    | "client";
  id?: string | null;
  label?: string | null;
}

export async function logAudit(args: {
  action: AuditAction;
  target?: AuditTarget;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorEmail?: string | null;
}) {
  try {
    let actorId = args.actorId ?? null;
    let actorEmail = args.actorEmail ?? null;
    if (!actorEmail) {
      const session = await auth();
      actorId = actorId ?? session?.user?.id ?? null;
      actorEmail = session?.user?.email ?? "system";
    }

    await prisma.auditLog.create({
      data: {
        actorId,
        actorEmail: actorEmail ?? "system",
        action: args.action,
        targetType: args.target?.type ?? null,
        targetId: args.target?.id ?? null,
        targetLabel: args.target?.label ?? null,
        metadata: args.metadata ? JSON.stringify(args.metadata) : null,
      },
    });
  } catch (err) {
    // Don't break user actions if logging fails.
    console.error("[audit] failed to write log entry:", err);
  }
}

/** Parse stored metadata back to an object (or null if malformed). */
export function parseAuditMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Human-readable label for an action (Arabic). */
export const AUDIT_ACTION_LABEL_AR: Record<AuditAction, string> = {
  "user.create": "إنشاء حساب",
  "user.approve": "تفعيل حساب",
  "user.reject": "رفض وحذف طلب",
  "user.delete": "حذف حساب",
  "user.deactivate": "تعطيل حساب",
  "user.activate": "تفعيل حساب",
  "user.role_change": "تغيير الدور",
  "user.department_change": "تغيير القسم",
  "user.profile_change": "تعديل بيانات موظف",
  "user.badge_add": "إضافة شارة",
  "user.badge_remove": "إزالة شارة",
  "permission.grant": "منح صلاحية",
  "permission.revoke": "سحب صلاحية",
  "permission.reset": "إرجاع الصلاحية للافتراضي",
  "project.create": "إنشاء مشروع",
  "project.update": "تعديل مشروع",
  "project.delete": "حذف مشروع",
  "project.status_change": "تغيير حالة مشروع",
  "project.member_add": "إضافة عضو للمشروع",
  "project.member_remove": "حذف عضو من المشروع",
  "task.create": "إنشاء مهمة",
  "task.update": "تعديل مهمة",
  "task.delete": "حذف مهمة",
  "task.assignee_change": "تغيير مسؤول المهمة",
  "task.status_change": "تغيير حالة المهمة",
  "meeting.create": "إنشاء اجتماع",
  "meeting.update": "تعديل اجتماع",
  "meeting.delete": "حذف اجتماع",
  "shoot.create": "إنشاء جلسة تصوير",
  "shoot.update": "تعديل جلسة تصوير",
  "shoot.delete": "حذف جلسة تصوير",
  "equipment.create": "إضافة معدات",
  "equipment.update": "تعديل معدات",
  "equipment.delete": "حذف معدات",
  "equipment.checkout": "استلام / تسليم معدات",
  "tx.create": "إضافة معاملة مالية",
  "tx.update": "تعديل معاملة مالية",
  "tx.delete": "حذف معاملة مالية",
  "client.create": "إضافة عميل",
  "client.update": "تعديل بيانات عميل",
  "client.delete": "حذف عميل",
  "backup.run": "نسخ احتياطي",
};

export const AUDIT_ACTION_LABEL_EN: Record<AuditAction, string> = {
  "user.create": "Create account",
  "user.approve": "Approve account",
  "user.reject": "Reject & delete request",
  "user.delete": "Delete account",
  "user.deactivate": "Deactivate account",
  "user.activate": "Activate account",
  "user.role_change": "Change role",
  "user.department_change": "Change department",
  "user.profile_change": "Update employee profile",
  "user.badge_add": "Add badge",
  "user.badge_remove": "Remove badge",
  "permission.grant": "Grant permission",
  "permission.revoke": "Revoke permission",
  "permission.reset": "Reset permission to default",
  "project.create": "Create project",
  "project.update": "Update project",
  "project.delete": "Delete project",
  "project.status_change": "Change project status",
  "project.member_add": "Add project member",
  "project.member_remove": "Remove project member",
  "task.create": "Create task",
  "task.update": "Update task",
  "task.delete": "Delete task",
  "task.assignee_change": "Change task assignee",
  "task.status_change": "Change task status",
  "meeting.create": "Create meeting",
  "meeting.update": "Update meeting",
  "meeting.delete": "Delete meeting",
  "shoot.create": "Create photo shoot",
  "shoot.update": "Update photo shoot",
  "shoot.delete": "Delete photo shoot",
  "equipment.create": "Add equipment",
  "equipment.update": "Update equipment",
  "equipment.delete": "Delete equipment",
  "equipment.checkout": "Equipment check-out / return",
  "tx.create": "Add transaction",
  "tx.update": "Update transaction",
  "tx.delete": "Delete transaction",
  "client.create": "Add client",
  "client.update": "Update client",
  "client.delete": "Delete client",
  "backup.run": "Backup",
};

export function auditActionLabel(
  action: string,
  locale: "ar" | "en"
): string {
  const map = locale === "en" ? AUDIT_ACTION_LABEL_EN : AUDIT_ACTION_LABEL_AR;
  return (map as Record<string, string>)[action] ?? action;
}

```

---

## `lib/db/brief.ts`

**Lines:** 107

```tsx
// Project creative brief — single-record-per-project helper layer.

import { prisma } from "./prisma";

export interface BriefFields {
  objective: string | null;
  targetAudience: string | null;
  styleNotes: string | null;
  refs: string | null;
  deliverables: string | null;
  platforms: string | null;
  sizes: string | null;
  notes: string | null;
}

const FIELD_KEYS = [
  "objective",
  "targetAudience",
  "styleNotes",
  "refs",
  "deliverables",
  "platforms",
  "sizes",
  "notes",
] as const;

export function emptyBrief(): BriefFields {
  return {
    objective: null,
    targetAudience: null,
    styleNotes: null,
    refs: null,
    deliverables: null,
    platforms: null,
    sizes: null,
    notes: null,
  };
}

export async function getBrief(projectId: string) {
  return prisma.projectBrief.findUnique({
    where: { projectId },
    include: { approvedBy: { select: { id: true, name: true } } },
  });
}

export async function upsertBrief(args: {
  projectId: string;
  patch: Partial<BriefFields>;
}) {
  const data: Partial<BriefFields> = {};
  for (const key of FIELD_KEYS) {
    if (key in args.patch) {
      const val = args.patch[key];
      data[key] = val === null ? null : (val ?? "").trim() || null;
    }
  }

  return prisma.projectBrief.upsert({
    where: { projectId: args.projectId },
    create: {
      projectId: args.projectId,
      ...data,
    },
    update: data,
  });
}

/**
 * Generate a short Arabic + English summary of the brief, suitable for
 * pasting into a meeting agenda. We don't call out to an AI — the summary
 * is built mechanically from the populated fields.
 */
export function summarizeBrief(brief: BriefFields, locale: "ar" | "en"): string {
  const lines: string[] = [];
  const isAr = locale === "ar";
  const push = (label: string, value: string | null | undefined) => {
    if (!value) return;
    const cleaned = value.trim();
    if (!cleaned) return;
    lines.push(`${label}: ${cleaned.split("\n").join(" ")}`);
  };
  push(isAr ? "الهدف" : "Objective", brief.objective);
  push(isAr ? "الجمهور" : "Audience", brief.targetAudience);
  push(isAr ? "الستايل" : "Style", brief.styleNotes);
  push(isAr ? "المخرجات" : "Deliverables", brief.deliverables);
  push(isAr ? "المنصات" : "Platforms", brief.platforms);
  push(isAr ? "المقاسات" : "Sizes", brief.sizes);
  push(isAr ? "ملاحظات" : "Notes", brief.notes);
  if (lines.length === 0) {
    return isAr
      ? "لا يوجد بريف بعد — املأ الحقول المطلوبة على الأقل (الهدف، الجمهور، المخرجات)."
      : "No brief yet — fill at least objective, audience, and deliverables.";
  }
  return lines.join("\n");
}

/** Count how many fields are populated — used for the % completion ring. */
export function briefCompletion(brief: BriefFields): number {
  const total = FIELD_KEYS.length;
  let filled = 0;
  for (const k of FIELD_KEYS) {
    const v = brief[k];
    if (typeof v === "string" && v.trim().length > 0) filled++;
  }
  return Math.round((filled / total) * 100);
}

```

---

## `lib/db/helpers.ts`

**Lines:** 123

```tsx
// Shared helpers for Arabic labels + formatters used across pages.

export const ROLE_LABEL: Record<string, string> = {
  admin: "الرئيس",
  manager: "المدير",
  department_lead: "رئيس الفريق",
  employee: "الموظف",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  on_hold: "موقّف مؤقتاً",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  on_hold: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  completed: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  cancelled: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
};

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  video: "فيديو",
  photo: "تصوير",
  event: "فعالية",
  digital_campaign: "حملة رقمية",
  web: "ويب",
  design: "ديزاين",
  branding: "إنشاء علامة تجارية",
  other: "غير ذلك",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "مرتفعة",
  urgent: "عاجلة",
};

export const PRIORITY_COLOR: Record<string, string> = {
  low: "text-zinc-400",
  normal: "text-zinc-300",
  high: "text-amber-400",
  urgent: "text-rose-400",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "قيد الانتظار",
  in_progress: "قيد العمل",
  in_review: "قيد المراجعة",
  done: "مكتمل",
  blocked: "معلّق",
};

export const TASK_STATUS_COLOR: Record<string, string> = {
  todo: "border-zinc-700",
  in_progress: "border-sky-500/40",
  in_review: "border-amber-500/40",
  done: "border-emerald-500/40",
  blocked: "border-rose-500/40",
};

export const TRANSACTION_CATEGORY_LABEL: Record<string, string> = {
  project_payment: "دفعة مشروع",
  salary: "راتب",
  bonus: "بونص",
  freelance: "فري لانس",
  tool: "أدوات/اشتراكات",
  ad: "إعلانات",
  overhead: "مصاريف عامة",
  refund: "ارتجاع/خسارة",
  other: "غير ذلك",
};

export const BILLING_TYPE_LABEL: Record<string, string> = {
  one_time: "مرة واحدة",
  monthly: "شهري متكرر",
};

export const RECURRENCE_LABEL: Record<string, string> = {
  none: "مرة واحدة",
  monthly: "شهري",
};

// Categories that typically recur monthly. UI defaults them to `monthly`.
export const MONTHLY_DEFAULT_CATEGORIES = new Set(["salary", "overhead", "tool"]);

export function formatQar(
  n: number,
  opts: { sign?: boolean; locale?: "ar" | "en" } = {}
): string {
  const sign = opts.sign && n > 0 ? "+" : "";
  const abs = Math.abs(Math.round(n));
  const currency = opts.locale === "en" ? "QAR" : "ر.ق";
  return `${n < 0 ? "−" : sign}${abs.toLocaleString("en")} ${currency}`;
}

export function formatDate(
  d: Date | null | undefined,
  locale: "ar" | "en" = "ar"
): string {
  if (!d) return "—";
  const bcp = locale === "en" ? "en-US" : "en"; // keep digits western in both
  return new Date(d).toLocaleDateString(bcp, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(dueAt: Date | null | undefined, status?: string): boolean {
  if (!dueAt) return false;
  if (status === "done" || status === "cancelled") return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function daysUntil(dueAt: Date | null | undefined): number | null {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - Date.now();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

```

---

## `lib/db/permissions.ts`

**Lines:** 73

```tsx
// Prisma-backed CRUD for the PermissionOverride table. Used by the Owner's
// Permission Control Panel and by server-side permission checks.

import { prisma } from "./prisma";
import type { Module, Action, OverrideEntry } from "@/lib/auth/permissions";

export async function getUserOverrides(userId: string): Promise<OverrideEntry[]> {
  const rows = await prisma.permissionOverride.findMany({
    where: { userId },
    select: { module: true, action: true, allowed: true },
  });
  return rows;
}

/**
 * Set or clear a single override cell.
 *   - `allowed = true | false` → upsert with that value
 *   - `allowed = null`         → delete the row (revert to role default)
 *
 * Returns the new effective value for that cell (after the change).
 */
export async function setUserOverride(args: {
  userId: string;
  module: Module;
  action: Action;
  allowed: boolean | null;
  grantedById: string | null;
  reason?: string | null;
}): Promise<{ cleared: boolean; allowed: boolean | null }> {
  const { userId, module, action, allowed, grantedById, reason } = args;

  if (allowed === null) {
    await prisma.permissionOverride.deleteMany({
      where: { userId, module, action },
    });
    return { cleared: true, allowed: null };
  }

  await prisma.permissionOverride.upsert({
    where: { userId_module_action: { userId, module, action } },
    create: {
      userId,
      module,
      action,
      allowed,
      grantedById: grantedById ?? null,
      reason: reason ?? null,
    },
    update: {
      allowed,
      grantedById: grantedById ?? null,
      reason: reason ?? null,
    },
  });

  return { cleared: false, allowed };
}

/** Bulk fetch overrides for several users at once (for the admin grid). */
export async function listOverridesForUsers(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, OverrideEntry[]>();
  const rows = await prisma.permissionOverride.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, module: true, action: true, allowed: true },
  });
  const map = new Map<string, OverrideEntry[]>();
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push({ module: r.module, action: r.action, allowed: r.allowed });
    map.set(r.userId, list);
  }
  return map;
}

```

---

## `lib/i18n/dict.ts`

**Lines:** 1554

```tsx
// Translation dictionary.
// Keys are flat dot-paths. English is the fallback if a key is missing.
// Add new keys as you translate more of the UI.

export type Locale = "ar" | "en";

export const LOCALES: Locale[] = ["ar", "en"];

export const DICT: Record<string, { ar: string; en: string }> = {
  // Brand + chrome
  "brand.system": { ar: "نظام الإدارة الداخلي", en: "Internal management system" },
  "brand.tagline.simulation": { ar: "محاكاة · مرحلة 1", en: "Simulation · Phase 1" },
  "app.date.prefix": { ar: "", en: "" },

  // Navigation
  "nav.overview": { ar: "نظرة عامة", en: "Overview" },
  "nav.projects": { ar: "المشاريع", en: "Projects" },
  "nav.tasks": { ar: "المهام", en: "Tasks" },
  "nav.team": { ar: "الفريق", en: "Team" },
  "nav.finance": { ar: "المالية", en: "Finance" },
  "nav.reports": { ar: "التقارير", en: "Reports" },
  "nav.admin_users": { ar: "إدارة الحسابات", en: "User management" },

  // Roles — labels reflect the 4-tier hierarchy: الرئيس (admin/owner) →
  // المدير (manager) → رئيس الفريق (department_lead) → الموظف (employee).
  // DB role value `admin` represents the owner tier.
  "role.admin": { ar: "الرئيس", en: "President" },
  "role.manager": { ar: "المدير", en: "Manager" },
  "role.department_lead": { ar: "رئيس الفريق", en: "Team lead" },
  "role.employee": { ar: "الموظف", en: "Employee" },

  // Auth
  "auth.signout": { ar: "تسجيل خروج", en: "Sign out" },
  "auth.signin.google": { ar: "Sign in with Google", en: "Sign in with Google" },

  // Page titles
  "page.overview.title": { ar: "نظرة عامة", en: "Overview" },
  "page.overview.greeting": { ar: "أهلاً", en: "Hi" },
  "page.overview.subtitleFresh": {
    ar: "هذي أول مرة — ابدأ بإضافة موظفينك ومشاريعك",
    en: "First time here — start by adding your team and projects",
  },
  "page.overview.subtitle": {
    ar: "إليك ملخص شركتك آخر 30 يوم",
    en: "Here's your company's last 30 days",
  },
  "page.projects.title": { ar: "المشاريع", en: "Projects" },
  "page.projects.subtitle": {
    ar: "إدارة كاملة للمشاريع وفِرقها",
    en: "Full project & team management",
  },
  "page.tasks.title": { ar: "المهام", en: "Tasks" },
  "page.tasks.clickToEdit": {
    ar: "اضغط أي بطاقة للتعديل الكامل",
    en: "Click any card to edit",
  },
  "page.team.title": { ar: "الفريق", en: "Team" },
  "page.team.subtitle": {
    ar: "حمل كل موظف ومسؤولياته",
    en: "Workload and responsibilities per employee",
  },
  "page.finance.title": { ar: "المحاسبة", en: "Finance" },
  "page.finance.subtitle": {
    ar: "إيرادات ومصروفات · معاملات شهرية متكررة · مشاريع شهرية · تحليل المخاطر",
    en: "Revenue & expenses · Recurring monthly · Monthly projects · Risk analysis",
  },
  "page.admin.title": { ar: "إدارة الحسابات", en: "User management" },

  // Common actions
  "action.new": { ar: "جديد", en: "New" },
  "action.newProject": { ar: "مشروع جديد", en: "New project" },
  "action.newTask": { ar: "مهمة جديدة", en: "New task" },
  "action.newTransaction": { ar: "معاملة جديدة", en: "New transaction" },
  "action.addEmployee": { ar: "أضف موظف", en: "Add employee" },
  "action.recordTransaction": { ar: "سجّل معاملة", en: "Record transaction" },
  "action.save": { ar: "احفظ", en: "Save" },
  "action.cancel": { ar: "إلغاء", en: "Cancel" },
  "action.delete": { ar: "حذف", en: "Delete" },
  "action.edit": { ar: "تعديل", en: "Edit" },
  "action.close": { ar: "إغلاق", en: "Close" },
  "action.confirm": { ar: "تأكيد", en: "Confirm" },
  "action.back": { ar: "رجوع", en: "Back" },

  // Overview
  "kpi.activeProjects": { ar: "مشاريع نشطة", en: "Active projects" },
  "kpi.openTasks": { ar: "مهام مفتوحة", en: "Open tasks" },
  "kpi.overdueTasks": { ar: "مهام متأخرة", en: "Overdue tasks" },
  "kpi.teamSize": { ar: "الفريق", en: "Team" },
  "kpi.activeContracts": { ar: "قيمة العقود النشطة", en: "Active contracts" },
  "kpi.activeContractsSub": {
    ar: "إجمالي ميزانيات المشاريع النشطة",
    en: "Sum of active project budgets",
  },
  "kpi.revenue30": { ar: "إيرادات (30ي)", en: "Revenue (30d)" },
  "kpi.net30": { ar: "صافي (30ي)", en: "Net (30d)" },

  // Misc
  "state.noData": { ar: "ما فيه بيانات بعد", en: "No data yet" },
  "common.quickActions": { ar: "إجراءات سريعة", en: "Quick actions" },
  "common.delayed": { ar: "متأخرة", en: "Overdue" },
  "common.onSchedule": { ar: "ضمن الموعد", en: "On schedule" },
  "common.activeEmployees": { ar: "موظف نشط", en: "active" },
  "common.setupStart": { ar: "ابدأ الإعداد", en: "Start setup" },
  "common.setupDesc": {
    ar: "نظامك جاهز — بس محتاج شوية إعداد أولي. خطوتين وتكون جاهز:",
    en: "Your system is ready — just needs some setup. A few steps and you're live:",
  },
  "common.expensesLabel": { ar: "مصروفات", en: "Expenses" },
  "common.margin": { ar: "هامش", en: "Margin" },
  "common.deltaVsPrev": { ar: "عن الفترة السابقة", en: "vs previous period" },

  // Overview-specific
  "overview.userFallback": { ar: "مدير", en: "Admin" },
  "overview.setup.team.title": { ar: "ضيف فريقك", en: "Add your team" },
  "overview.setup.team.desc": {
    ar: "حسابات الموظفين بجيميلاتهم",
    en: "Create accounts for your employees by Gmail",
  },
  "overview.setup.team.cta": { ar: "إدارة الحسابات", en: "User management" },
  "overview.setup.project.title": { ar: "ضيف أول مشروع", en: "Create first project" },
  "overview.setup.project.desc": {
    ar: "اسم، عميل، ديدلاين، وفريق",
    en: "Name, client, deadline, and team",
  },
  "overview.setup.project.cta": { ar: "المشاريع", en: "Projects" },
  "overview.setup.tasks.title": { ar: "ضيف المهام", en: "Add tasks" },
  "overview.setup.tasks.desc": {
    ar: "Kanban مع موعد تسليم لكل مهمة",
    en: "Kanban with due date on each task",
  },
  "overview.setup.tasks.cta": { ar: "المهام", en: "Tasks" },

  // Finance-specific
  "finance.commitments.title": {
    ar: "الالتزامات الشهرية الثابتة (كل شهر تلقائياً)",
    en: "Fixed monthly commitments (auto each month)",
  },
  "finance.commitments.income": { ar: "دخل شهري ثابت", en: "Fixed monthly income" },
  "finance.commitments.incomeSub": {
    ar: "معاملات متكررة + مشاريع شهرية",
    en: "Recurring transactions + monthly projects",
  },
  "finance.commitments.expense": { ar: "مصروف شهري ثابت", en: "Fixed monthly expense" },
  "finance.commitments.expenseSub": {
    ar: "رواتب + اشتراكات + إيجار",
    en: "Salaries + subscriptions + rent",
  },
  "finance.commitments.net": { ar: "صافي شهري متوقع", en: "Expected monthly net" },
  "finance.commitments.netSub": {
    ar: "قبل أي دخل/مصروف إضافي",
    en: "Before any ad-hoc income/expense",
  },
  "finance.period.income": { ar: "الإيرادات", en: "Revenue" },
  "finance.period.expense": { ar: "المصروفات", en: "Expenses" },
  "finance.period.net": { ar: "صافي الربح", en: "Net profit" },
  "finance.period.txCount": { ar: "عدد المعاملات", en: "Transactions" },
  "finance.period.inSystem": { ar: "في النظام", en: "in system" },
  "finance.risk.title": { ar: "تحليل المخاطر", en: "Risk analysis" },
  "finance.monthlyProjects.title": { ar: "مشاريع شهرية نشطة", en: "Active monthly projects" },
  "finance.recent.title": { ar: "المعاملات المسجّلة", en: "Recorded transactions" },
  "finance.empty.title": { ar: "ما فيه معاملات بعد", en: "No transactions yet" },
  "finance.empty.desc": {
    ar: "اضغط \"معاملة جديدة\" لتسجّل راتب شهري متكرر أو دفعة لمرة واحدة.",
    en: "Click \"New transaction\" to record a recurring salary or one-time payment.",
  },
  "finance.period.week": { ar: "أسبوع", en: "Week" },
  "finance.period.month": { ar: "شهر", en: "Month" },
  "finance.period.quarter": { ar: "3 أشهر", en: "3 months" },
  "finance.period.year": { ar: "سنة", en: "Year" },

  // Table headers (shared)
  "table.date": { ar: "التاريخ", en: "Date" },
  "table.type": { ar: "النوع", en: "Type" },
  "table.category": { ar: "الفئة", en: "Category" },
  "table.recurrence": { ar: "التكرار", en: "Recurrence" },
  "table.description": { ar: "الوصف", en: "Description" },
  "table.project": { ar: "المشروع", en: "Project" },
  "table.amount": { ar: "المبلغ", en: "Amount" },

  "tx.income": { ar: "دخل", en: "Income" },
  "tx.expense": { ar: "مصروف", en: "Expense" },
  "tx.oneTime": { ar: "مرة واحدة", en: "One-time" },
  "tx.monthly": { ar: "شهري", en: "Monthly" },

  // Projects page
  "projects.count": { ar: "مشروع", en: "project(s)" },
  "projects.empty.title": { ar: "ما فيه مشاريع بعد", en: "No projects yet" },
  "projects.empty.desc": {
    ar: "اضغط \"مشروع جديد\" فوق لتبدأ.",
    en: "Click \"New project\" above to get started.",
  },

  // Tasks page
  "tasks.overdue": { ar: "متأخرة", en: "overdue" },
  "tasks.count": { ar: "مهمة", en: "task(s)" },
  "tasks.empty.title": { ar: "ما فيه مهام بعد", en: "No tasks yet" },
  "tasks.empty.desc": {
    ar: "اضغط \"مهمة جديدة\" لتبدأ.",
    en: "Click \"New task\" to get started.",
  },

  // Team page
  "team.count": { ar: "موظف نشط", en: "active employees" },
  "team.empty.title": { ar: "ما فيه موظفين بعد", en: "No employees yet" },
  "team.empty.desc": {
    ar: "روح لـ \"إدارة الحسابات\" وضيف موظفينك.",
    en: "Go to \"User management\" and add your employees.",
  },
  "team.stats.projects": { ar: "مشاريع", en: "Projects" },
  "team.stats.openTasks": { ar: "مهام مفتوحة", en: "Open tasks" },
  "team.stats.overdue": { ar: "متأخرة", en: "Overdue" },
  "team.salary": { ar: "راتب", en: "Salary" },
  "team.overdueBadge": { ar: "مهمة متأخرة", en: "overdue task(s)" },
  "team.viewDetails": { ar: "تفاصيل وتعديل مهامه", en: "Details & edit tasks" },

  // Admin Users page
  "admin.accountsCount": { ar: "حساب", en: "account(s)" },
  "admin.subtitle": {
    ar: "إضافة / حذف / تغيير الدور والقسم",
    en: "Add / remove / change role and department",
  },
  "admin.denied.title": { ar: "🚫 ممنوع الوصول", en: "🚫 Access denied" },
  "admin.denied.desc": {
    ar: "هذي الصفحة للمدير فقط.",
    en: "This page is for admins only.",
  },

  // Pending approval gate
  "pending.title": {
    ar: "حسابك قيد المراجعة",
    en: "Your account is awaiting approval",
  },
  "pending.body": {
    ar: "سجّلت دخولك بنجاح. المدير بيراجع حسابك ويحدد صلاحياتك قريباً. تقدر تسكّر هالصفحة وترجعلها لاحقاً.",
    en: "You're signed in. The admin will review your account and grant the right permissions shortly. You can close this page and come back later.",
  },
  "pending.nudge": {
    ar: "لو مستعجل، كلّم المدير وقله يفعّل حسابك.",
    en: "If it's urgent, ping the admin to activate your account.",
  },
  "pending.disabled": {
    ar: "حسابك معطّل حالياً من المدير.",
    en: "Your account has been disabled by the admin.",
  },

  // Admin — pending queue section
  "admin.pending.title": {
    ar: "طلبات تسجيل جديدة",
    en: "New sign-in requests",
  },
  "admin.pending.desc": {
    ar: "هؤلاء سجّلوا دخول بجيميلاتهم وينتظرون تفعيل حساباتهم.",
    en: "These users signed in with Google and are waiting for activation.",
  },
  "admin.pending.empty": {
    ar: "ما فيه طلبات جديدة.",
    en: "No new requests.",
  },
  "admin.pending.approve": { ar: "تفعيل", en: "Approve" },
  "admin.pending.reject": { ar: "رفض + حذف", en: "Reject & delete" },
  "admin.pending.roleLabel": { ar: "الدور", en: "Role" },
  "admin.pending.deptLabel": { ar: "القسم (اختياري)", en: "Department (optional)" },
  "admin.pending.approvedToast": {
    ar: "تم تفعيل الحساب",
    en: "Account approved",
  },
  "admin.pending.rejectedToast": {
    ar: "تم حذف الطلب",
    en: "Request deleted",
  },

  // Finance — employee-view gate
  "finance.employee.title": {
    ar: "تسجيل المعاملات",
    en: "Record transactions",
  },
  "finance.employee.subtitle": {
    ar: "تقدر تسجّل المعاملات والمبالغ هنا. الإجماليات والأرقام الإدارية تظهر للمدير فقط.",
    en: "You can record transactions and amounts here. Totals and financial reports are visible to the admin only.",
  },
  "finance.employee.cta": {
    ar: "اضغط \"معاملة جديدة\" فوق لتسجيل دفعة أو مصروف. المدير راح يراجعها.",
    en: "Click \"New transaction\" above to record a payment or expense. The admin will review it.",
  },

  // Projects labels
  "projects.subtitle": {
    ar: "إدارة كاملة للمشاريع وفِرقها",
    en: "Full project & team management",
  },
  "projects.empty.desc.full": {
    ar: "اضغط \"مشروع جديد\" فوق لتبدأ. كل مشروع بتحدد له عميل، ميزانية، deadline، وفريق.",
    en: "Click \"New project\" above to start. Set a client, budget, deadline, and team for each project.",
  },
  "projects.progress": { ar: "التقدم", en: "Progress" },
  "projects.taskWord": { ar: "مهمة", en: "task(s)" },
  "projects.priorityPrefix": { ar: "أولوية", en: "Priority:" },
  "projects.perMonth": { ar: "/شهر", en: "/mo" },
  "projects.monthly": { ar: "شهري", en: "Monthly" },
  "projects.oneTime": { ar: "لمرة واحدة", en: "One-time" },

  // Tasks labels
  "tasks.clickToEdit": {
    ar: "اضغط أي بطاقة للتعديل الكامل",
    en: "Click any card to edit",
  },
  "tasks.empty.desc.full": {
    ar: "اضغط \"مهمة جديدة\" فوق لتبدأ. تقدر تربطها بمشروع وتعيّن مسؤول، وموعد تسليم، وأولوية، وموظفين إضافيين.",
    en: "Click \"New task\" above to start. Link it to a project, assign an owner, set a due date, priority, and extra collaborators.",
  },

  // Finance labels
  "finance.revenueLabel": { ar: "الإيرادات", en: "Revenue" },
  "finance.expensesLabel": { ar: "المصروفات", en: "Expenses" },
  "finance.netProfit": { ar: "صافي الربح", en: "Net profit" },
  "finance.txCount": { ar: "عدد المعاملات", en: "Transactions" },
  "finance.inSystem": { ar: "في النظام", en: "in system" },
  "finance.marginLabel": { ar: "هامش", en: "Margin" },
  "finance.ofWhich": { ar: "منها", en: "of which" },
  "finance.fromMonthlyProjects": {
    ar: "من مشاريع شهرية",
    en: "from monthly projects",
  },
  "finance.recurring": { ar: "متكررة", en: "recurring" },
  "finance.riskTitle": { ar: "⚡ تحليل المخاطر", en: "⚡ Risk analysis" },
  "finance.monthlyProjects.heading": {
    ar: "🔁 مشاريع شهرية نشطة",
    en: "🔁 Active monthly projects",
  },
  "finance.monthlyProjects.perMonth": { ar: "/شهر", en: "/mo" },
  "finance.transactionsHeading": { ar: "المعاملات المسجّلة", en: "Recorded transactions" },
  "finance.empty.descFull": {
    ar: "اضغط \"معاملة جديدة\" لتسجّل راتب شهري متكرر (يُحتسب كل شهر تلقائياً) أو دفعة لمرة واحدة.",
    en: "Click \"New transaction\" to record a monthly recurring salary (auto-counted each month) or a one-time payment.",
  },
  "finance.upcomingCalloutSuffix": {
    ar: "معاملة مستقبلية لمرة واحدة",
    en: "upcoming one-time transaction(s)",
  },
  "finance.upcomingHint": {
    ar: "عندك معاملات بتاريخ بعد اليوم — هذي ما تنحسب في الفترة الحالية. لو تبيها تنحسب كل شهر تلقائياً (مثل الرواتب): احذفها وأعد إضافتها وحدد",
    en: "You have transactions dated after today — those aren't counted in this period. To make them auto-count each month (like salaries): delete them, re-add them, and choose",
  },
  "finance.upcomingHintMark": {
    ar: "🔁 شهري متكرر",
    en: "🔁 Monthly recurring",
  },
  "finance.upcomingHintTail": {
    ar: "من البداية.",
    en: "from the start.",
  },
  "finance.deltaVsPrev": { ar: "عن الفترة السابقة", en: "vs previous period" },

  // Risk messages
  "risk.loss.title": { ar: "خسارة في هذه الفترة", en: "Loss this period" },
  "risk.loss.detailPrefix": {
    ar: "المصروفات تجاوزت الإيرادات بـ",
    en: "Expenses exceeded revenue by",
  },
  "risk.lowMargin.title": { ar: "هامش ربح منخفض", en: "Low profit margin" },
  "risk.lowMargin.detailPrefix": { ar: "هامشك", en: "Your margin is" },
  "risk.lowMargin.detailSuffix": {
    ar: "فقط — يُفضّل فوق 15%.",
    en: "only — 15%+ is preferred.",
  },
  "risk.revenueDrop.title": { ar: "الإيرادات تنخفض", en: "Revenue is dropping" },
  "risk.revenueDrop.detailPrefix": { ar: "نزلت", en: "Down" },
  "risk.revenueDrop.detailSuffix": {
    ar: "عن الفترة السابقة.",
    en: "vs previous period.",
  },
  "risk.expenseRise.title": {
    ar: "المصروفات في ارتفاع",
    en: "Expenses are rising",
  },
  "risk.expenseRise.detailPrefix": { ar: "زادت", en: "Up" },
  "risk.expenseRise.detailSuffix": {
    ar: "عن الفترة السابقة.",
    en: "vs previous period.",
  },
  "risk.fixedGap.title": {
    ar: "المصروفات الثابتة > الإيرادات الثابتة",
    en: "Fixed expenses > fixed income",
  },
  "risk.fixedGap.detailPrefix": {
    ar: "كل شهر فيه عجز ثابت بمقدار",
    en: "A recurring monthly shortfall of",
  },
  "risk.fixedGap.detailSuffix": {
    ar: "قبل أي مشروع لمرة واحدة — زيد الإيرادات الشهرية المستمرة.",
    en: "before any one-time project — grow recurring monthly income.",
  },
  "risk.noIncome.title": { ar: "ما فيه دخل مسجّل", en: "No income recorded" },
  "risk.noIncome.detailPrefix": { ar: "سجّلت", en: "You recorded" },
  "risk.noIncome.detailSuffix": {
    ar: "مصروفات بدون أي إيراد.",
    en: "in expenses with no revenue.",
  },
  "risk.healthy.title": { ar: "الوضع المالي صحي", en: "Finances look healthy" },
  "risk.healthy.detailPrefix": { ar: "صافي ربح", en: "Net profit of" },
  "risk.healthy.detailMargin": { ar: "بهامش", en: "at a margin of" },

  // Roles
  "role.labelAdmin": { ar: "مدير", en: "Admin" },
  "role.labelManager": { ar: "رئيس قسم", en: "Manager" },
  "role.labelEmployee": { ar: "موظف", en: "Employee" },

  // Project status
  "projectStatus.active": { ar: "نشط", en: "Active" },
  "projectStatus.on_hold": { ar: "موقّف مؤقتاً", en: "On hold" },
  "projectStatus.completed": { ar: "مكتمل", en: "Completed" },
  "projectStatus.cancelled": { ar: "ملغي", en: "Cancelled" },

  // Project type
  "projectType.video": { ar: "فيديو", en: "Video" },
  "projectType.photo": { ar: "تصوير", en: "Photo" },
  "projectType.event": { ar: "فعالية", en: "Event" },
  "projectType.digital_campaign": { ar: "حملة رقمية", en: "Digital campaign" },
  "projectType.web": { ar: "ويب", en: "Web" },
  "projectType.design": { ar: "ديزاين", en: "Design" },
  "projectType.branding": { ar: "إنشاء علامة تجارية", en: "Branding" },
  "projectType.other": { ar: "غير ذلك", en: "Other" },

  // Priority
  "priority.low": { ar: "منخفضة", en: "Low" },
  "priority.normal": { ar: "عادية", en: "Normal" },
  "priority.high": { ar: "مرتفعة", en: "High" },
  "priority.urgent": { ar: "عاجلة", en: "Urgent" },

  // Task status
  "taskStatus.todo": { ar: "قيد الانتظار", en: "To do" },
  "taskStatus.in_progress": { ar: "قيد العمل", en: "In progress" },
  "taskStatus.in_review": { ar: "قيد المراجعة", en: "In review" },
  "taskStatus.done": { ar: "مكتمل", en: "Done" },
  "taskStatus.blocked": { ar: "معلّق", en: "Blocked" },

  // Transaction category
  "txCategory.project_payment": { ar: "دفعة مشروع", en: "Project payment" },
  "txCategory.salary": { ar: "راتب", en: "Salary" },
  "txCategory.bonus": { ar: "بونص", en: "Bonus" },
  "txCategory.freelance": { ar: "فري لانس (مشروع)", en: "Freelance (project)" },
  "txCategory.tool": { ar: "أدوات/اشتراكات", en: "Tools/subscriptions" },
  "txCategory.ad": { ar: "إعلانات", en: "Ads" },
  "txCategory.overhead": { ar: "مصاريف عامة", en: "Overhead" },
  "txCategory.refund": { ar: "ارتجاع/خسارة", en: "Refund/loss" },
  "txCategory.other": { ar: "غير ذلك", en: "Other" },

  // Billing type
  "billing.one_time": { ar: "مرة واحدة", en: "One-time" },
  "billing.monthly": { ar: "شهري متكرر", en: "Monthly recurring" },

  // Recurrence
  "recurrence.none": { ar: "مرة واحدة", en: "One-time" },
  "recurrence.monthly": { ar: "شهري", en: "Monthly" },

  // Language switcher
  "lang.arabic": { ar: "عربي", en: "عربي" },
  "lang.english": { ar: "English", en: "English" },

  // Photo shoots
  "nav.shoots": { ar: "جدول التصوير", en: "Shoot schedule" },
  "page.shoots.title": { ar: "جدول التصوير", en: "Shoot schedule" },
  "page.shoots.subtitle": {
    ar: "مواعيد التصوير للمصورين والمعدات المحجوزة — مع تذكير قبل يوم وقبل ساعة",
    en: "Photography production schedule — crew, equipment, 24h + 1h reminders",
  },
  "shoots.new": { ar: "تصوير جديد", en: "New shoot" },
  "shoots.edit": { ar: "تعديل التصوير", en: "Edit shoot" },
  "shoots.create": { ar: "إنشاء التصوير", en: "Create shoot" },
  "shoots.deleteConfirm": { ar: "تحذف تصوير", en: "Delete shoot" },
  "shoots.markDone": { ar: "تم", en: "Done" },
  "shoots.cancel": { ar: "إلغاء", en: "Cancel" },
  "shoots.soon": { ar: "قريباً", en: "Soon" },
  "shoots.hours": { ar: "ساعة", en: "hr" },
  "shoots.hoursShort": { ar: "س", en: "h" },
  "shoots.openMap": { ar: "افتح الخريطة", en: "Open map" },
  "shoots.openReference": { ar: "المرجع / الموود بورد", en: "Reference / moodboard" },
  "shoots.myUpcoming": { ar: "تصويراتي القادمة", en: "My upcoming shoots" },
  "shoots.conflictsTitle": {
    ar: "تعارضات في الجدول",
    en: "Schedule conflicts",
  },
  "shoots.noCrewAvailable": { ar: "لا يوجد موظفين", en: "No crew available" },
  "shoots.noEquipmentAvailable": {
    ar: "ما فيه معدات مسجّلة بعد — ضيف من صفحة المعدات",
    en: "No equipment yet — add from the Equipment page",
  },
  "shoots.calendar.heading": { ar: "تقويم التصوير", en: "Shoot calendar" },
  "shoots.list.upcoming": { ar: "تصوير قادم", en: "Upcoming shoots" },
  "shoots.list.past": { ar: "تصوير سابق", en: "Past shoots" },
  "shoots.empty.upcoming": {
    ar: "ما فيه تصوير مجدول — اضغط \"تصوير جديد\"",
    en: "No shoots scheduled — click \"New shoot\"",
  },
  "shoots.status.scheduled": { ar: "مجدول", en: "Scheduled" },
  "shoots.status.done": { ar: "تمّ", en: "Done" },
  "shoots.status.cancelled": { ar: "ملغي", en: "Cancelled" },
  "shoots.status.postponed": { ar: "مؤجّل", en: "Postponed" },
  "shoots.stats.upcoming": { ar: "قادمة", en: "Upcoming" },
  "shoots.stats.done": { ar: "تمّت", en: "Done" },
  "shoots.stats.cancelled": { ar: "ملغاة", en: "Cancelled" },
  "shoots.stats.postponed": { ar: "مؤجّلة", en: "Postponed" },
  "shoots.field.title": { ar: "عنوان التصوير", en: "Shoot title" },
  "shoots.field.titlePlaceholder": {
    ar: "مثال: تصوير فعالية وذنان",
    en: "e.g. Wadnan event shoot",
  },
  "shoots.field.project": { ar: "المشروع", en: "Project" },
  "shoots.field.status": { ar: "الحالة", en: "Status" },
  "shoots.field.date": { ar: "تاريخ ووقت التصوير", en: "Shoot date & time" },
  "shoots.field.duration": { ar: "المدة", en: "Duration" },
  "shoots.field.location": { ar: "الموقع", en: "Location" },
  "shoots.field.locationPlaceholder": {
    ar: "فندق كذا، كتارا، الدوحة",
    en: "Hotel X, Katara, Doha",
  },
  "shoots.field.locationNotes": { ar: "تعليمات الموقع", en: "Location notes" },
  "shoots.field.locationNotesPlaceholder": {
    ar: "الطابق الثاني، قاعة الاجتماعات، بوابة 3",
    en: "2nd floor, meeting hall, gate 3",
  },
  "shoots.field.mapUrl": { ar: "رابط الخريطة", en: "Map link" },
  "shoots.field.clientContact": { ar: "جهة التواصل في الموقع", en: "On-site contact" },
  "shoots.field.clientContactPlaceholder": {
    ar: "محمد الكواري - 5555 0000",
    en: "Mohammed - 5555 0000",
  },
  "shoots.field.referenceUrl": { ar: "رابط المرجع", en: "Reference link" },
  "shoots.field.crew": { ar: "الطاقم", en: "Crew" },
  "shoots.field.equipment": { ar: "المعدات المحجوزة", en: "Reserved equipment" },
  "shoots.field.shotList": { ar: "قائمة اللقطات", en: "Shot list" },
  "shoots.field.shotListPlaceholder": {
    ar: "وايد زوايا، لقطات للمنتج، لقطات فيديو قصيرة للسوشيال...",
    en: "Wide angles, product shots, short social clips...",
  },
  "shoots.field.notes": { ar: "ملاحظات", en: "Notes" },
  "shoots.field.notesPlaceholder": {
    ar: "أي تعليمات خاصة للموظفين",
    en: "Any special crew instructions",
  },
  "shoots.reminder.titleDay": { ar: "تصوير بعد يوم", en: "Shoot tomorrow" },
  "shoots.reminder.titleHour": { ar: "تصوير بعد ساعة", en: "Shoot in 1 hour" },
  "shoots.reminder.in": { ar: "بعد", en: "in" },
  "shoots.reminder.minutes": { ar: "دقيقة", en: "minutes" },
  "shoots.reminder.hours": { ar: "ساعة", en: "hours" },
  "shoots.viewDetails": { ar: "التفاصيل الكاملة", en: "View details" },
  "shoots.backToAll": { ar: "كل التصويرات", en: "All shoots" },
  "shoots.today": { ar: "اليوم", en: "Today" },
  "shoots.endsAt": { ar: "ينتهي", en: "ends at" },
  "shoots.crewCount": { ar: "مصوّر/موظف", en: "crew" },
  "shoots.itemsCount": { ar: "معدة", en: "items" },
  "shoots.noCrew": { ar: "ما فيه طاقم", en: "No crew" },
  "shoots.noEquipment": { ar: "ما فيه معدات محجوزة", en: "No equipment reserved" },
  "shoots.openInMaps": { ar: "افتح في قوقل ماب", en: "Open in Google Maps" },
  "shoots.getDirections": { ar: "الاتجاهات", en: "Get directions" },
  "shoots.addToCalendar": { ar: "أضف لتقويمي", en: "Add to calendar" },
  "shoots.reminders.title": { ar: "حالة التنبيهات", en: "Reminder status" },
  "shoots.reminders.dayBefore": { ar: "تنبيه قبل يوم", en: "24h-before alert" },
  "shoots.reminders.hourBefore": { ar: "تنبيه قبل ساعة", en: "1h-before alert" },
  "shoots.reminders.sentAt": { ar: "أُرسل في", en: "sent at" },
  "shoots.reminders.pending": {
    ar: "لم يُرسل بعد — راح يشتغل تلقائياً",
    en: "Not sent yet — will fire automatically",
  },

  // Equipment inventory
  "nav.equipment": { ar: "المعدات", en: "Equipment" },
  "page.equipment.title": { ar: "جرد المعدات", en: "Equipment inventory" },
  "page.equipment.subtitle": {
    ar: "كاميرات، عدسات، إضاءة، ودرونات — كل شي مع حالته ومكانه",
    en: "Cameras, lenses, lighting, drones — with condition and holder",
  },
  "equipment.new": { ar: "معدة جديدة", en: "New equipment" },
  "equipment.edit": { ar: "تعديل المعدة", en: "Edit equipment" },
  "equipment.create": { ar: "أضف المعدة", en: "Add equipment" },
  "equipment.deleteConfirm": { ar: "تحذف", en: "Delete" },
  "equipment.checkOut": { ar: "سلّم لموظف", en: "Check out" },
  "equipment.checkIn": { ar: "أرجع المعدة", en: "Check in" },
  "equipment.checkOutTitle": { ar: "تسليم المعدة", en: "Check out equipment" },
  "equipment.checkOutHolder": { ar: "استلم بواسطة", en: "Handed to" },
  "equipment.expectedReturn": { ar: "موعد الإرجاع المتوقع", en: "Expected return date" },
  "equipment.holder": { ar: "المستلم الحالي", en: "Current holder" },
  "equipment.inStorage": { ar: "في المخزن", en: "In storage" },
  "equipment.return": { ar: "إرجاع", en: "Return" },
  "equipment.actions": { ar: "إجراءات", en: "Actions" },
  "equipment.empty.title": { ar: "ما فيه معدات مسجّلة", en: "No equipment recorded" },
  "equipment.empty.desc": {
    ar: "اضغط \"معدة جديدة\" لتبدأ جرد الكاميرات والعدسات",
    en: "Click \"New equipment\" to start inventorying cameras and lenses",
  },
  "equipment.field.name": { ar: "الاسم", en: "Name" },
  "equipment.field.namePlaceholder": {
    ar: "Sony A7 IV · Sigma 24-70mm",
    en: "Sony A7 IV · Sigma 24-70mm",
  },
  "equipment.field.category": { ar: "الفئة", en: "Category" },
  "equipment.field.condition": { ar: "الحالة", en: "Condition" },
  "equipment.field.brand": { ar: "العلامة التجارية", en: "Brand" },
  "equipment.field.model": { ar: "الموديل", en: "Model" },
  "equipment.field.serial": { ar: "الرقم التسلسلي", en: "Serial #" },
  "equipment.field.purchasedAt": { ar: "تاريخ الشراء", en: "Purchased on" },
  "equipment.field.price": { ar: "سعر الشراء (ر.ق)", en: "Purchase price (QAR)" },
  "equipment.field.notes": { ar: "ملاحظات", en: "Notes" },
  "equipment.field.notesPlaceholder": {
    ar: "شنو مميز فيها؟ أي ملاحظة عن الاستخدام؟",
    en: "Anything notable about it or usage?",
  },
  "equipment.category.camera": { ar: "كاميرات", en: "Cameras" },
  "equipment.category.lens": { ar: "عدسات", en: "Lenses" },
  "equipment.category.light": { ar: "إضاءة", en: "Lighting" },
  "equipment.category.tripod": { ar: "حوامل", en: "Tripods" },
  "equipment.category.microphone": { ar: "ميكروفونات", en: "Microphones" },
  "equipment.category.drone": { ar: "درونات", en: "Drones" },
  "equipment.category.audio": { ar: "صوتيات", en: "Audio" },
  "equipment.category.storage": { ar: "تخزين", en: "Storage" },
  "equipment.category.accessory": { ar: "إكسسوارات", en: "Accessories" },
  "equipment.category.other": { ar: "أخرى", en: "Other" },
  "equipment.condition.new": { ar: "جديدة", en: "New" },
  "equipment.condition.good": { ar: "ممتازة", en: "Good" },
  "equipment.condition.fair": { ar: "متوسطة", en: "Fair" },
  "equipment.condition.needs_repair": { ar: "تحتاج صيانة", en: "Needs repair" },
  "equipment.condition.broken": { ar: "معطّلة", en: "Broken" },
  "equipment.stats.total": { ar: "إجمالي المعدات", en: "Total items" },
  "equipment.stats.categories": { ar: "فئات", en: "Categories" },
  "equipment.stats.checkedOut": { ar: "مستلمة حالياً", en: "Checked out" },
  "equipment.stats.needsRepair": { ar: "تحتاج صيانة", en: "Needs repair" },
  "equipment.stats.totalValue": { ar: "القيمة الإجمالية", en: "Total value" },

  // Meetings
  "nav.meetings": { ar: "المواعيد", en: "Meetings" },
  "page.meetings.title": { ar: "مواعيد العملاء", en: "Client meetings" },
  "page.meetings.subtitle": {
    ar: "جدول لقاءات العملاء — مع منصاتهم وموقعهم ومذكّر قبل الموعد بساعة",
    en: "Client meeting schedule — with their platforms, website, and 1-hour reminders",
  },
  "meetings.new": { ar: "موعد جديد", en: "New meeting" },
  "meetings.edit": { ar: "تعديل الموعد", en: "Edit meeting" },
  "meetings.create": { ar: "إنشاء الموعد", en: "Create meeting" },
  "meetings.deleteConfirm": { ar: "تحذف موعد", en: "Delete meeting with" },
  "meetings.markDone": { ar: "تم", en: "Done" },
  "meetings.cancel": { ar: "إلغاء", en: "Cancel" },
  "meetings.joinCall": { ar: "انضم للقاء", en: "Join call" },
  "meetings.minutes": { ar: "دقيقة", en: "min" },
  "meetings.items": { ar: "موعد", en: "meetings" },
  "meetings.soon": { ar: "قريباً (أقل من ساعة)", en: "Soon (<1h)" },
  "meetings.nextUp": { ar: "الموعد التالي", en: "Next up" },
  "meetings.empty.title": { ar: "ما فيه مواعيد بعد", en: "No meetings yet" },
  "meetings.empty.desc": {
    ar: "اضغط \"موعد جديد\" لتسجيل اجتماع مع عميل — مع منصاته وموقعه",
    en: "Click \"New meeting\" to schedule a client meeting with their platforms and website",
  },
  "meetings.filter.upcoming": { ar: "القادمة", en: "Upcoming" },
  "meetings.filter.past": { ar: "السابقة", en: "Past" },
  "meetings.filter.all": { ar: "الكل", en: "All" },
  "meetings.status.scheduled": { ar: "مجدول", en: "Scheduled" },
  "meetings.status.done": { ar: "تمّ", en: "Done" },
  "meetings.status.cancelled": { ar: "ملغي", en: "Cancelled" },
  "meetings.status.no_show": { ar: "ما حضر", en: "No-show" },
  "meetings.calendar.heading": { ar: "التقويم", en: "Calendar" },
  "meetings.calendar.today": { ar: "اليوم", en: "Today" },
  "meetings.list.heading": { ar: "قائمة المواعيد", en: "Meeting list" },
  "meetings.section.client": { ar: "بيانات العميل", en: "Client info" },
  "meetings.section.social": { ar: "المنصات والموقع", en: "Platforms & website" },
  "meetings.section.schedule": { ar: "التوقيت", en: "Schedule" },
  "meetings.section.notes": { ar: "ملاحظات", en: "Notes" },
  "meetings.field.clientName": { ar: "اسم العميل", en: "Client name" },
  "meetings.field.clientNamePlaceholder": { ar: "محمد الكواري", en: "e.g. Mohammed Ali" },
  "meetings.field.companyName": { ar: "اسم الشركة", en: "Company name" },
  "meetings.field.companyPlaceholder": { ar: "اسم الشركة (اختياري)", en: "Company (optional)" },
  "meetings.field.phone": { ar: "رقم الجوال", en: "Phone" },
  "meetings.field.email": { ar: "الإيميل", en: "Email" },
  "meetings.field.instagram": { ar: "انستقرام", en: "Instagram" },
  "meetings.field.tiktok": { ar: "تيك توك", en: "TikTok" },
  "meetings.field.website": { ar: "الموقع الإلكتروني", en: "Website" },
  "meetings.field.socialNotes": { ar: "ملاحظات إضافية", en: "Extra notes" },
  "meetings.field.socialNotesPlaceholder": {
    ar: "مثال: 500 ألف متابع، يهتم بالمحتوى العربي",
    en: "e.g. 500K followers, focused on Arabic content",
  },
  "meetings.field.meetingAt": { ar: "تاريخ ووقت الموعد", en: "Date & time" },
  "meetings.field.duration": { ar: "المدة", en: "Duration" },
  "meetings.field.location": { ar: "المكان", en: "Location" },
  "meetings.field.locationPlaceholder": {
    ar: "مكتب سرب · موقع العميل · أون لاين",
    en: "SRB office · client site · online",
  },
  "meetings.field.meetingLink": { ar: "رابط الاجتماع (Zoom/Meet)", en: "Meeting link (Zoom/Meet)" },
  "meetings.field.owner": { ar: "المسؤول عن الموعد", en: "Meeting owner" },
  "meetings.field.status": { ar: "الحالة", en: "Status" },
  "meetings.field.agendaNotes": { ar: "جدول الأعمال (قبل الموعد)", en: "Agenda (pre-meeting)" },
  "meetings.field.agendaPlaceholder": {
    ar: "شنو تبي تناقش؟ أهداف اللقاء؟ مراجع للعميل؟",
    en: "What to discuss? Meeting goals? Client references?",
  },
  "meetings.field.outcomeNotes": { ar: "نتائج الاجتماع", en: "Outcome" },
  "meetings.field.outcomePlaceholder": {
    ar: "شنو اتفقتوا عليه؟ الخطوات التالية؟",
    en: "What was agreed? Next steps?",
  },
  "meetings.reminder.title": { ar: "تذكير بموعد", en: "Meeting reminder" },
  "meetings.reminder.in": { ar: "بعد", en: "in" },
  "meetings.reminder.minutes": { ar: "دقيقة", en: "minutes" },

  // Theme editor
  "page.theme.title": { ar: "الألوان والهوية", en: "Theme & branding" },
  "page.theme.subtitle": {
    ar: "غيّر ألوان النظام ولوقو الشركة — المعاينة مباشرة قدامك",
    en: "Change system colors and logo — preview updates live",
  },
  "nav.admin_theme": { ar: "الألوان", en: "Theme" },
  "nav.admin_permissions": { ar: "الصلاحيات", en: "Permissions" },

  // Mobile bottom-nav labels (kept short to fit under the icon at 320px wide).
  "bottomNav.myTasks": { ar: "مهامي", en: "My tasks" },
  "bottomNav.mySchedule": { ar: "جدولي", en: "My schedule" },
  "bottomNav.notifications": { ar: "إشعاراتي", en: "Inbox" },
  "bottomNav.more": { ar: "المزيد", en: "More" },
  "theme.field.brand": { ar: "اللون الأساسي (Brand)", en: "Brand color" },
  "theme.field.accent": { ar: "لون التمييز (Accent)", en: "Accent color" },
  "theme.field.logo": { ar: "اللوقو", en: "Logo" },
  "theme.preset.default": { ar: "افتراضي (أخضر)", en: "Default (emerald)" },
  "theme.preset.blue": { ar: "أزرق", en: "Blue" },
  "theme.preset.purple": { ar: "بنفسجي", en: "Purple" },
  "theme.preset.gold": { ar: "ذهبي", en: "Gold" },
  "theme.preset.rose": { ar: "وردي", en: "Rose" },
  "theme.presets": { ar: "ألوان جاهزة", en: "Presets" },
  "theme.preview.title": { ar: "معاينة مباشرة", en: "Live preview" },
  "theme.preview.sampleButton": { ar: "زر أساسي", en: "Primary button" },
  "theme.preview.sampleCard": {
    ar: "هذي بطاقة KPI مثال",
    en: "Sample KPI card",
  },
  "theme.preview.sampleBadge": { ar: "شارة", en: "Badge" },
  "theme.preview.samplePrimary": { ar: "نص أساسي", en: "Primary text" },
  "theme.preview.sampleAccent": { ar: "نص تمييز", en: "Accent text" },
  "theme.save": { ar: "احفظ الثيم", en: "Save theme" },
  "theme.reset": { ar: "استرجع الافتراضي", en: "Reset to default" },
  "theme.saved": { ar: "تم الحفظ ✓", en: "Saved ✓" },
  "theme.logo.change": { ar: "تغيير اللوقو", en: "Change logo" },
  "theme.logo.hint": {
    ar: "ارفع صورة JPG / PNG / SVG لاستبدال اللوقو",
    en: "Upload JPG / PNG / SVG to replace the logo",
  },
  "theme.logo.uploading": { ar: "يرفع...", en: "Uploading..." },
  "theme.logo.uploaded": { ar: "تم الرفع ✓", en: "Uploaded ✓" },
  "theme.logo.failed": { ar: "فشل الرفع", en: "Upload failed" },

  // Reports page
  "page.reports.title": { ar: "التقارير", en: "Reports" },
  "page.reports.subtitle": {
    ar: "ملخصات شهرية محفوظة لكل شهر — إيرادات، مصروفات، صافي، مشاريع، مهام",
    en: "Monthly summaries archived per month — revenue, expenses, net, projects, tasks",
  },
  "reports.prevMonth": { ar: "الشهر السابق", en: "Previous month" },
  "reports.nextMonth": { ar: "الشهر التالي", en: "Next month" },
  "reports.currentMonth": { ar: "الشهر الحالي", en: "Current month" },
  "reports.section.financials": { ar: "الأرقام المالية", en: "Financials" },
  "reports.section.projects": { ar: "المشاريع", en: "Projects" },
  "reports.section.tasks": { ar: "المهام", en: "Tasks" },
  "reports.section.transactions": { ar: "المعاملات هذا الشهر", en: "Transactions this month" },
  "reports.section.history": { ar: "الأشهر السابقة", en: "Historical months" },
  "reports.kpi.revenue": { ar: "الإيرادات", en: "Revenue" },
  "reports.kpi.expenses": { ar: "المصروفات", en: "Expenses" },
  "reports.kpi.net": { ar: "صافي الربح", en: "Net profit" },
  "reports.kpi.margin": { ar: "الهامش", en: "Margin" },
  "reports.kpi.txCount": { ar: "معاملات", en: "Transactions" },
  "reports.projects.started": { ar: "مشاريع بدأت", en: "Projects started" },
  "reports.projects.completed": { ar: "مشاريع مكتملة", en: "Projects completed" },
  "reports.projects.activeEnd": { ar: "نشطة بنهاية الشهر", en: "Active at month end" },
  "reports.tasks.created": { ar: "مهام جديدة", en: "Tasks created" },
  "reports.tasks.completed": { ar: "مهام مكتملة", en: "Tasks completed" },
  "reports.tasks.openEnd": { ar: "مفتوحة بنهاية الشهر", en: "Open at month end" },
  "reports.empty.transactions": { ar: "ما فيه معاملات في هذا الشهر", en: "No transactions this month" },
  "reports.vsPrev": { ar: "عن الشهر السابق", en: "vs previous month" },
  "reports.income.breakdown.oneTime": { ar: "لمرة واحدة", en: "One-time" },
  "reports.income.breakdown.recurring": { ar: "شهري متكرر", en: "Monthly recurring" },
  "reports.income.breakdown.projects": { ar: "مشاريع شهرية", en: "Monthly projects" },
  "reports.expense.breakdown.oneTime": { ar: "لمرة واحدة", en: "One-time" },
  "reports.expense.breakdown.recurring": { ar: "شهري متكرر", en: "Monthly recurring" },
  "reports.history.hint": {
    ar: "اضغط أي شهر لتفتح تقريره",
    en: "Click any month to open its report",
  },

  // Audit log
  "page.audit.title": { ar: "سجل الإجراءات", en: "Audit log" },
  "page.audit.subtitle": {
    ar: "سجل كامل لكل قرار مدير — مين فعل شنو ومتى",
    en: "Full trail of admin decisions — who did what, and when",
  },
  "nav.admin_audit": { ar: "سجل الإجراءات", en: "Audit log" },
  "audit.entries": { ar: "إجراء مسجّل", en: "recorded action(s)" },
  "audit.time": { ar: "الوقت", en: "Time" },
  "audit.actor": { ar: "المنفّذ", en: "Actor" },
  "audit.action": { ar: "الإجراء", en: "Action" },
  "audit.target": { ar: "الهدف", en: "Target" },
  "audit.details": { ar: "التفاصيل", en: "Details" },
  "audit.prev": { ar: "السابق", en: "Previous" },
  "audit.next": { ar: "التالي", en: "Next" },
  "audit.empty.title": { ar: "ما فيه إجراءات مسجّلة بعد", en: "No actions recorded yet" },
  "audit.empty.desc": {
    ar: "أي قرار مدير (تفعيل/تعطيل حسابات، حذف معاملات، إنشاء مشاريع) راح يظهر هنا تلقائياً.",
    en: "Every admin decision (approve/deactivate accounts, delete transactions, create projects) will appear here automatically.",
  },

  // Backup
  "page.backup.title": { ar: "النسخ الاحتياطي", en: "Backup" },
  "page.backup.subtitle": {
    ar: "النظام يسوّي نسخ تلقائي بدون تدخّل منك — يراقب نشاطك ويحفظ لما تحتاج",
    en: "The system creates backups automatically — it watches activity and saves when needed",
  },
  "nav.admin_backup": { ar: "النسخ الاحتياطي", en: "Backup" },
  "backup.runNow": { ar: "أنشئ نسخة الآن", en: "Back up now" },
  "backup.running": { ar: "جاري العمل...", en: "Running..." },
  "backup.lastRun": { ar: "آخر نسخة", en: "Last backup" },
  "backup.never": { ar: "ما نُفّذ بعد", en: "Never" },
  "backup.size": { ar: "الحجم", en: "Size" },
  "backup.location": { ar: "مكان النسخ", en: "Backup folder" },
  "backup.history": { ar: "سجل النسخ السابقة", en: "Backup history" },
  "backup.trigger": { ar: "النوع", en: "Trigger" },
  "backup.trigger.manual": { ar: "يدوي", en: "Manual" },
  "backup.trigger.scheduled": { ar: "مجدول", en: "Scheduled" },
  "backup.trigger.auto": { ar: "تلقائي ذكي", en: "Smart auto" },
  "backup.empty.title": { ar: "ما فيه نسخ بعد", en: "No backups yet" },
  "backup.empty.desc": {
    ar: "النسخة التلقائية الأولى راح تنفذ خلال دقيقة من تشغيل السيرفر. لو تبي نسخة فورية، اضغط الزر فوق.",
    en: "The first auto backup runs within a minute of server start. Click the button above for an immediate one.",
  },
  "backup.success": { ar: "تم إنشاء نسخة", en: "Backup created" },
  "backup.failed": { ar: "فشلت العملية", en: "Backup failed" },
  "backup.schedule.hint": {
    ar: "النظام يفحص الحالة كل 5 دقايق ويسوّي نسخة لما يحدث: 5 معاملات جديدة، أو مشروع جديد، أو موظف جديد، أو تمر 6 ساعات. الحد الأدنى ساعة بين كل نسختين.",
    en: "The system checks every 5 minutes and creates a backup when: 5 new transactions, or a new project, or a new user, or 6 hours pass. Minimum 1 hour between backups.",
  },
  "backup.health.title": { ar: "حالة النسخ الاحتياطي", en: "Backup status" },
  "backup.health.healthy": { ar: "كل شي تمام", en: "All good" },
  "backup.health.warning": { ar: "تنبيه", en: "Heads up" },
  "backup.health.critical": { ar: "خطر — انتبه", en: "Critical" },
  "backup.health.never": { ar: "ما تم أي نسخة بعد", en: "No backups yet" },
  "backup.health.lastAgo": { ar: "آخر نسخة قبل", en: "Last backup" },
  "backup.health.verified": { ar: "متحقّق منها", en: "Verified" },
  "backup.health.failedRecent": {
    ar: "آخر محاولة فشلت — راجع سبب الفشل",
    en: "Last attempt failed — check the error",
  },
  "backup.reason": { ar: "السبب", en: "Reason" },
  "backup.status": { ar: "الحالة", en: "Status" },
  "backup.status.verified": { ar: "متحقّقة", en: "Verified" },
  "backup.status.success": { ar: "نجحت", en: "Success" },
  "backup.status.failed": { ar: "فشلت", en: "Failed" },
  "backup.duration.justNow": { ar: "الحين", en: "just now" },
  "backup.duration.minutes": { ar: "دقيقة", en: "min" },
  "backup.duration.hours": { ar: "ساعة", en: "h" },
  "backup.duration.days": { ar: "يوم", en: "d" },

  // Common actions + status
  "action.saving": { ar: "يحفظ...", en: "Saving..." },
  "action.creating": { ar: "يُنشئ...", en: "Creating..." },
  "action.loading": { ar: "يحمّل...", en: "Loading..." },
  "common.error": { ar: "خطأ", en: "Error" },
  "common.errorGeneric": { ar: "حدث خطأ", en: "Something went wrong" },
  "common.optional": { ar: "اختياري", en: "Optional" },
  "common.required": { ar: "مطلوب", en: "Required" },

  // Task UI
  "tasks.edit": { ar: "تعديل المهمة", en: "Edit task" },
  "tasks.create": { ar: "إنشاء المهمة", en: "Create task" },
  "tasks.delete": { ar: "حذف المهمة", en: "Delete task" },
  "tasks.deleteConfirm": {
    ar: "تحذف المهمة نهائياً؟",
    en: "Delete this task permanently?",
  },
  "tasks.unassigned": { ar: "بدون مسؤول", en: "Unassigned" },
  "tasks.noProject": { ar: "بدون مشروع", en: "No project" },
  "tasks.overdueByDays": { ar: "متأخرة {n} يوم", en: "Overdue by {n} day(s)" },
  "tasks.overdueBanner": {
    ar: "⚠ هذه المهمة متأخرة عن الـ deadline",
    en: "⚠ This task is past its deadline",
  },
  "tasks.kanban.empty": {
    ar: "اسحب مهمة هنا · أو اضغط \"مهمة جديدة\"",
    en: "Drag a task here · or click \"New task\"",
  },
  "tasks.field.title": { ar: "عنوان المهمة", en: "Task title" },
  "tasks.field.titleRequired": { ar: "عنوان المهمة *", en: "Task title *" },
  "tasks.field.titlePlaceholder": {
    ar: "مثال: تصميم بوستر للحملة",
    en: "e.g. Design campaign poster",
  },
  "tasks.suggest.title": {
    ar: "✨ مرشّحون مناسبون لهالمهمة",
    en: "✨ Best fits for this task",
  },
  "tasks.suggest.bestFit": { ar: "الأنسب", en: "Best fit" },
  "tasks.suggest.fit": { ar: "تطابق", en: "fit" },
  "tasks.suggest.thinking": {
    ar: "يحلل الفريق ويختار لك الأنسب...",
    en: "Analyzing the team to find the best fit...",
  },
  "tasks.suggest.hint": {
    ar: "اكتب عنوان المهمة وراح يقترح لك الموظف الأنسب",
    en: "Type a task title and we'll suggest the best person",
  },
  "tasks.suggest.error": {
    ar: "ما قدرت أحضّر اقتراحات الحين — اختر يدوي",
    en: "Couldn't load suggestions — pick manually",
  },
  "tasks.suggest.noMatch": {
    ar: "ما لقيت موظف مناسب — أعد صياغة المهمة أو اختر يدوي",
    en: "No good fit yet — rephrase or pick manually",
  },
  "tasks.suggest.noMatchBadge": {
    ar: "ما فيه موظف يحمل الشارات المختارة — أضف شارة لموظف من إدارة الحسابات",
    en: "Nobody on the team holds these badges yet — add one in Account Management",
  },
  "badges.label": { ar: "الشارات", en: "Badges" },
  "badges.empty": { ar: "ما عنده شارات بعد", en: "No badges yet" },
  "badges.add": { ar: "أضف شارة", en: "Add badge" },
  "badges.allAssigned": {
    ar: "كل الشارات مضافة",
    en: "All badges assigned",
  },
  "badges.required": {
    ar: "🎯 الشارات المطلوبة (اختياري)",
    en: "🎯 Required badges (optional)",
  },
  "badges.clear": { ar: "مسح", en: "Clear" },
  "badges.detectedHint": {
    ar: "النظام اكتشف إن المهمة تحتاج هالشارة",
    en: "Detected from task title",
  },
  "badges.noneDefined": {
    ar: "ما فيه شارات معرّفة — أضف من إدارة الحسابات",
    en: "No badges defined — add from Account Management",
  },
  "tasks.field.status": { ar: "الحالة", en: "Status" },
  "tasks.field.priority": { ar: "الأولوية", en: "Priority" },
  "tasks.field.due": { ar: "موعد التسليم", en: "Due date" },
  "tasks.field.estimated": { ar: "الساعات التقديرية", en: "Estimated hours" },
  "tasks.field.hoursPlaceholder": { ar: "مثال: 8", en: "e.g. 8" },
  "tasks.field.project": { ar: "المشروع", en: "Project" },
  "tasks.field.assignee": { ar: "المسؤول", en: "Assignee" },
  "tasks.field.assigneePrimary": { ar: "المسؤول الأساسي", en: "Primary assignee" },
  "tasks.field.collaborators": {
    ar: "موظفون إضافيون (collaborators)",
    en: "Additional collaborators",
  },
  "tasks.field.description": { ar: "الوصف", en: "Description" },
  "tasks.field.descPlaceholder": {
    ar: "اختياري — تفاصيل المهمة",
    en: "Optional — task details",
  },
  "tasks.collaborators.empty": {
    ar: "ما فيه موظفون إضافيون",
    en: "No additional collaborators",
  },
  "tasks.collaborators.add": { ar: "أضف موظف", en: "Add employee" },
  "tasks.collaborators.hint": {
    ar: "المسؤول الأساسي + الموظفون الإضافيون كلهم يشوفون المهمة في قائمة مهامهم.",
    en: "The primary assignee and all collaborators see this task in their own lists.",
  },

  // Team page extras
  "team.title.workload": { ar: "حمل الموظفين", en: "Workload" },
  "team.label.disabled": { ar: "معطّل", en: "Disabled" },
  "team.hiredLabel": { ar: "تم التوظيف", en: "Hired" },
  "team.salarySuffix.ar": { ar: "/شهر", en: "/mo" },
  "team.noMemberAssigned": {
    ar: "ما تم تعيينه في أي مشروع بعد",
    en: "Not assigned to any project yet",
  },
  "team.member.role": { ar: "دوره", en: "Role" },
  "team.member.default": { ar: "عضو", en: "Member" },
  "team.projectsCount": { ar: "المشاريع ({n})", en: "Projects ({n})" },
  "team.tasksCount": { ar: "المهام ({n})", en: "Tasks ({n})" },
  "team.tasks.hint": {
    ar: "اضغط على أي مهمة لتعديل أو نقلها لموظف آخر",
    en: "Click any task to edit or reassign it",
  },
  "team.tasks.none": { ar: "ما عنده مهام مفتوحة", en: "No open tasks" },
  "team.allTeam": { ar: "كل الفريق", en: "All team" },
  "team.estimatedHours": { ar: "ساعات مقدّرة", en: "Estimated hours" },
  "team.completedCount": { ar: "{n} مكتملة", en: "{n} completed" },

  // Projects UI
  "projects.new.title": { ar: "مشروع جديد", en: "New project" },
  "projects.field.title": { ar: "اسم المشروع *", en: "Project name *" },
  "projects.field.titlePlaceholder": {
    ar: "مثال: حملة إعلانية لعميل X",
    en: "e.g. Ad campaign for client X",
  },
  "projects.field.client": { ar: "العميل", en: "Client" },
  "projects.field.clientPlaceholder": {
    ar: "اسم الشركة أو الشخص",
    en: "Company or person name",
  },
  "projects.field.brand": { ar: "اسم البراند / الشركة", en: "Brand / company" },
  "projects.field.brandPlaceholder": {
    ar: "مثال: SRB Agency، مطعم الشرق...",
    en: "e.g. SRB Agency, Al-Sharq Restaurant...",
  },
  "projects.field.clientPhone": { ar: "رقم جوال العميل", en: "Client phone" },
  "projects.field.clientPhonePlaceholder": {
    ar: "+974 5xxx xxxx",
    en: "+974 5xxx xxxx",
  },
  "projects.field.type": { ar: "النوع", en: "Type" },
  "projects.field.priority": { ar: "الأولوية", en: "Priority" },
  "projects.field.budget": { ar: "الميزانية (ر.ق)", en: "Budget (QAR)" },
  "projects.field.deadline": { ar: "موعد التسليم", en: "Deadline" },
  "projects.field.billingType": { ar: "نوع التسعير", en: "Billing type" },
  "projects.field.billingCycleDays": {
    ar: "دورة التحصيل (بالأيام)",
    en: "Billing cycle (days)",
  },
  "projects.field.billingCycleHint": {
    ar: "افتراضي 30 يوم من تاريخ إدخال المشروع · عدّلها لو عندك عميل بدورة مختلفة",
    en: "Default 30 days from project entry · change it for clients on a different cycle",
  },
  "projects.field.lead": { ar: "قائد المشروع", en: "Project lead" },
  "projects.field.description": { ar: "الوصف", en: "Description" },
  "projects.field.descPlaceholder": {
    ar: "تفاصيل، أهداف، ملاحظات...",
    en: "Details, goals, notes...",
  },
  "projects.create": { ar: "إنشاء المشروع", en: "Create project" },
  "projects.edit": { ar: "تعديل المشروع", en: "Edit project" },
  "projects.delete": { ar: "حذف المشروع", en: "Delete project" },
  "projects.deleteConfirm": {
    ar: "تحذف المشروع نهائياً؟ كل المهام والمعاملات المرتبطة به بتبقى.",
    en: "Delete this project permanently? Linked tasks and transactions will remain.",
  },
  "projects.members.title": { ar: "أعضاء المشروع", en: "Project members" },
  "projects.members.add": { ar: "إضافة عضو", en: "Add member" },
  "projects.members.addBtn": { ar: "ضيف", en: "Add" },
  "projects.members.remove": { ar: "إزالة", en: "Remove" },
  "projects.members.removeConfirm": {
    ar: "تشيل هذا الموظف من المشروع؟",
    en: "Remove this employee from the project?",
  },
  "projects.members.empty": {
    ar: "ما فيه أعضاء بعد — ضيف من الفريق",
    en: "No members yet — add from your team",
  },
  "projects.members.manage": { ar: "إدارة الفريق", en: "Manage team" },
  "projects.members.current": { ar: "الأعضاء الحاليون", en: "Current members" },
  "projects.members.none": { ar: "ما فيه أعضاء", en: "No members" },
  "projects.members.allAdded": {
    ar: "كل الموظفين مضافين",
    en: "All employees added",
  },
  "projects.members.pickLead": { ar: "القائد", en: "Lead" },
  "projects.progressLabel": { ar: "التقدم", en: "Progress" },
  "projects.deadline": { ar: "موعد التسليم", en: "Deadline" },
  "projects.budget": { ar: "الميزانية", en: "Budget" },
  "projects.monthlyBudget": { ar: "الميزانية الشهرية", en: "Monthly budget" },
  "projects.perMonthSubtext": { ar: "كل شهر", en: "per month" },
  "projects.overdueTasksMsg": {
    ar: "مهمة متأخرة في هذا المشروع",
    en: "overdue task(s) in this project",
  },
  "projects.noMembers": { ar: "ما تم تعيين أحد بعد", en: "No one assigned yet" },
  "projects.noTasksYet": {
    ar: "ما فيه مهام بعد — اضغط \"+ مهمة للمشروع\"",
    en: "No tasks yet — click \"+ Task\"",
  },
  "projects.addTaskToProject": { ar: "+ مهمة للمشروع", en: "+ Task" },
  "projects.allProjects": { ar: "كل المشاريع", en: "All projects" },
  "tasks.tasksCompletedShort": { ar: "مهام مكتملة", en: "tasks done" },

  // Finance form
  "finance.new.title": { ar: "معاملة جديدة", en: "New transaction" },
  "finance.delete.confirm": {
    ar: "تحذف المعاملة نهائياً؟",
    en: "Delete this transaction permanently?",
  },
  "finance.field.kind": { ar: "النوع", en: "Type" },
  "finance.field.category": { ar: "الفئة", en: "Category" },
  "finance.field.amount": { ar: "المبلغ (ر.ق)", en: "Amount (QAR)" },
  "finance.field.description": { ar: "الوصف", en: "Description" },
  "finance.field.descPlaceholder": {
    ar: "اختياري — مذكرة سريعة",
    en: "Optional — short note",
  },
  "finance.field.project": { ar: "مشروع مرتبط", en: "Related project" },
  "finance.field.occurredAt": { ar: "تاريخ المعاملة", en: "Transaction date" },
  "finance.field.recurrence": { ar: "التكرار", en: "Recurrence" },
  "finance.field.recurrenceEnds": { ar: "آخر موعد للتكرار", en: "Recurrence end date" },
  "finance.recordTransaction": { ar: "سجّل المعاملة", en: "Record transaction" },

  // Admin users page
  "admin.users.addTitle": { ar: "إضافة موظف جديد", en: "Add new employee" },
  "admin.users.field.email": { ar: "إيميل جيميل", en: "Gmail address" },
  "admin.users.field.name": { ar: "الاسم", en: "Name" },
  "admin.users.field.namePlaceholder": { ar: "أحمد الكواري", en: "e.g. Ahmed Ali" },
  "admin.users.field.role": { ar: "الدور", en: "Role" },
  "admin.users.field.department": { ar: "القسم (اختياري)", en: "Department (optional)" },
  "admin.users.addBtn": { ar: "أضف", en: "Add" },
  "admin.users.deleteConfirm": {
    ar: "تحذف حساب",
    en: "Delete account",
  },
  "admin.users.toggleActivate": { ar: "تفعيل", en: "Activate" },
  "admin.users.toggleDeactivate": { ar: "تعطيل", en: "Deactivate" },
  "admin.users.loginSince": { ar: "آخر دخول", en: "Last login" },
  "admin.users.noLogin": { ar: "ما دخل بعد", en: "Never signed in" },
  "admin.users.createdAt": { ar: "سُجّل", en: "Created" },
  "admin.users.hint": {
    ar: "كل حساب يقدر يدخل بجيميل هذا الإيميل فقط · المدير يقدر يعدّل أو يحذف",
    en: "Each account can sign in with its Gmail address only · Admin can edit or delete",
  },
  "admin.users.empty": {
    ar: "ما فيه حسابات بعد. اضغط \"إضافة موظف\" لتبدأ.",
    en: "No accounts yet. Click \"Add employee\" to start.",
  },
  "admin.users.youLabel": { ar: "أنت", en: "You" },
  "admin.users.addedToast": { ar: "تم الإضافة", en: "Added" },
  "admin.users.addFailed": { ar: "فشل الإضافة", en: "Failed to add" },
  "admin.users.roleOptAdmin": {
    ar: "الرئيس — يشوف كل شي بما فيه المالية",
    en: "President — sees everything incl. finance",
  },
  "admin.users.roleOptManager": {
    ar: "المدير — يدير العمليات ويوافق على الموظفين",
    en: "Manager — runs ops & approves employees",
  },
  "admin.users.roleOptDeptLead": {
    ar: "رئيس قسم — يدير مشاريع ومصاريف قسمه",
    en: "Dept Head — manages their dept projects & expenses",
  },
  "admin.users.roleOptEmployee": {
    ar: "موظف — مهامه فقط",
    en: "Employee — own tasks only",
  },
  "admin.users.lockedHigherRank": {
    ar: "ما تقدر تعدّل على حساب بدرجتك أو فوق",
    en: "Can't edit accounts at or above your rank",
  },
  "action.adding": { ar: "يضيف...", en: "Adding..." },

  // Login page
  "login.title": { ar: "SRB — تسجيل الدخول", en: "SRB — Sign in" },
  "login.subtitle": { ar: "نظام إدارة الوكالة الداخلي", en: "Internal agency management system" },
  "login.body": {
    ar: "سجّل دخول بحساب جوجل اللي أضافك المدير بالنظام. لو ما عندك صلاحية، كلّم المدير.",
    en: "Sign in with the Google account the admin added to the system. If you don't have access, contact the admin.",
  },
  "login.internalOnly": { ar: "استخدام داخلي لوكالة SRB فقط", en: "Internal use for SRB only" },

  // Monthly-invoice lifecycle
  "invoice.status.upcoming": { ar: "الفاتورة الجاية", en: "Next invoice" },
  "invoice.status.dueToday": { ar: "مستحقة اليوم", en: "Due today" },
  "invoice.status.overdue": { ar: "متأخرة", en: "Overdue" },
  "invoice.status.collected": { ar: "محصّلة", en: "Collected" },
  "invoice.in": { ar: "بعد", en: "in" },
  "invoice.daysShort": { ar: "يوم", en: "d" },
  "invoice.overdueBy": { ar: "متأخرة", en: "Overdue by" },
  "invoice.record": { ar: "سجّل الدخل", en: "Record payment" },
  "invoice.recording": { ar: "جاري التسجيل...", en: "Recording..." },
  "invoice.recorded": { ar: "تسجّلت ✓", en: "Recorded ✓" },
  "invoice.reminder.before.title": {
    ar: "تذكير: فاتورة {client}",
    en: "Reminder: {client} invoice",
  },
  "invoice.reminder.before.body": {
    ar: "الفاتورة مستحقة بعد 3 أيام · {amount}",
    en: "Invoice due in 3 days · {amount}",
  },
  "invoice.reminder.due.title": {
    ar: "اليوم فاتورة {client}",
    en: "Today: {client} invoice",
  },
  "invoice.reminder.due.body": {
    ar: "مستحقة الحين · {amount}",
    en: "Due today · {amount}",
  },
  "invoice.reminder.overdue.title": {
    ar: "متأخر: ما تحصّلت فاتورة {client}",
    en: "Overdue: {client} invoice not collected",
  },
  "invoice.reminder.overdue.body": {
    ar: "متأخرة {days} يوم · {amount}",
    en: "{days} day(s) overdue · {amount}",
  },
  "invoice.widget.title": { ar: "فواتير هذا الشهر", en: "Invoices this month" },
  "invoice.widget.empty": {
    ar: "ما فيه مشاريع شهرية بعد",
    en: "No monthly projects yet",
  },

  // Finance — locked tier (employees / non-recorders)
  "finance.locked.desc": {
    ar: "صفحة المالية مقيّدة على رئيس قسم وفوق",
    en: "Finance is restricted to dept head and above",
  },
  "finance.locked.body": {
    ar: "كلّم المدير لو محتاج تسجّل أي حركة مالية",
    en: "Talk to a manager if you need to record a transaction",
  },

  // Task deadline reminders (in-app + desktop notifications)
  "tasks.reminder.dueSoon": { ar: "موعد التسليم قرّب", en: "Task due soon" },
  "tasks.reminder.overdue": { ar: "تجاوزت موعد التاسك", en: "Task overdue" },
  "tasks.reminder.in": { ar: "بعد", en: "in" },
  "tasks.reminder.lateBy": { ar: "متأخرة بـ", en: "late by" },
  "tasks.reminder.minutes": { ar: "دقيقة", en: "min" },
  "tasks.reminder.deliveryStillOk": {
    ar: "موعد التسليم للعميل لسا في وقت",
    en: "Client delivery date still has slack",
  },

  // Notification bell + inbox
  "notifications.title": { ar: "الإشعارات", en: "Notifications" },
  "notifications.empty": { ar: "ما فيه إشعارات بعد", en: "No notifications yet" },
  "notifications.allRead": { ar: "الكل مقروء", en: "All read" },

  // Smart Insights panel — home page
  "insights.heading": { ar: "تنبيهات ذكية", en: "Smart insights" },
  "insights.subheading": {
    ar: "النظام يراقب 24/7 ويرفع لك أي شي يحتاج قرار",
    en: "Live monitoring — surfaces anything that needs your call",
  },
  "insights.allClear.title": { ar: "كل شي تمام", en: "All clear" },
  "insights.allClear.desc": {
    ar: "ما فيه تنبيهات اللحين — استمر",
    en: "Nothing flagged right now — keep going",
  },

  // Web Push (mobile + desktop notifications when the tab is closed)
  "push.on": { ar: "التنبيهات شغّالة", en: "Push on" },
  "push.off": { ar: "فعّل التنبيهات", en: "Enable push" },
  "push.enabling": { ar: "جاري التفعيل...", en: "Enabling..." },
  "push.unsupported.label": { ar: "غير مدعوم", en: "Unsupported" },
  "push.unsupported.desc": {
    ar: "متصفّحك ما يدعم التنبيهات الفورية. جرّب Chrome أو Edge.",
    en: "Your browser doesn't support push. Try Chrome or Edge.",
  },
  "push.iosHint.title": {
    ar: "على iPhone لازم تثبّت الموقع كتطبيق أول",
    en: "On iPhone you must install the app first",
  },
  "push.iosHint.step1": {
    ar: "افتح الموقع في Safari",
    en: "Open the site in Safari",
  },
  "push.iosHint.step2": {
    ar: 'اضغط زر "مشاركة" → "إضافة للشاشة الرئيسية"',
    en: 'Tap Share → "Add to Home Screen"',
  },
  "push.iosHint.step3": {
    ar: "افتح SRB من أيقونة الشاشة الرئيسية وفعّل التنبيهات",
    en: "Open SRB from the home-screen icon and enable push",
  },
  "push.error.permission": {
    ar: "ما عطيتنا صلاحية التنبيهات. غيّرها من إعدادات المتصفح.",
    en: "Notification permission denied. Change it in browser settings.",
  },
  "push.error.notConfigured": {
    ar: "السيرفر مب مفعّل عليه التنبيهات الفورية بعد. كلّم الرئيس.",
    en: "Push isn't configured on the server yet. Contact the owner.",
  },
  "push.error.serverReject": {
    ar: "السيرفر رفض الاشتراك. جرّب لاحقاً.",
    en: "Server rejected the subscription. Try again later.",
  },
  "push.error.generic": {
    ar: "صار خطأ غير متوقع",
    en: "Unexpected error",
  },

  // Misc
  "brand.internal": { ar: "داخلي", en: "Internal" },
  "time.today": { ar: "اليوم", en: "Today" },
  "time.yesterday": { ar: "أمس", en: "Yesterday" },
  "time.days": { ar: "{n} يوم", en: "{n} day(s)" },

  // ---------------------------------------------------------------------------
  // Task work delivery (Submit Work)
  // ---------------------------------------------------------------------------
  "submission.title": { ar: "تسليم الشغل", en: "Submit work" },
  "submission.linkLabel": { ar: "رابط (اختياري)", en: "Link (optional)" },
  "submission.fileLabel": { ar: "ملف / صورة (اختياري)", en: "File / image (optional)" },
  "submission.fileHint": {
    ar: "JPG · PNG · GIF · PDF — حد أقصى 10 ميجا",
    en: "JPG · PNG · GIF · PDF — max 10 MB",
  },
  "submission.noteLabel": { ar: "ملاحظة (اختياري)", en: "Note (optional)" },
  "submission.notePlaceholder": {
    ar: "ملاحظات للمراجع — مختصرة",
    en: "Short notes for the reviewer",
  },
  "submission.submit": { ar: "سلّم المهمة", en: "Submit task" },
  "submission.send": { ar: "أرسل", en: "Send" },
  "submission.empty": {
    ar: "ما فيه تسليم بعد",
    en: "No submissions yet",
  },
  "submission.tooLarge": {
    ar: "حجم الملف أكبر من 10 ميجا",
    en: "File larger than 10 MB",
  },
  "submission.assigneeWaiting": {
    ar: "تسليمك تحت المراجعة — في انتظار الرئيس",
    en: "Submitted — waiting for owner review",
  },
  "submission.awaitingReview": {
    ar: "في انتظار مراجعتك",
    en: "Awaiting your review",
  },
  "submission.approve": { ar: "موافقة", en: "Approve" },
  "submission.requestChanges": { ar: "طلب تعديل", en: "Request changes" },
  "submission.reasonPlaceholder": {
    ar: "اكتب السبب — يوصل للموظف",
    en: "Write the reason — sent to the employee",
  },
  "submission.reasonRequired": {
    ar: "اكتب سبب طلب التعديل",
    en: "Write a reason for the change request",
  },
  "submission.reviewNotes": { ar: "ملاحظات المراجعة", en: "Review notes" },
  "submission.attachment": { ar: "مرفق", en: "Attachment" },
  "submission.status.pending": { ar: "قيد المراجعة", en: "Pending review" },
  "submission.status.approved": { ar: "معتمد", en: "Approved" },
  "submission.status.changes_requested": {
    ar: "طُلب تعديل",
    en: "Changes requested",
  },

  // Polished submission UI (smart link / drag-drop / review panel)
  "submission.urlLabel": { ar: "رابط التسليم", en: "Submission link" },
  "submission.urlPlaceholder": {
    ar: "الصق رابط Drive أو Figma أو YouTube...",
    en: "Paste a Drive, Figma, or YouTube link...",
  },
  "submission.dropZoneIdle": {
    ar: "اسحب الملف هنا أو اضغط للاختيار",
    en: "Drag a file here or click to choose",
  },
  "submission.dropZoneActive": {
    ar: "أفلت الملف هنا",
    en: "Drop the file here",
  },
  "submission.uploading": { ar: "جاري الرفع...", en: "Uploading..." },
  "submission.uploadFailed": {
    ar: "فشل رفع الملف",
    en: "Upload failed",
  },
  "submission.badType": {
    ar: "نوع الملف غير مدعوم — JPG / PNG / GIF / PDF",
    en: "Unsupported file type — JPG / PNG / GIF / PDF",
  },
  "submission.replaceFile": { ar: "استبدل", en: "Replace" },
  "submission.removeFile": { ar: "حذف", en: "Remove" },
  "submission.requireOne": {
    ar: "أرفق رابط أو ملف على الأقل",
    en: "Attach a link or a file",
  },
  "submission.submitButton": {
    ar: "📤 سلّم المهمة للمراجعة",
    en: "📤 Submit for review",
  },
  "submission.submitting": { ar: "جاري التسليم...", en: "Submitting..." },
  "submission.toastSubmitted": {
    ar: "✅ تم التسليم — بانتظار موافقة المسؤول",
    en: "✅ Submitted — awaiting owner approval",
  },
  "submission.toastApproved": {
    ar: "✅ تم قبول التسليم",
    en: "✅ Submission approved",
  },
  "submission.toastRejected": {
    ar: "↩️ تم إرسال الطلب للموظف",
    en: "↩️ Sent back to the employee",
  },
  "submission.reviewTitle": {
    ar: "تسليم بانتظار مراجعتك",
    en: "Submission awaiting your review",
  },
  "submission.approveButton": { ar: "قبلت التسليم", en: "Approve" },
  "submission.rejectButton": { ar: "أعد الشغل", en: "Send back" },
  "submission.reasonPlaceholderRich": {
    ar: "اكتب سبب الإعادة...",
    en: "Reason for sending back...",
  },
  "submission.approvedHeader": {
    ar: "تم قبول هذا التسليم",
    en: "Submission approved",
  },
  "submission.changesRequestedHeader": {
    ar: "طُلب منك إعادة العمل",
    en: "Changes requested",
  },
  "submission.history": { ar: "سجل التسليمات", en: "Submission history" },
  "submission.inReviewBadge": {
    ar: "بانتظار المراجعة",
    en: "Awaiting review",
  },

  // ---------------------------------------------------------------------------
  // Project phases
  // ---------------------------------------------------------------------------
  "phases.title": { ar: "مراحل المشروع", en: "Project phases" },
  "phases.empty": { ar: "ما فيه مراحل بعد", en: "No phases yet" },
  "phases.addPhase": { ar: "أضف مرحلة", en: "Add phase" },
  "phases.create": { ar: "إنشاء المرحلة", en: "Create phase" },
  "phases.startFromTemplate": {
    ar: "ابدأ من قالب جاهز",
    en: "Start from a template",
  },
  "phases.template.none": { ar: "بدون مراحل", en: "No phases" },
  "phases.field.name": { ar: "اسم المرحلة", en: "Phase name" },
  "phases.field.description": { ar: "وصف (اختياري)", en: "Description (optional)" },
  "phases.field.deadline": { ar: "موعد المرحلة", en: "Phase deadline" },
  "phases.tasksEmpty": {
    ar: "ما فيه مهام في المرحلة بعد",
    en: "No tasks in this phase yet",
  },
  "phases.proof": { ar: "دليل التسليم", en: "Delivery proof" },
  "phases.pendingReview": { ar: "في انتظار المراجعة", en: "Pending review" },
  "phases.reviewMe": { ar: "لازم تراجع التسليم", en: "Review the submission" },
  "phases.approve": { ar: "اعتماد المرحلة", en: "Approve phase" },
  "phases.unlock": { ar: "فك القفل", en: "Unlock" },
  "phases.confirmDelete": {
    ar: "أكيد تبي تحذف المرحلة؟",
    en: "Delete this phase?",
  },
  "phases.completeHeader": {
    ar: "أنهِ المرحلة — أرفق دليل تسليم",
    en: "Complete phase — attach delivery proof",
  },
  "phases.completeButton": { ar: "أنهِ المرحلة", en: "Complete phase" },
  "phases.status.not_started": { ar: "لم تبدأ", en: "Not started" },
  "phases.status.active": { ar: "جارية", en: "Active" },
  "phases.status.completed": { ar: "مكتملة", en: "Completed" },
  "phases.status.locked": { ar: "مقفولة", en: "Locked" },

  // Clients
  "nav.clients": { ar: "العملاء", en: "Clients" },
  "page.clients.title": { ar: "العملاء", en: "Clients" },
  "page.clients.subtitle": {
    ar: "كل العملاء اللي تعاملنا معاهم — مشاريعهم، إيراداتهم، ومعلومات التواصل",
    en: "Every client we've worked with — projects, revenue, and contacts",
  },
  "clients.count": { ar: "عميل مسجّل", en: "registered clients" },
  "clients.empty.title": { ar: "ما فيه عملاء بعد", en: "No clients yet" },
  "clients.empty.desc": {
    ar: "العملاء يضافون تلقائياً لما تنشئ مشروع وتدخل اسم عميل جديد. تقدر تضيف عميل يدوي من الزر فوق.",
    en: "Clients auto-register when you create a project with a new client name. You can also add one manually with the button above.",
  },
  "clients.searchPlaceholder": {
    ar: "ابحث بالاسم، البراند، أو رقم الهاتف…",
    en: "Search by name, brand, or phone…",
  },
  "clients.action.new": { ar: "عميل جديد", en: "New client" },
  "clients.action.add": { ar: "أضف العميل", en: "Add client" },
  "clients.action.copyPhone": { ar: "انسخ الرقم", en: "Copy number" },
  "clients.copied": { ar: "تم النسخ", en: "Copied" },
  "clients.col.name": { ar: "اسم العميل", en: "Name" },
  "clients.col.phone": { ar: "رقم الهاتف", en: "Phone" },
  "clients.col.projectsCount": { ar: "عدد المشاريع", en: "Projects" },
  "clients.col.totalRevenue": { ar: "إجمالي الإيرادات", en: "Total revenue" },
  "clients.col.contractValue": { ar: "قيمة العقود", en: "Contract value" },
  "clients.col.paidRevenue": { ar: "المدفوع", en: "Collected" },
  "clients.col.lastProject": { ar: "آخر مشروع", en: "Last project" },
  "clients.col.joinedAt": { ar: "تاريخ الانضمام", en: "Joined" },
  "clients.field.name": { ar: "الاسم", en: "Name" },
  "clients.field.phone": { ar: "رقم الهاتف", en: "Phone" },
  "clients.field.email": { ar: "البريد الإلكتروني", en: "Email" },
  "clients.field.notes": { ar: "ملاحظات", en: "Notes" },
  "clients.field.namePlaceholder": { ar: "محمد الكواري", en: "Mohammed Al-Kuwari" },
  "clients.field.phonePlaceholder": { ar: "+974 5xxx xxxx", en: "+974 5xxx xxxx" },
  "clients.field.emailPlaceholder": { ar: "client@example.com", en: "client@example.com" },
  "clients.field.notesPlaceholder": {
    ar: "ملاحظات داخلية عن العميل، تفضيلاته، شروط دفعه…",
    en: "Internal notes about the client, preferences, payment terms…",
  },
  "clients.detail.profile": { ar: "بيانات العميل", en: "Client info" },
  "clients.detail.projects": { ar: "مشاريع العميل", en: "Projects" },
  "clients.detail.summary": { ar: "ملخص مالي", en: "Financial summary" },
  "clients.detail.contractValue": { ar: "قيمة العقود", en: "Contract value" },
  "clients.detail.totalPaid": { ar: "إجمالي المدفوع", en: "Total paid" },
  "clients.detail.completedCount": { ar: "مشاريع مكتملة", en: "Completed projects" },
  "clients.detail.activeCount": { ar: "مشاريع نشطة", en: "Active projects" },
  "clients.detail.save": { ar: "احفظ التغييرات", en: "Save changes" },
  "clients.detail.saving": { ar: "جاري الحفظ…", en: "Saving…" },
  "clients.detail.saved": { ar: "تم الحفظ", en: "Saved" },
  "clients.detail.deleteConfirm": {
    ar: "حذف هذا العميل؟ المشاريع المرتبطة بيه ما راح تنحذف، بس ما راح تكون مرتبطة بأي عميل.",
    en: "Delete this client? Their projects won't be deleted but will lose the client link.",
  },
  "clients.detail.delete": { ar: "احذف العميل", en: "Delete client" },
  "clients.proj.title": { ar: "اسم المشروع", en: "Project" },
  "clients.proj.type": { ar: "النوع", en: "Type" },
  "clients.proj.status": { ar: "الحالة", en: "Status" },
  "clients.proj.budget": { ar: "الميزانية", en: "Budget" },
  "clients.proj.paid": { ar: "المدفوع", en: "Paid" },
  "clients.proj.remaining": { ar: "المتبقي", en: "Remaining" },
  "clients.proj.startedAt": { ar: "تاريخ البدء", en: "Started" },
  "clients.proj.empty": {
    ar: "لا توجد مشاريع لهذا العميل بعد.",
    en: "No projects for this client yet.",
  },
  "clients.combobox.empty": {
    ar: "ابدأ بكتابة اسم العميل…",
    en: "Start typing the client name…",
  },
  "clients.combobox.noResults": {
    ar: "ما فيه عميل بهذا الاسم. اختر «إضافة عميل جديد» أدناه.",
    en: "No matching client. Pick \"Add new client\" below.",
  },
  "clients.combobox.addNew": {
    ar: "➕ إضافة عميل جديد:",
    en: "➕ Add new client:",
  },
  "clients.combobox.linked": { ar: "مرتبط", en: "Linked" },
  "clients.combobox.clear": { ar: "إلغاء الاختيار", en: "Clear" },

  // Brand column + computed status badge
  "clients.col.brand": { ar: "البراند", en: "Brand" },
  "clients.col.status": { ar: "الحالة", en: "Status" },
  "clients.status.active": { ar: "نشط", en: "Active" },
  "clients.status.inactive": { ar: "منتهي", en: "Finished" },
  "clients.field.brand": { ar: "اسم البراند / الشركة", en: "Brand / company" },
  "clients.field.brandPlaceholder": {
    ar: "مثال: SRB Agency، مطعم الشرق...",
    en: "e.g. SRB Agency, Al-Sharq Restaurant...",
  },

  // Touchpoint / communication log on the client profile
  "clients.notes.title": { ar: "سجل التواصل والملاحظات", en: "Communication log" },
  "clients.notes.placeholder": {
    ar: "اكتب ملاحظة... مثال: تم التواصل اليوم وأبدى اهتمامه بتجديد العقد",
    en: "Write a note... e.g. Called today, showed interest in renewing the contract",
  },
  "clients.notes.add": { ar: "أضف ملاحظة", en: "Add note" },
  "clients.notes.adding": { ar: "جاري الإضافة…", en: "Adding…" },
  "clients.notes.empty": {
    ar: "لا توجد ملاحظات بعد. ابدأ بتسجيل أول تواصل مع العميل.",
    en: "No notes yet. Start by logging the first touchpoint.",
  },
  "clients.notes.deletedAuthor": { ar: "حساب محذوف", en: "Deleted account" },
  "clients.notes.deleteConfirm": {
    ar: "حذف هذه الملاحظة؟",
    en: "Delete this note?",
  },
  "clients.notes.delete": { ar: "حذف", en: "Delete" },
};

/** Translate a key into a given locale. Falls back to English if key missing. */
export function translate(key: string, locale: Locale): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en ?? key;
}

```

---

## `prisma/schema.prisma`

**Lines:** 980

```prisma
// SRB — Real company management system (Phase 2)
// Replaces the in-memory simulation with persistent SQLite storage.

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Login + role; mirrors the existing auth.db.authorized_users table,
// but owned by Prisma going forward (single source of truth).
//
// Role hierarchy (top → bottom), enforced by lib/auth/roles.ts:
//   admin           → الرئيس (Owner) — sees full finance, total control,
//                     access to PermissionOverride control panel
//   manager         → المدير (Admin) — approves users, assigns roles up to head,
//                     runs ops, no finance totals
//   head            → رئيس جميع الأقسام (Head of All Departments) — cross-dept
//                     visibility on projects/tasks/submissions; can edit, reassign
//                     and cancel any task across departments. No finance, no
//                     people-management, no system settings.
//   department_lead → رئيس قسم — manages their dept's projects, expenses, salaries, income
//   employee        → موظف — works on own tasks
model User {
  id          String    @id @default(cuid())
  email       String    @unique
  name        String
  role        String    @default("employee") // admin | manager | head | department_lead | employee
  department  String?
  active      Boolean   @default(true)
  // First-approval timestamp. null = pending admin approval (never approved yet).
  // Not-null = admin has approved this account (may still be toggled inactive later).
  approvedAt  DateTime?
  createdAt   DateTime  @default(now())
  lastLoginAt DateTime?

  // Employee profile
  jobTitle     String?
  phone        String?
  salaryQar    Float?
  hiredAt      DateTime?
  avatarUrl    String?

  // Relations
  tasksAssigned      Task[]             @relation("TaskAssignee")
  tasksCreated       Task[]             @relation("TaskCreator")
  taskCollaborations TaskCollaborator[]
  taskSubmissions    TaskSubmission[]   @relation("TaskSubmissionSubmitter")
  taskReviews        TaskSubmission[]   @relation("TaskSubmissionReviewer")
  comments           TaskComment[]
  updates            TaskUpdate[]
  memberships        ProjectMember[]
  leadsProjects      Project[]          @relation("ProjectLead")
  auditEntries       AuditLog[]         @relation("AuditActor")
  meetings           ClientMeeting[]    @relation("MeetingOwner")
  shootCrew          PhotoShootCrew[]
  heldEquipment      Equipment[]        @relation("EquipmentHolder")
  badges             UserBadge[]
  badgesAssigned     UserBadge[]        @relation("BadgeAssignedBy")
  notifications      Notification[]     @relation("NotificationRecipient")
  pushSubscriptions  PushSubscription[] @relation("PushSubscriptionUser")
  phaseSubmissions   ProjectPhase[]     @relation("PhaseSubmitter")
  phaseApprovals     ProjectPhase[]     @relation("PhaseApprover")
  permissionOverrides PermissionOverride[] @relation("PermissionOverrideUser")
  permissionGrants    PermissionOverride[] @relation("PermissionOverrideGrantedBy")
  briefApprovals     ProjectBrief[]     @relation("BriefApprover")
  assetsAdded        ProjectAsset[]     @relation("AssetAddedBy")
  deliveriesCreated  ClientDelivery[]   @relation("DeliveryCreatedBy")
  clientNotesAuthored ClientNote[]      @relation("ClientNoteAuthor")

  @@index([active])
  @@index([role])
}

// ---------------------------------------------------------------------------
// Creative brief — one record per project. Captures everything the creative
// team needs upfront so a designer / shooter / editor doesn't have to chase
// the account manager for context.
//
// Approval lifecycle: draft → pending_review → approved. Anyone with brief:edit
// can author / update; only brief:approve can flip to approved (which locks it
// from further edits unless the approver re-opens it).
// ---------------------------------------------------------------------------
model ProjectBrief {
  id              String   @id @default(cuid())
  projectId       String   @unique
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // The classic creative-brief fields. All optional so a partial brief is
  // still saveable and the team can fill in pieces as they're discovered.
  objective       String?  // الهدف من الحملة / المشروع
  targetAudience  String?  // الفئة المستهدفة
  styleNotes      String?  // الستايل والمزاج
  refs            String?  // روابط ومراجع (newline-separated)
  deliverables    String?  // المخرجات النهائية
  platforms       String?  // المنصات (Instagram, TikTok, ...)
  sizes           String?  // المقاسات والأبعاد
  notes           String?  // ملاحظات إضافية

  // Lifecycle
  approvalStage   String   @default("draft") // draft | pending_review | approved
  approvedById    String?
  approvedBy      User?    @relation("BriefApprover", fields: [approvedById], references: [id], onDelete: SetNull)
  approvedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([approvalStage])
}

// ---------------------------------------------------------------------------
// Project package tracker — what the agency promised the client (X posts,
// Y reels, Z shoots, ...) and how much of that has actually been delivered.
// 1-to-1 with Project. Counters are incremented manually by the project lead
// when a deliverable goes out — we don't try to auto-derive from tasks
// because the same task may produce 3 reels or 0, depending on scope.
// ---------------------------------------------------------------------------
model ProjectPackage {
  id        String  @id @default(cuid())
  projectId String  @unique
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Targets — what the package promised
  targetPosts   Int @default(0)
  targetReels   Int @default(0)
  targetVideos  Int @default(0)
  targetShoots  Int @default(0)
  targetStories Int @default(0)

  // Completed — what the team has actually shipped to the client
  completedPosts   Int @default(0)
  completedReels   Int @default(0)
  completedVideos  Int @default(0)
  completedShoots  Int @default(0)
  completedStories Int @default(0)

  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ---------------------------------------------------------------------------
// Project asset — single bucket for every visual reference, mood-board image,
// brand asset, and final deliverable that lives inside a project. The `kind`
// column splits them into UI lanes; the file/url fields work for both
// uploaded files (saved under /uploads via lib/uploads.ts) and external
// links (Drive, Figma, dribbble, ...).
// ---------------------------------------------------------------------------
model ProjectAsset {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // moodboard | reference | brand | deliverable | other
  kind        String   @default("moodboard")
  title       String?
  caption     String?

  // One of fileUrl / externalUrl is required at the application level.
  fileUrl     String?
  fileName    String?
  fileType    String?
  externalUrl String?

  addedById   String?
  addedBy     User?    @relation("AssetAddedBy", fields: [addedById], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())

  @@index([projectId, kind])
  @@index([projectId, createdAt])
}

// ---------------------------------------------------------------------------
// Client delivery — one row per individual deliverable handed to the client.
// Tracks the full lifecycle: drafting → sent → viewed → changes_requested
// (loops back to drafting) OR approved (terminal). Each transition is
// timestamped so we can answer "how long did the client take to approve?"
// and "how many revisions did this take?".
//
// This is INTERNAL tracking — the client doesn't sign in. The "viewed" and
// "approved" timestamps are flipped manually by the account manager based
// on what they hear from the client.
// ---------------------------------------------------------------------------
model ClientDelivery {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  title       String
  // post | reel | video | photo | other
  kind        String   @default("post")

  // drafting | sent | viewed | changes_requested | approved
  status      String   @default("drafting")

  deliveryUrl String?
  previewUrl  String?

  // Lifecycle timestamps. Each is set when status flips to that state.
  sentAt              DateTime?
  viewedAt            DateTime?
  changesRequestedAt  DateTime?
  approvedAt          DateTime?

  clientFeedback  String?
  notes           String?

  createdById String?
  createdBy   User?    @relation("DeliveryCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, status])
  @@index([projectId, createdAt])
}

// ---------------------------------------------------------------------------
// Permission overrides — the Owner can flip individual (module, action) pairs
// on a per-user basis, on top of the role default matrix in
// lib/auth/permissions.ts. `allowed=true` GRANTS a permission the role would
// not normally have; `allowed=false` REVOKES one the role would normally have.
// Absence of a row means "use role default". This lets the Owner build custom
// permission profiles without inventing new roles.
// ---------------------------------------------------------------------------
model PermissionOverride {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation("PermissionOverrideUser", fields: [userId], references: [id], onDelete: Cascade)
  // Module + action are stored as plain strings (TS union types in
  // lib/auth/permissions.ts are the source of truth). New modules added later
  // never require a DB migration.
  module      String
  action      String
  allowed     Boolean
  grantedById String?
  grantedBy   User?    @relation("PermissionOverrideGrantedBy", fields: [grantedById], references: [id], onDelete: SetNull)
  reason      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, module, action])
  @@index([userId])
}

// Skill / role badges that mark what a user is qualified to do.
// Replaces / augments the free-form jobTitle string with structured tags.
// Used by the smart task router to filter & rank candidates.
model Badge {
  id        String   @id @default(cuid())
  // Stable slug for code lookups (photographer, designer, sales, ...).
  slug      String   @unique
  labelAr   String
  labelEn   String
  // Single emoji (📸, 🎨) — keeps the UI dense without an icon font.
  icon      String   @default("⭐")
  colorHex  String   @default("#10b981")
  sortOrder Int      @default(0)
  // System badges are seeded at boot and shouldn't be deletable from the UI.
  // Custom badges (admin-created) are deletable.
  builtin   Boolean  @default(false)
  createdAt DateTime @default(now())

  users UserBadge[]

  @@index([sortOrder])
}

// Many-to-many between User and Badge with audit info on the assignment.
model UserBadge {
  userId       String
  badgeId      String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge        Badge    @relation(fields: [badgeId], references: [id], onDelete: Cascade)
  assignedAt   DateTime @default(now())
  assignedById String?
  assignedBy   User?    @relation("BadgeAssignedBy", fields: [assignedById], references: [id], onDelete: SetNull)

  @@id([userId, badgeId])
  @@index([badgeId])
  @@index([userId])
}

// ---------------------------------------------------------------------------
// Client (العميل) — the buyer side of the agency. One client can hold many
// projects (one-to-many via Project.clientId). Auto-created in
// app/projects/actions.ts when a project's clientName field is a new name —
// existing names re-use the row, so we never end up with duplicates from
// a typo in the project form.
//
// Indexes on name + phone keep the /clients search snappy at the
// 1k-row scale the system is sized for. Sorting on the list page is
// handled by joining latest project createdAt — see app/clients/page.tsx.
// ---------------------------------------------------------------------------
model Client {
  id        String    @id @default(cuid())
  name      String
  // Brand / company name — separate from `name` so a single client (e.g. an
  // agency contact "Mohammed Al-Kuwari") can hold multiple brand identities.
  // Auto-populated from the project form when a client is first linked to a
  // project that supplies a brand; never overwritten if already set.
  brandName String?
  email     String?
  phone     String?
  // Free-form textarea on the profile page (general notes about the client).
  // Distinct from the chronological `noteEntries` relation below, which logs
  // dated touchpoints with the user attribution and a separate row per entry.
  notes     String?
  createdAt DateTime  @default(now())
  // @default(now()) is required so `prisma db push` can backfill existing
  // rows when the column is added to a non-empty production database. Prisma
  // emits `DEFAULT CURRENT_TIMESTAMP` at the SQL level for SQLite, which the
  // ALTER TABLE ADD COLUMN step needs to satisfy NOT NULL on existing rows.
  // Without it, `db push` errors with "Added the required column updatedAt
  // ... without a default value" and the start script (db push && next start)
  // never reaches `next start`, taking the whole deploy down.
  updatedAt DateTime  @default(now()) @updatedAt
  projects  Project[]
  // Chronological touchpoint log — see ClientNote. Named `noteEntries` (not
  // `notes`) to avoid colliding with the free-form `notes` text field above.
  noteEntries ClientNote[]

  @@index([name])
  @@index([phone])
  @@index([brandName])
}

// ---------------------------------------------------------------------------
// Client touchpoint log — one row per "we talked to this client" entry.
// Lives on the client profile page as a chronological feed (newest first)
// so the team has a single source of truth for "when did we last reach out
// and what was said". Distinct from `Client.notes` (free-form general
// description that doesn't track time/author). Distinct from
// `ClientMeeting` (formal scheduled meetings with reminders / agenda).
// ---------------------------------------------------------------------------
model ClientNote {
  id        String   @id @default(cuid())
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  content   String
  createdAt DateTime @default(now())
  // Author. SetNull on delete so a deleted user doesn't take their notes
  // with them — the entry stays for the audit trail with author=null.
  createdById String?
  author      User?  @relation("ClientNoteAuthor", fields: [createdById], references: [id], onDelete: SetNull)

  @@index([clientId, createdAt])
  @@index([createdById])
}

model Project {
  id           String    @id @default(cuid())
  title        String
  description  String?
  clientId     String?
  client       Client?   @relation(fields: [clientId], references: [id], onDelete: SetNull)
  // Brand / company under which this project is delivered. May differ from
  // the client's display name (e.g. one agency contact owning multiple
  // brands). Synced into Client.brandName the first time a client gets a
  // brand assigned; subsequent project entries never overwrite the client's
  // existing brand — that's an explicit edit on the client profile.
  brandName    String?
  type         String? // video | photo | event | digital_campaign | web | design | branding | other
  status       String    @default("active") // active | on_hold | completed | cancelled
  priority     String    @default("normal") // low | normal | high | urgent
  budgetQar    Float     @default(0)
  startedAt    DateTime  @default(now())
  deadlineAt   DateTime?
  completedAt  DateTime?
  progressPct  Int       @default(0) // 0..100 — manual or computed from tasks
  // Billing type — one_time: budget is a single payment; monthly: budget is the recurring monthly amount.
  billingType  String    @default("one_time") // one_time | monthly
  // Monthly billing cycle length (days). Default 30 = every 30 days from the
  // cycle anchor. Overridable per-project so a client on a 15/45/60-day cycle fits.
  billingCycleDays Int    @default(30)
  // When the next invoice should go out. Set on create for monthly projects
  // (= startedAt + billingCycleDays) and advanced each time an invoice is recorded.
  // Null for one-time projects.
  nextInvoiceDueAt DateTime?
  // When the most recent invoice was collected — used for status badges and
  // to keep the "already paid this cycle?" check fast.
  lastInvoicedAt   DateTime?
  // Per-cycle reminder fire tracking. Reset to null when an invoice is recorded
  // (advancing to the next cycle) so a fresh set of reminders fires for it.
  invoiceReminderBeforeSentAt   DateTime?
  invoiceReminderDueSentAt      DateTime?
  invoiceReminderOverdueSentAt  DateTime?
  leadId       String?
  lead         User?     @relation("ProjectLead", fields: [leadId], references: [id], onDelete: SetNull)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  members      ProjectMember[]
  tasks        Task[]
  transactions Transaction[]
  shoots       PhotoShoot[]
  phases       ProjectPhase[]
  brief        ProjectBrief?
  package      ProjectPackage?
  assets       ProjectAsset[]
  deliveries   ClientDelivery[]
  freelancers  ProjectFreelancer[]

  @@index([status])
  @@index([clientId])
  @@index([leadId])
  @@index([deadlineAt])
  @@index([nextInvoiceDueAt])
}

// ---------------------------------------------------------------------------
// Project phases — ordered milestones inside a project. Each phase locks the
// next one until the owner approves its completion. Tasks may optionally
// belong to a phase (the field is nullable, so existing tasks are untouched).
// ---------------------------------------------------------------------------
model ProjectPhase {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  order       Int      @default(0)
  name        String
  description String?
  deadlineAt  DateTime?

  // Lifecycle:
  //   not_started → set on creation (except first phase, which starts active)
  //   active      → currently the working phase
  //   completed   → owner approved completion
  //   locked      → blocked until the previous phase is approved
  status      String   @default("locked")

  // Phase delivery — proof submitted by the employee + review state.
  proofLinkUrl   String?
  proofFileUrl   String?
  proofFileName  String?
  proofFileType  String?
  submittedAt    DateTime?
  submittedById  String?
  submittedBy    User?    @relation("PhaseSubmitter", fields: [submittedById], references: [id], onDelete: SetNull)

  reviewNotes    String?
  reviewedAt     DateTime?
  approvedById   String?
  approvedBy     User?    @relation("PhaseApprover", fields: [approvedById], references: [id], onDelete: SetNull)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tasks       Task[]   @relation("TaskPhase")

  @@index([projectId, order])
  @@index([projectId, status])
}

model ProjectMember {
  projectId String
  userId    String
  role      String? // lead | designer | developer | editor | account | sales | ...
  addedAt   DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([projectId, userId])
}

model Task {
  id             String    @id @default(cuid())
  projectId      String?
  project        Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  title          String
  description    String?
  status         String    @default("todo") // todo | in_progress | in_review | done | blocked
  priority       String    @default("normal") // low | normal | high | urgent
  assigneeId     String?
  assignee       User?     @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  creatorId      String
  creator        User      @relation("TaskCreator", fields: [creatorId], references: [id])
  dueAt          DateTime?
  startedAt      DateTime?
  completedAt    DateTime?
  estimatedHours Float?
  actualHours    Float?
  order          Int       @default(0) // for Kanban column ordering
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Reminder fire tracking — fired by /api/tasks/upcoming poller (1 hour before
  // dueAt) and /api/tasks/overdue (when dueAt has passed but the task is still
  // open AND project.deadlineAt has NOT yet passed — i.e. the slack window where
  // a task is late but the project can still be saved). Reset to null when
  // dueAt is rescheduled forward so a fresh reminder fires for the new window.
  reminderBeforeSentAt  DateTime?
  reminderOverdueSentAt DateTime?

  // Optional phase membership — when set, this task counts toward the
  // phase's progress bar and gates phase completion. Existing tasks remain
  // unaffected because the field is optional.
  phaseId String?
  phase   ProjectPhase? @relation("TaskPhase", fields: [phaseId], references: [id], onDelete: SetNull)

  // ------------------------------------------------------------------------
  // Latest work-delivery snapshot — flat fields on the Task itself so the
  // kanban / mobile UI can read the current submission without joining the
  // history table. Updated each time the assignee submits work; cleared when
  // the owner approves (status flips to done) or asks for changes.
  // The full audit trail of every submission still lives in TaskSubmission.
  // ------------------------------------------------------------------------
  submissionUrl       String?
  submissionFileUrl   String?
  submissionFileName  String?
  submissionFileType  String?
  submissionNote      String?
  submittedAt         DateTime?
  reviewNote          String?   // owner's reason when requesting changes
  reviewedAt          DateTime?

  comments      TaskComment[]
  updates       TaskUpdate[]
  collaborators TaskCollaborator[]
  submissions   TaskSubmission[]

  @@index([projectId])
  @@index([assigneeId])
  @@index([creatorId])
  @@index([status])
  @@index([dueAt])
  @@index([assigneeId, status])
  @@index([phaseId])
}

// ---------------------------------------------------------------------------
// Task work delivery — when an assignee submits work for review, we keep a
// row per submission so the history (link, attached file, owner notes) is
// preserved even after a "request changes" round-trip.
// ---------------------------------------------------------------------------
model TaskSubmission {
  id          String   @id @default(cuid())
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  submitterId String
  submitter   User     @relation("TaskSubmissionSubmitter", fields: [submitterId], references: [id], onDelete: Cascade)

  linkUrl     String?
  fileUrl     String?
  fileName    String?
  fileType    String?
  fileSize    Int?
  note        String?

  // pending | approved | changes_requested
  status      String   @default("pending")

  // Revision number — 1 for the first submission on a task, increments by
  // 1 each time the assignee re-submits after a "request changes" round.
  // Computed at insert time by counting prior submissions on the same task.
  revisionNumber Int     @default(1)

  reviewerId  String?
  reviewer    User?    @relation("TaskSubmissionReviewer", fields: [reviewerId], references: [id], onDelete: SetNull)
  reviewNotes String?
  reviewedAt  DateTime?

  createdAt   DateTime @default(now())

  @@index([taskId, createdAt])
  @@index([submitterId])
  @@index([status])
}

// Secondary assignees on a task — beyond the primary assignee.
// Used for tasks that multiple people work on together.
model TaskCollaborator {
  taskId  String
  userId  String
  task    Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  addedAt DateTime @default(now())

  @@id([taskId, userId])
}

model TaskComment {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now())

  @@index([taskId])
  @@index([authorId])
}

model TaskUpdate {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  actorId   String
  actor     User     @relation(fields: [actorId], references: [id])
  type      String // created | status_change | assignee_change | priority_change | due_change
  fromValue String?
  toValue   String?
  createdAt DateTime @default(now())

  @@index([taskId])
  @@index([actorId])
}

// Manual-entry accounting ledger.
model Transaction {
  id          String    @id @default(cuid())
  projectId   String?
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  kind        String // income | expense
  category    String // project_payment | salary | bonus | tool | ad | overhead | refund | freelance | other
  amountQar   Float // always positive; sign comes from kind
  description String?
  occurredAt  DateTime
  // Recurrence — none: one-time; monthly: recurring every month starting occurredAt until recurrenceEndsAt (or forever).
  recurrence       String    @default("none") // none | monthly
  recurrenceEndsAt DateTime?
  // Optional link to a per-project freelancer. When set, the transaction
  // counts toward the freelancer's "paid so far" total. Always paired with
  // category = "freelance" and a non-null projectId, but enforced at the
  // application level so legacy rows continue to work.
  freelancerId String?
  freelancer   ProjectFreelancer? @relation(fields: [freelancerId], references: [id], onDelete: SetNull)
  createdAt        DateTime  @default(now())
  createdById      String?

  @@index([occurredAt])
  @@index([projectId])
  @@index([kind])
  @@index([recurrence])
  @@index([freelancerId])
}

// ---------------------------------------------------------------------------
// Project freelancer — per-project contractor (photographer, designer,
// videographer, ...) hired for THIS project only. Their salary is paid out
// of the project budget, not the company payroll. Linked to Transaction so
// the project profit widget automatically subtracts every payment.
//
// Why a dedicated model instead of just expense rows:
//   1. Track the AGREED total separately from PAID-so-far (compute remaining)
//   2. One stable identity ("Ahmed the photographer") that survives multiple
//      payment instalments
//   3. Keep their phone / WhatsApp on file without bloating the User table
//   4. Future-proof for "history of freelancers we've used" reports
// ---------------------------------------------------------------------------
model ProjectFreelancer {
  id        String  @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  name  String
  // Free-form role label. We seed common roles client-side (مصور، ديزاينر،
  // مونتير، صوت، ...) but allow custom because every project may need a
  // different specialty.
  role  String  @default("photographer")
  phone String?
  email String?

  // What the freelancer was promised. The "paid so far" total is computed
  // live from Transaction rows linked via freelancerId.
  agreedAmountQar Float   @default(0)
  // Free-text payment terms ("50% upfront, 50% on delivery", "monthly", ...).
  paymentTerms    String?

  // active | completed | cancelled. Doesn't delete payment history when set
  // to cancelled — only hides the freelancer from the active list.
  status String @default("active")

  notes String?

  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  payments Transaction[]

  @@index([projectId, status])
}

// System-level settings (single row).
model AppSetting {
  id                Int     @id @default(1)
  companyName       String  @default("SRB")
  defaultCurrency   String  @default("QAR")
  fiscalYearStart   Int     @default(1) // month 1 = January
  notificationsOn   Boolean @default(true)
  simulationEnabled Boolean @default(false) // kept off

  // Theme — admin can customize branding colors (CSS variables).
  brandColor  String @default("#10b981") // emerald-500
  accentColor String @default("#0ea5e9") // sky-500
  logoPath    String @default("/srb-logo-white.png") // path under public/ (white-on-transparent PNG)
}

// Tamper-resistant admin action trail. Every sensitive mutation writes one row
// so you can answer "who approved this user", "when was that salary changed", etc.
model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  actor      User?    @relation("AuditActor", fields: [actorId], references: [id], onDelete: SetNull)
  actorEmail String   // Snapshot — survives if actor is deleted
  action     String   // e.g. "user.approve", "user.deactivate", "user.role_change", "tx.delete"
  targetType String?  // e.g. "user", "project", "task", "transaction"
  targetId   String?
  targetLabel String? // Human-readable target ("هادي · hadi.233363@gmail.com")
  metadata   String?  // JSON string with extra details (before/after values, reason)
  createdAt  DateTime @default(now())

  @@index([createdAt])
  @@index([actorId])
  @@index([action])
  @@index([targetType, targetId])
}

// Client meetings — intake requests + pitch calls + check-ins with clients.
// Tracks the full lifecycle: scheduled → (reminder fired) → done | cancelled | no_show.
model ClientMeeting {
  id          String   @id @default(cuid())
  clientName  String   // اسم العميل / الشخص المسؤول
  companyName String?  // اسم الشركة (اختياري)
  phone       String?
  email       String?

  // Client's digital footprint (so the team opens & reviews before the meeting)
  instagramHandle String? // @handle or full URL — both accepted
  tiktokHandle    String?
  websiteUrl      String?
  socialNotes     String? // Free-form: "also on snapchat, 500K followers"

  // Meeting logistics
  meetingAt    DateTime
  durationMin  Int       @default(60)
  location     String?   // "Office" | "Client site" | physical address | "Online"
  meetingLink  String?   // Zoom / Google Meet / Teams URL
  agendaNotes  String?   // Pre-meeting prep: what to discuss / goals

  // Lifecycle
  status       String    @default("scheduled") // scheduled | done | cancelled | no_show
  outcomeNotes String?   // Post-meeting: what was agreed, next steps

  // Assignment
  ownerId String?
  owner   User?   @relation("MeetingOwner", fields: [ownerId], references: [id], onDelete: SetNull)

  // Reminder tracking — set to the wall-clock time the "1h before" alert fired.
  // Null means the reminder hasn't gone out yet.
  reminderSentAt DateTime?

  // Audit
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?

  @@index([meetingAt])
  @@index([status])
  @@index([ownerId])
  @@index([status, meetingAt])
}

// ---------------------------------------------------------------------------
// Photography production system
// ---------------------------------------------------------------------------
// A PhotoShoot is the on-location production day for a project. It pins down
// the WHO (crew), WHEN (shootDate + duration), WHERE (location + map), and
// WHAT (equipment reservations + shot list). Crew members are employees —
// this is internal-facing, unlike ClientMeeting which is about the buyer.

model PhotoShoot {
  id            String  @id @default(cuid())
  title         String
  projectId     String?
  project       Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  // Timing
  shootDate     DateTime
  durationHours Float    @default(4)

  // Location
  location      String
  locationNotes String?  // floor, landmarks, entry instructions
  mapUrl        String?  // Google Maps / Apple Maps link

  // Logistics
  clientContact String?  // who to call on site
  shotList      String?  // freeform brief / checklist
  referenceUrl  String?  // moodboard / Drive link

  // Lifecycle
  status        String   @default("scheduled") // scheduled | done | cancelled | postponed
  notes         String?

  // Notification tracking — we fire 24h-before AND 1h-before alerts.
  reminderDayBeforeSentAt DateTime?
  reminderHourBeforeSentAt DateTime?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  createdById   String?

  crew          PhotoShootCrew[]
  equipment     PhotoShootEquipment[]

  @@index([shootDate])
  @@index([projectId])
  @@index([status])
  @@index([status, shootDate])
}

// Crew member assigned to a shoot. One user can be on many shoots; one shoot
// has many users.
model PhotoShootCrew {
  shootId String
  userId  String
  role    String?  // "photographer" | "videographer" | "assistant" | "director" | custom
  shoot   PhotoShoot @relation(fields: [shootId], references: [id], onDelete: Cascade)
  user    User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  addedAt DateTime @default(now())

  @@id([shootId, userId])
  @@index([userId])
}

// Equipment reserved for a shoot. We use this both to plan ("what are we taking")
// and to detect conflicts ("this lens is already booked that day").
model PhotoShootEquipment {
  shootId     String
  equipmentId String
  shoot       PhotoShoot @relation(fields: [shootId], references: [id], onDelete: Cascade)
  equipment   Equipment  @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  addedAt     DateTime @default(now())

  @@id([shootId, equipmentId])
  @@index([equipmentId])
}

// ---------------------------------------------------------------------------
// Equipment inventory — the agency's physical gear.
// ---------------------------------------------------------------------------
model Equipment {
  id           String   @id @default(cuid())
  name         String   // "Sony A7 IV" / "Sigma 24-70 f/2.8" / "Aputure 300D"
  category     String   // camera | lens | light | tripod | microphone | drone | audio | storage | accessory | other
  brand        String?
  model        String?
  serialNumber String?
  purchasedAt  DateTime?
  purchasePriceQar Float?

  condition    String   @default("good") // new | good | fair | needs_repair | broken
  notes        String?
  photoUrl     String?

  // Current holder — who physically has this gear right now.
  // Null = in office / storage.
  currentHolderId String?
  currentHolder   User?   @relation("EquipmentHolder", fields: [currentHolderId], references: [id], onDelete: SetNull)
  assignedAt      DateTime?
  expectedReturnAt DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  shootReservations PhotoShootEquipment[]

  @@index([category])
  @@index([condition])
  @@index([currentHolderId])
}

// Per-user notification inbox. Powers the bell icon in the topbar and the
// /notifications page. Used for: task-deadline alerts, role/permission changes,
// project assignments, mentions in comments, financial threshold warnings (owner
// only), and any event the system wants to deliver to a specific user.
//
// Reminders that fire as desktop notifications (meetings, shoots, invoices)
// also write a Notification row so the user has a permanent record they can
// review later from any device.
model Notification {
  id          String   @id @default(cuid())
  recipientId String
  recipient   User     @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)

  // Type slug — drives the icon, color and click target. Examples:
  //   task.due_soon, task.overdue, task.assigned, task.commented
  //   project.assigned, project.deadline_soon, project.completed
  //   meeting.soon, shoot.soon, invoice.due
  //   user.approved, user.role_changed
  //   finance.threshold (owner only)
  //   system.info
  kind     String
  // Severity — drives color in the bell. info = neutral, success = green,
  // warning = amber, danger = red.
  severity String   @default("info") // info | success | warning | danger

  // Short title (one line). Stored already-localized in the user's language at
  // creation time — keeping it simple. We can switch to i18n keys later.
  title    String
  // Optional longer body shown in the inbox panel.
  body     String?
  // Optional link the bell should navigate to when clicked.
  linkUrl  String?

  // Reference fields — let the inbox dedupe and the click handler open the
  // right entity. Loose pointers (no FK) so deleting a project doesn't cascade
  // away the notification — past notifications stay readable.
  refType String? // task | project | meeting | shoot | transaction | user
  refId   String?

  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([recipientId, createdAt])
  @@index([recipientId, readAt])
  @@index([refType, refId])
}

// Web Push subscription — one row per (user, browser/device). Stores the
// endpoint the browser gave us when the user clicked "Enable notifications".
// We hit that endpoint via the web-push library to deliver an alert that the
// browser displays even when the SRB tab is closed (or the phone is locked,
// for installed PWAs).
//
// One user may have many subscriptions (phone + laptop + work PC). When a
// subscription expires (HTTP 410 GONE), we delete the row.
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation("PushSubscriptionUser", fields: [userId], references: [id], onDelete: Cascade)

  // Push service endpoint — unique per device. Used as the dedupe key.
  endpoint  String   @unique

  // Auth + p256dh keys returned by the browser at subscribe time. Required
  // to encrypt the payload so only this device can read it.
  p256dh    String
  auth      String

  // Free-form label to help the user identify this device when they want
  // to revoke it ("iPhone of Hadi", "Office laptop").
  userAgent String?

  // Last successful push delivery — used to age out stale subs and to show
  // a "recently active" badge in the device-list UI.
  lastUsedAt DateTime?

  createdAt DateTime @default(now())

  @@index([userId])
}

// Backup run history — records when backups happened and their size.
model BackupRun {
  id           String    @id @default(cuid())
  filePath     String
  sizeBytes    Int
  createdAt    DateTime  @default(now())
  trigger      String    // "manual" | "scheduled" | "auto"
  // Result of the run. "success" = file written but not yet verified.
  // "verified" = post-write integrity check passed. "failed" = error captured below.
  status       String    @default("success")
  errorMessage String?
  verifiedAt   DateTime?
  // Reason the auto-scheduler picked this moment (e.g. "6h elapsed", "5 new transactions").
  // Null for manual / cron-script runs.
  reason       String?

  @@index([createdAt])
  @@index([status])
}

```

---

## `proxy.ts`

**Lines:** 150

```tsx
// Route protection (Next.js 16 Proxy; replaces middleware.ts).
// Uses the edge-safe auth.config — no DB access here.
//
// Layers, in order:
//   1) Authentication      — anon → /login (or 401 for /api/*)
//   2) Admin RBAC          — non-admins blocked from /admin/* and admin-only API
//   3) CSRF (double-submit) — mutating /api/* must echo the csrf-token cookie
//   4) CSRF cookie issuance — set the cookie on first authed visit

import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "./auth.config";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  generateCsrfToken,
  timingSafeEqual,
} from "@/lib/csrf";
import { isManagerOrAbove, isOwner } from "@/lib/auth/roles";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/login", "/403"]);
const PUBLIC_PREFIXES = ["/api/auth"];

// Paths reserved for the OWNER (الرئيس) — president-only. The finance dashboard
// (totals + P&L), audit log, backups, theming, and the simulator control surface.
// The /admin/users page is now manager-accessible (handled below) so it is NOT
// in this list.
const OWNER_PREFIXES = [
  "/admin/audit",
  "/admin/backup",
  "/admin/theme",
  "/admin/permissions",
  "/api/admin",
  "/api/sim/control",
  "/api/sim/decide",
  "/api/sim/action",
];

// Paths the manager (المدير) can reach — and by inheritance, the owner.
// Currently: user approval + role assignment.
const MANAGER_PREFIXES = ["/admin/users"];

// API paths exempt from CSRF — Auth.js endpoints have their own CSRF guard.
const CSRF_EXEMPT_PREFIXES = ["/api/auth"];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function startsWithSegment(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

function isOwnerPath(path: string): boolean {
  return OWNER_PREFIXES.some((p) => startsWithSegment(path, p));
}

function isManagerPath(path: string): boolean {
  return MANAGER_PREFIXES.some((p) => startsWithSegment(path, p));
}

function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => startsWithSegment(path, p));
}

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const method = req.method.toUpperCase();
  const isAuthed = !!req.auth;
  const role = req.auth?.user?.role;

  const isPublic =
    PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  // 1) Authentication
  if (!isAuthed && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }

  if (isAuthed && path === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 2) RBAC — runs after auth so we know the role.
  //    a) Owner-only routes (finance API, audit, backup, theme, sim control)
  //    b) Manager-or-above routes (user approval / role assignment)
  if (isAuthed && isOwnerPath(path) && !isOwner(role)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/403";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthed && isManagerPath(path) && !isManagerOrAbove(role)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/403";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 3) CSRF — only enforced on state-changing /api/* requests.
  if (
    isAuthed &&
    path.startsWith("/api/") &&
    !isCsrfExempt(path) &&
    !SAFE_METHODS.has(method)
  ) {
    const cookieToken = req.cookies.get(CSRF_COOKIE)?.value ?? "";
    const headerToken = req.headers.get(CSRF_HEADER) ?? "";
    if (
      !cookieToken ||
      !headerToken ||
      !timingSafeEqual(cookieToken, headerToken)
    ) {
      return NextResponse.json({ error: "csrf" }, { status: 403 });
    }
  }

  // 4) Issue a CSRF cookie if the authed session doesn't have one yet.
  const res = NextResponse.next();
  if (isAuthed && !req.cookies.get(CSRF_COOKIE)) {
    res.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return res;
});

export const config = {
  // Run on everything except Next internals, static files, and SSE stream
  // (Auth handled inside the SSE route itself if needed later).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

```

---

