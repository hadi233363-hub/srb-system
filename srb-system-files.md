# SRB System — Security & Privacy Hardening

**Branch:** `claude/save-security-patch-E0iyC`
**Commits:**
- `bc18a8e` — Security hardening: CSP + RBAC + CSRF + email masking
- `1a42ada` — Privacy + role hierarchy + onboarding + rate limit

**Files changed:** 46 (`+798 / −125`)

---

## Table of Contents

- [`app/403/page.tsx`](#app-403-page-tsx)
- [`app/admin/backup/page.tsx`](#app-admin-backup-page-tsx)
- [`app/admin/users/actions.ts`](#app-admin-users-actions-ts)
- [`app/admin/users/users-admin-client.tsx`](#app-admin-users-users-admin-client-tsx)
- [`app/api/sim/action/route.ts`](#app-api-sim-action-route-ts)
- [`app/api/sim/control/route.ts`](#app-api-sim-control-route-ts)
- [`app/api/sim/decide/route.ts`](#app-api-sim-decide-route-ts)
- [`app/equipment/checkout-button.tsx`](#app-equipment-checkout-button-tsx)
- [`app/equipment/page.tsx`](#app-equipment-page-tsx)
- [`app/layout.tsx`](#app-layout-tsx)
- [`app/meetings/meeting-form.tsx`](#app-meetings-meeting-form-tsx)
- [`app/meetings/meetings-list.tsx`](#app-meetings-meetings-list-tsx)
- [`app/meetings/page.tsx`](#app-meetings-page-tsx)
- [`app/not-found.tsx`](#app-not-found-tsx)
- [`app/onboarding/nickname/actions.ts`](#app-onboarding-nickname-actions-ts)
- [`app/projects/[id]/members-manager.tsx`](#app-projects--id--members-manager-tsx)
- [`app/projects/[id]/page.tsx`](#app-projects--id--page-tsx)
- [`app/projects/new-project-button.tsx`](#app-projects-new-project-button-tsx)
- [`app/projects/page.tsx`](#app-projects-page-tsx)
- [`app/shoots/[id]/page.tsx`](#app-shoots--id--page-tsx)
- [`app/shoots/page.tsx`](#app-shoots-page-tsx)
- [`app/shoots/shoot-actions.tsx`](#app-shoots-shoot-actions-tsx)
- [`app/shoots/shoot-form.tsx`](#app-shoots-shoot-form-tsx)
- [`app/tasks/page.tsx`](#app-tasks-page-tsx)
- [`app/team/[id]/page.tsx`](#app-team--id--page-tsx)
- [`app/team/page.tsx`](#app-team-page-tsx)
- [`auth.config.ts`](#auth-config-ts)
- [`auth.ts`](#auth-ts)
- [`components/nickname-gate.tsx`](#components-nickname-gate-tsx)
- [`components/sidebar.tsx`](#components-sidebar-tsx)
- [`components/sim-provider.tsx`](#components-sim-provider-tsx)
- [`components/tasks/new-task-button.tsx`](#components-tasks-new-task-button-tsx)
- [`components/tasks/smart-assignee-suggestions.tsx`](#components-tasks-smart-assignee-suggestions-tsx)
- [`components/tasks/task-detail-modal.tsx`](#components-tasks-task-detail-modal-tsx)
- [`lib/auth-guards.ts`](#lib-auth-guards-ts)
- [`lib/csrf-client.ts`](#lib-csrf-client-ts)
- [`lib/csrf.ts`](#lib-csrf-ts)
- [`lib/db/users.ts`](#lib-db-users-ts)
- [`lib/display.ts`](#lib-display-ts)
- [`lib/i18n/dict.ts`](#lib-i18n-dict-ts)
- [`lib/rate-limit.ts`](#lib-rate-limit-ts)
- [`lib/tasks/suggest-assignees.ts`](#lib-tasks-suggest-assignees-ts)
- [`next.config.ts`](#next-config-ts)
- [`prisma/schema.prisma`](#prisma-schema-prisma)
- [`proxy.ts`](#proxy-ts)
- [`types/next-auth.d.ts`](#types-next-auth-d-ts)

---

## `app/403/page.tsx`

<a id="app-403-page-tsx"></a>

```ts
// 403 — shown when an authed user hits a route the proxy reserves for admins.
// Public to the proxy (no auth-loop): listed in PUBLIC_PATHS so it renders
// regardless of role.

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

export default async function ForbiddenPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(key, locale);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
        <div className="space-y-1 border-b border-zinc-800 bg-gradient-to-b from-rose-950/30 to-zinc-900/40 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">
            {t("admin.denied.title")}
          </h1>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-zinc-400">{t("admin.denied.desc")}</p>
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-emerald-500/30 hover:text-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {locale === "ar" ? "رجوع للرئيسية" : "Back to home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## `app/admin/backup/page.tsx`

<a id="app-admin-backup-page-tsx"></a>

```ts
import { Archive, CheckCircle2, Info, XCircle, Zap } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { formatDate } from "@/lib/db/helpers";
import { RunBackupButton } from "./run-button";

export default async function BackupPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  if (session?.user.role !== "admin") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("page.backup.title")}</h1>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <div className="text-sm text-zinc-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-xs text-zinc-500">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  const runs = await prisma.backupRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const lastSuccess = runs.find((r) => r.status === "verified" || r.status === "success");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Archive className="h-5 w-5 text-emerald-400" />
            {t("page.backup.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{t("page.backup.subtitle")}</p>
        </div>
        <RunBackupButton />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <InfoCard
          label={t("backup.lastRun")}
          value={lastSuccess ? formatDate(lastSuccess.createdAt, locale) : t("backup.never")}
          sub={
            lastSuccess
              ? new Date(lastSuccess.createdAt).toLocaleTimeString(
                  locale === "en" ? "en-US" : "en",
                  { hour: "2-digit", minute: "2-digit" }
                )
              : undefined
          }
        />
        <InfoCard
          label={t("backup.size")}
          value={lastSuccess ? formatBytes(lastSuccess.sizeBytes) : "—"}
        />
      </div>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-300">
        <div className="flex items-start gap-2">
          <Zap className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("backup.schedule.hint")}</span>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("backup.history")}
        </h2>
        {runs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <Archive className="h-10 w-10 text-zinc-700" />
            <div className="text-sm text-zinc-400">{t("backup.empty.title")}</div>
            <p className="max-w-md text-xs text-zinc-500">{t("backup.empty.desc")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-start font-normal">{t("table.date")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("backup.status")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("backup.trigger")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("backup.reason")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("backup.size")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                      <div>{formatDate(r.createdAt, locale)}</div>
                      <div className="text-[10px] text-zinc-600">
                        {new Date(r.createdAt).toLocaleTimeString(
                          locale === "en" ? "en-US" : "en",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusBadge status={r.status} t={t} />
                      {r.status === "failed" && r.errorMessage && (
                        <div className="mt-1 max-w-[200px] truncate text-[10px] text-rose-400/70" title={r.errorMessage} dir="ltr">
                          {r.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <TriggerBadge trigger={r.trigger} t={t} />
                    </td>
                    <td className="px-4 py-3 text-[11px] text-zinc-500">
                      {r.reason ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-zinc-300">
                      {r.sizeBytes > 0 ? formatBytes(r.sizeBytes) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-400">
        <XCircle className="h-3 w-3" />
        {t("backup.status.failed")}
      </span>
    );
  }
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {t("backup.status.verified")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-700/40 px-2 py-0.5 text-[10px] text-zinc-400">
      {t("backup.status.success")}
    </span>
  );
}

function TriggerBadge({ trigger, t }: { trigger: string; t: (k: string) => string }) {
  if (trigger === "auto") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
        <Zap className="h-3 w-3" />
        {t("backup.trigger.auto")}
      </span>
    );
  }
  if (trigger === "scheduled") {
    return (
      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
        {t("backup.trigger.scheduled")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-700/40 px-2 py-0.5 text-[10px] text-zinc-400">
      {t("backup.trigger.manual")}
    </span>
  );
}

function InfoCard({
  label,
  value,
  sub,
  dir,
}: {
  label: string;
  value: string;
  sub?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-100 break-all" dir={dir}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-zinc-600">{sub}</div>}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
```

---

## `app/admin/users/actions.ts`

<a id="app-admin-users-actions-ts"></a>

```ts
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

type Role = "admin" | "manager" | "department_head" | "employee";

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
  if (!["admin", "manager", "department_head", "employee"].includes(role)) {
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
  if (!["admin", "manager", "department_head", "employee"].includes(role)) {
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
```

---

## `app/admin/users/users-admin-client.tsx`

<a id="app-admin-users-users-admin-client-tsx"></a>

```ts
"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Plus, Trash2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Badge as BadgeRow, User, UserBadge } from "@prisma/client";
import { useT } from "@/lib/i18n/client";
import {
  addUserAction,
  approveUserAction,
  changeUserRoleAction,
  deleteUserAction,
  rejectUserAction,
  toggleUserActiveAction,
  toggleUserBadgeAction,
} from "./actions";

type AuthRole = "admin" | "manager" | "department_head" | "employee";

const ROLE_COLOR: Record<AuthRole, string> = {
  admin: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  manager: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  department_head: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  employee: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

type UserWithBadges = User & {
  badges: (UserBadge & { badge: BadgeRow })[];
};

interface Props {
  users: UserWithBadges[];
  currentUserId: string;
  allBadges: BadgeRow[];
  locale: "ar" | "en";
}

export function UsersAdminClient({
  users,
  currentUserId,
  allBadges,
  locale,
}: Props) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);
  const [flash, setFlash] = useState<{ tone: "success" | "error"; msg: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const showFlash = (tone: "success" | "error", msg: string) => {
    setFlash({ tone, msg });
    setTimeout(() => setFlash(null), 3500);
  };

  const pendingUsers = users.filter((u) => u.approvedAt === null);
  const approvedUsers = users.filter((u) => u.approvedAt !== null);

  const roleLabel = (r: AuthRole) => t(`role.${r}`);

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

      {pendingUsers.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">
              {t("admin.pending.title")} ({pendingUsers.length})
            </h3>
          </div>
          <p className="mb-3 text-xs text-amber-300/70">{t("admin.pending.desc")}</p>

          <ul className="space-y-2">
            {pendingUsers.map((u) => (
              <PendingRow
                key={u.id}
                user={u}
                isPending={isPending}
                onApprove={(role, dept) =>
                  startTransition(async () => {
                    const res = await approveUserAction(u.id, role, dept);
                    if (res.ok) showFlash("success", t("admin.pending.approvedToast"));
                    else showFlash("error", res.message ?? t("common.error"));
                  })
                }
                onReject={() =>
                  startTransition(async () => {
                    const res = await rejectUserAction(u.id);
                    if (res.ok) showFlash("success", t("admin.pending.rejectedToast"));
                    else showFlash("error", res.message ?? t("common.error"));
                  })
                }
              />
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500">{t("admin.users.hint")}</div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("action.addEmployee")}
        </button>
      </div>

      {addOpen && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold">{t("admin.users.addTitle")}</h4>
            <button
              onClick={() => setAddOpen(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            action={(formData) => {
              startTransition(async () => {
                const res = await addUserAction(formData);
                if (res.ok) {
                  showFlash("success", res.message ?? t("admin.users.addedToast"));
                  setAddOpen(false);
                } else {
                  showFlash("error", res.message ?? t("admin.users.addFailed"));
                }
              });
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <Field label={t("admin.users.field.name")}>
              <input
                name="name"
                required
                placeholder={t("admin.users.field.namePlaceholder")}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              />
            </Field>
            <Field label={t("admin.users.field.email")}>
              <input
                name="email"
                type="email"
                required
                placeholder="ahmed@gmail.com"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                dir="ltr"
              />
            </Field>
            <Field label={t("admin.users.field.role")}>
              <select
                name="role"
                required
                defaultValue="employee"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              >
                <option value="admin">{t("admin.users.roleOptAdmin")}</option>
                <option value="manager">{t("admin.users.roleOptManager")}</option>
                <option value="department_head">{t("role.department_head")}</option>
                <option value="employee">{t("admin.users.roleOptEmployee")}</option>
              </select>
            </Field>
            <Field label={t("admin.users.field.department")}>
              <input
                name="department"
                placeholder="Creative · Accounts · Sales · Tech"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              />
            </Field>
            <div className="flex items-center justify-end gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                {t("action.cancel")}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {isPending ? t("action.adding") : t("admin.users.addBtn")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
        <ul className="divide-y divide-zinc-800/60">
          {approvedUsers.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-zinc-500">
              {t("admin.users.empty")}
            </li>
          )}
          {approvedUsers.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <li key={u.id} className="flex flex-col gap-3 px-5 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">
                        {u.name}
                      </span>
                      {isSelf && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                          {t("admin.users.youLabel")}
                        </span>
                      )}
                      {!u.active && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                          {t("team.label.disabled")}
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500"
                      dir="ltr"
                    >
                      <span>{u.email}</span>
                      {u.department && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span>{u.department}</span>
                        </>
                      )}
                      {u.lastLoginAt && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span>
                            {t("admin.users.loginSince")}:{" "}
                            {new Date(u.lastLoginAt).toLocaleDateString("en")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      disabled={isSelf || isPending}
                      value={u.role as AuthRole}
                      onChange={(e) => {
                        const newRole = e.target.value as AuthRole;
                        startTransition(async () => {
                          await changeUserRoleAction(u.id, newRole);
                        });
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-semibold disabled:opacity-60",
                        ROLE_COLOR[u.role as AuthRole]
                      )}
                    >
                      <option value="admin">{roleLabel("admin")}</option>
                      <option value="manager">{roleLabel("manager")}</option>
                      <option value="department_head">{roleLabel("department_head")}</option>
                      <option value="employee">{roleLabel("employee")}</option>
                    </select>
                    <button
                      disabled={isSelf || isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await toggleUserActiveAction(u.id, !u.active);
                        });
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition disabled:opacity-40",
                        u.active
                          ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      )}
                    >
                      {u.active
                        ? t("admin.users.toggleDeactivate")
                        : t("admin.users.toggleActivate")}
                    </button>
                    <button
                      disabled={isSelf || isPending}
                      onClick={() => {
                        if (!confirm(`${t("admin.users.deleteConfirm")} ${u.name}`))
                          return;
                        startTransition(async () => {
                          const res = await deleteUserAction(u.id);
                          if (!res.ok)
                            showFlash("error", res.message ?? t("common.error"));
                        });
                      }}
                      className="rounded-md border border-rose-500/30 p-1.5 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
                      aria-label={t("action.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <UserBadgeRow
                  user={u}
                  allBadges={allBadges}
                  locale={locale}
                  disabled={isPending}
                  onToggle={(badgeId) =>
                    startTransition(async () => {
                      const res = await toggleUserBadgeAction(u.id, badgeId);
                      if (!res.ok)
                        showFlash("error", res.message ?? t("common.error"));
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function UserBadgeRow({
  user,
  allBadges,
  locale,
  disabled,
  onToggle,
}: {
  user: UserWithBadges;
  allBadges: BadgeRow[];
  locale: "ar" | "en";
  disabled: boolean;
  onToggle: (badgeId: string) => void;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const ownedIds = new Set(user.badges.map((b) => b.badgeId));
  const availableToAdd = allBadges.filter((b) => !ownedIds.has(b.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-800/40 pt-2">
      <span className="text-[10px] uppercase tracking-wider text-zinc-600">
        {t("badges.label")}:
      </span>
      {user.badges.length === 0 && !picking && (
        <span className="text-[11px] text-zinc-600">{t("badges.empty")}</span>
      )}
      {user.badges.map((ub) => (
        <BadgeChip
          key={ub.badgeId}
          badge={ub.badge}
          locale={locale}
          disabled={disabled}
          onRemove={() => onToggle(ub.badgeId)}
        />
      ))}

      {picking ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-950 p-1.5">
          {availableToAdd.length === 0 && (
            <span className="px-2 text-[11px] text-zinc-600">
              {t("badges.allAssigned")}
            </span>
          )}
          {availableToAdd.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                onToggle(b.id);
                if (availableToAdd.length === 1) setPicking(false);
              }}
              disabled={disabled}
              className="flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-40"
            >
              <span>{b.icon}</span>
              <span>{locale === "ar" ? b.labelAr : b.labelEn}</span>
            </button>
          ))}
          <button
            onClick={() => setPicking(false)}
            className="rounded-full p-0.5 text-zinc-500 hover:text-zinc-300"
            aria-label="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        availableToAdd.length > 0 && (
          <button
            onClick={() => setPicking(true)}
            disabled={disabled}
            className="flex items-center gap-1 rounded-full border border-dashed border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500 transition hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            {t("badges.add")}
          </button>
        )
      )}
    </div>
  );
}

function BadgeChip({
  badge,
  locale,
  disabled,
  onRemove,
}: {
  badge: BadgeRow;
  locale: "ar" | "en";
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
      style={{
        borderColor: badge.colorHex + "55",
        backgroundColor: badge.colorHex + "15",
        color: badge.colorHex,
      }}
    >
      <span>{badge.icon}</span>
      <span>{locale === "ar" ? badge.labelAr : badge.labelEn}</span>
      <button
        onClick={onRemove}
        disabled={disabled}
        className="ml-1 rounded-full p-0.5 hover:bg-black/20 disabled:opacity-40"
        aria-label="Remove"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function PendingRow({
  user,
  isPending,
  onApprove,
  onReject,
}: {
  user: User;
  isPending: boolean;
  onApprove: (role: AuthRole, department: string | null) => void;
  onReject: () => void;
}) {
  const t = useT();
  const [role, setRole] = useState<AuthRole>("employee");
  const [department, setDepartment] = useState("");

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-zinc-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-zinc-100">{user.name}</div>
        <div className="mt-0.5 text-xs text-zinc-500" dir="ltr">
          {user.email}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[10px] text-amber-300/70">
          {t("admin.pending.roleLabel")}:
          <select
            value={role}
            disabled={isPending}
            onChange={(e) => setRole(e.target.value as AuthRole)}
            className="rounded-md border border-amber-500/30 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="employee">{t("role.employee")}</option>
            <option value="department_head">{t("role.department_head")}</option>
            <option value="manager">{t("role.manager")}</option>
            <option value="admin">{t("role.admin")}</option>
          </select>
        </label>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          disabled={isPending}
          placeholder={t("admin.pending.deptLabel")}
          className="w-40 rounded-md border border-amber-500/30 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
        />
        <button
          onClick={() => onApprove(role, department || null)}
          disabled={isPending}
          className="flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          <Check className="h-3 w-3" />
          {t("admin.pending.approve")}
        </button>
        <button
          onClick={() => {
            if (!confirm(`${t("admin.pending.reject")}: ${user.email}?`)) return;
            onReject();
          }}
          disabled={isPending}
          className="flex items-center gap-1 rounded-md border border-rose-500/30 px-3 py-1 text-xs text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
        >
          <X className="h-3 w-3" />
          {t("admin.pending.reject")}
        </button>
      </div>
    </li>
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

## `app/api/sim/action/route.ts`

<a id="app-api-sim-action-route-ts"></a>

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureStarted } from "@/lib/sim/engine";
import {
  boostProjectPriority,
  cancelProject,
  fireAgent,
  giveBonus,
  hireAgent,
  raiseSalary,
  setHiringPause,
  teamRetreat,
} from "@/lib/sim/actions";
import { broadcast, getState } from "@/lib/sim/state";
import type { Role } from "@/lib/sim/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ActionBody {
  type: string;
  params?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  ensureStarted();
  let body: ActionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const state = getState();
  const p = body.params ?? {};
  let result: { ok: boolean; message: string };

  switch (body.type) {
    case "hire":
      result = hireAgent(state, {
        role: p.role as Role,
        seniority: (p.seniority as "junior" | "mid" | "senior") ?? "junior",
      });
      break;
    case "fire":
      result = fireAgent(state, p.agentId as string);
      break;
    case "raise_salary":
      result = raiseSalary(state, p.agentId as string, (p.pct as number) ?? 10);
      break;
    case "bonus":
      result = giveBonus(state);
      break;
    case "retreat":
      result = teamRetreat(state);
      break;
    case "hiring_pause":
      result = setHiringPause(state, Boolean(p.paused));
      break;
    case "cancel_project":
      result = cancelProject(state, p.projectId as string);
      break;
    case "priority_boost":
      result = boostProjectPriority(state, p.projectId as string);
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  broadcast({ type: "snapshot", payload: state });
  return NextResponse.json(result);
}
```

---

## `app/api/sim/control/route.ts`

<a id="app-api-sim-control-route-ts"></a>

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureStarted, setPaused, setSpeed } from "@/lib/sim/engine";
import { resetSim } from "@/lib/sim/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ControlBody {
  action: "pause" | "play" | "speed" | "reset";
  value?: number;
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  ensureStarted();

  let body: ControlBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  switch (body.action) {
    case "pause":
      setPaused(true);
      break;
    case "play":
      setPaused(false);
      break;
    case "speed":
      if (typeof body.value !== "number") {
        return NextResponse.json({ error: "value required" }, { status: 400 });
      }
      setPaused(false);
      setSpeed(body.value);
      break;
    case "reset":
      resetSim();
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
```

---

## `app/api/sim/decide/route.ts`

<a id="app-api-sim-decide-route-ts"></a>

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureStarted } from "@/lib/sim/engine";
import { applyDecision, forceSpawnScenario } from "@/lib/sim/decisions";
import { getState, broadcast } from "@/lib/sim/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DecideBody {
  scenarioId: string;
  choiceKey: string;
}

interface SpawnBody {
  templateId: string;
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  ensureStarted();
  let body: DecideBody | SpawnBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const state = getState();

  if ("templateId" in body) {
    const s = forceSpawnScenario(state, body.templateId);
    if (!s) return NextResponse.json({ error: "cannot spawn" }, { status: 400 });
    // Manually-triggered scenarios don't expire — the CEO owns them until decided.
    // (Auto-spawned ones still expire via the tick, producing "nothing" outcomes.)
    s.expiresAt = state.simTime + 365 * 24 * 60 * 60 * 1000;
    state.scenarios.push(s);
    broadcast({ type: "snapshot", payload: state });
    return NextResponse.json({ ok: true, scenario: s });
  }

  if (!("scenarioId" in body) || !body.scenarioId || !body.choiceKey) {
    return NextResponse.json({ error: "scenarioId + choiceKey required" }, { status: 400 });
  }

  const record = applyDecision(state, body.scenarioId, body.choiceKey);
  if (!record) return NextResponse.json({ error: "scenario or choice not found" }, { status: 404 });
  broadcast({ type: "snapshot", payload: state });
  return NextResponse.json({ ok: true, record });
}
```

---

## `app/equipment/checkout-button.tsx`

<a id="app-equipment-checkout-button-tsx"></a>

```ts
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX, X } from "lucide-react";
import { checkInEquipmentAction, checkOutEquipmentAction } from "./actions";
import { displayName } from "@/lib/display";
import { useT } from "@/lib/i18n/client";

interface UserLite {
  id: string;
  name: string;
  nickname: string | null;
}

interface Props {
  equipmentId: string;
  equipmentName: string;
  currentHolder: { id: string; name: string } | null;
  users: UserLite[];
}

export function CheckOutButton({
  equipmentId,
  equipmentName,
  currentHolder,
  users,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [holderId, setHolderId] = useState<string>("");
  const [expectedReturnAt, setExpectedReturnAt] = useState<string>("");

  const doCheckOut = () => {
    if (!holderId) return;
    startTransition(async () => {
      await checkOutEquipmentAction(equipmentId, holderId, expectedReturnAt || null);
      setOpen(false);
      router.refresh();
    });
  };

  const doCheckIn = () => {
    startTransition(async () => {
      await checkInEquipmentAction(equipmentId);
      router.refresh();
    });
  };

  if (currentHolder) {
    return (
      <button
        onClick={doCheckIn}
        disabled={isPending}
        className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-400 transition hover:bg-emerald-500/15 disabled:opacity-40"
      >
        <UserX className="h-3 w-3" />
        {t("equipment.checkIn")}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-800"
      >
        <UserCheck className="h-3 w-3" />
        {t("equipment.checkOut")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {t("equipment.checkOutTitle")}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
              📦 {equipmentName}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-500">
                  {t("equipment.checkOutHolder")}
                </span>
                <select
                  value={holderId}
                  onChange={(e) => setHolderId(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {displayName(u)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-500">
                  {t("equipment.expectedReturn")}
                </span>
                <input
                  type="date"
                  value={expectedReturnAt}
                  onChange={(e) => setExpectedReturnAt(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  {t("action.cancel")}
                </button>
                <button
                  onClick={doCheckOut}
                  disabled={isPending || !holderId}
                  className="rounded-md px-4 py-1.5 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--color-brand)" }}
                >
                  {isPending ? t("action.saving") : t("equipment.checkOut")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## `app/equipment/page.tsx`

<a id="app-equipment-page-tsx"></a>

```ts
import {
  Camera,
  Mic,
  Package,
  Plane,
  Target,
  Disc3,
  HardDrive,
  Puzzle,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";
import { displayName } from "@/lib/display";
import { formatDate, formatQar } from "@/lib/db/helpers";
import { EquipmentForm } from "./equipment-form";
import { CheckOutButton } from "./checkout-button";
import { DeleteEquipmentButton } from "./delete-button";

// Map category → icon. Lucide 1.x doesn't ship every icon — pick ones we know exist.
const CATEGORY_ICON: Record<string, typeof Camera> = {
  camera: Camera,
  lens: Target,
  light: Disc3,
  tripod: Package,
  microphone: Mic,
  drone: Plane,
  audio: Mic,
  storage: HardDrive,
  accessory: Puzzle,
  other: Package,
};

const CONDITION_STYLE: Record<string, string> = {
  new: "bg-emerald-500/10 text-emerald-400",
  good: "bg-sky-500/10 text-sky-400",
  fair: "bg-amber-500/10 text-amber-400",
  needs_repair: "bg-orange-500/10 text-orange-400",
  broken: "bg-rose-500/10 text-rose-400",
};

export default async function EquipmentPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const user = session?.user;
  if (!user) return null;
  const canManage = user.role === "admin" || user.role === "manager";

  const [equipment, users] = await Promise.all([
    prisma.equipment.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        currentHolder: { select: { id: true, name: true, nickname: true } },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, nickname: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Group by category
  const byCategory = new Map<string, typeof equipment>();
  for (const e of equipment) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category)!.push(e);
  }

  const totalValue = equipment.reduce(
    (s, e) => s + (e.purchasePriceQar ?? 0),
    0
  );
  const outCount = equipment.filter((e) => e.currentHolderId).length;
  const needsRepair = equipment.filter(
    (e) => e.condition === "needs_repair" || e.condition === "broken"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Camera className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
            {t("page.equipment.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.equipment.subtitle")}
          </p>
        </div>
        {canManage && <EquipmentForm mode="create" />}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          icon={Package}
          label={t("equipment.stats.total")}
          value={String(equipment.length)}
          tone="brand"
        />
        <Kpi
          icon={Camera}
          label={t("equipment.stats.categories")}
          value={String(byCategory.size)}
        />
        <Kpi
          icon={HardDrive}
          label={t("equipment.stats.checkedOut")}
          value={String(outCount)}
          tone={outCount > 0 ? "accent" : "muted"}
        />
        <Kpi
          icon={Target}
          label={t("equipment.stats.needsRepair")}
          value={String(needsRepair)}
          tone={needsRepair > 0 ? "danger" : "muted"}
        />
      </div>

      {/* Total value (admin only — same sensitivity as salaries) */}
      {user.role === "admin" && totalValue > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--color-brand-border)",
            background: "var(--color-brand-dim)",
          }}
        >
          <div
            className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-brand)" }}
          >
            {t("equipment.stats.totalValue")}
          </div>
          <div className="text-2xl font-bold text-zinc-100 tabular-nums">
            {formatQar(totalValue, { locale })}
          </div>
        </div>
      )}

      {equipment.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Camera className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("equipment.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">
            {t("equipment.empty.desc")}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byCategory.entries()).map(([category, items]) => {
            const Icon = CATEGORY_ICON[category] ?? Package;
            return (
              <section key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "var(--color-brand-dim)" }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: "var(--color-brand)" }}
                    />
                  </div>
                  <h2 className="text-sm font-semibold text-zinc-200">
                    {t(`equipment.category.${category}`)}
                  </h2>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                    {items.length}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <table className="w-full text-sm">
                    <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
                      <tr>
                        <th className="px-4 py-2 text-start font-normal">
                          {t("equipment.field.name")}
                        </th>
                        <th className="px-4 py-2 text-start font-normal">
                          {t("equipment.field.condition")}
                        </th>
                        <th className="px-4 py-2 text-start font-normal">
                          {t("equipment.holder")}
                        </th>
                        {canManage && (
                          <th className="px-4 py-2 text-start font-normal">
                            {t("equipment.actions")}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {items.map((e) => (
                        <tr key={e.id} className="hover:bg-zinc-900/40">
                          <td className="px-4 py-3">
                            <div className="text-sm text-zinc-100">
                              {e.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              {[e.brand, e.model, e.serialNumber]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                            {e.notes && (
                              <div className="mt-0.5 text-[10px] text-zinc-600">
                                {e.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px]",
                                CONDITION_STYLE[e.condition] ??
                                  "bg-zinc-700/40 text-zinc-400"
                              )}
                            >
                              {t(`equipment.condition.${e.condition}`)}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top">
                            {e.currentHolder ? (
                              <div>
                                <div className="text-xs text-zinc-200">
                                  {displayName(e.currentHolder)}
                                </div>
                                {e.expectedReturnAt && (
                                  <div className="text-[10px] text-zinc-500">
                                    {t("equipment.return")}:{" "}
                                    {formatDate(e.expectedReturnAt, locale)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-600">
                                {t("equipment.inStorage")}
                              </span>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-wrap items-center gap-2">
                                <CheckOutButton
                                  equipmentId={e.id}
                                  equipmentName={e.name}
                                  currentHolder={e.currentHolder}
                                  users={users}
                                />
                                <EquipmentEditInline
                                  equipment={{
                                    id: e.id,
                                    name: e.name,
                                    category: e.category,
                                    brand: e.brand,
                                    model: e.model,
                                    serialNumber: e.serialNumber,
                                    condition: e.condition,
                                    notes: e.notes,
                                    purchasedAt: e.purchasedAt,
                                    purchasePriceQar: e.purchasePriceQar,
                                  }}
                                />
                                <DeleteEquipmentButton
                                  id={e.id}
                                  name={e.name}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Camera;
  label: string;
  value: string;
  tone?: "brand" | "accent" | "muted" | "danger";
}) {
  const style =
    tone === "brand"
      ? { color: "var(--color-brand)" }
      : tone === "accent"
      ? { color: "var(--color-accent)" }
      : tone === "danger"
      ? { color: "#fb7185" }
      : undefined;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      <div
        className="mt-1 text-2xl font-bold tabular-nums text-zinc-100"
        style={style}
      >
        {value}
      </div>
    </div>
  );
}

// Thin wrapper to render EquipmentForm in edit mode from a server component.
function EquipmentEditInline({
  equipment,
}: {
  equipment: {
    id: string;
    name: string;
    category: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    condition: string;
    notes: string | null;
    purchasedAt: Date | null;
    purchasePriceQar: number | null;
  };
}) {
  return <EquipmentForm mode="edit" initial={equipment} />;
}
```

---

## `app/layout.tsx`

<a id="app-layout-tsx"></a>

```ts
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopbarReal } from "@/components/topbar-real";
import { PendingGate } from "@/components/pending-gate";
import { NicknameGate } from "@/components/nickname-gate";
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
  // Internal-only system — never index or follow.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
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
              user.nickname ? (
                <div className="flex min-h-dvh">
                  <Sidebar
                    userRole={user.role}
                    userName={user.nickname}
                    userEmail={user.email ?? ""}
                    logoPath={settings?.logoPath ?? "/srb-logo-white.png"}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <TopbarReal />
                    <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
                  </div>
                  {/* Background reminder pollers — fire desktop notifications. */}
                  <MeetingReminder />
                  <InvoiceReminder />
                </div>
              ) : (
                <NicknameGate userName={user.name ?? user.email ?? "User"} />
              )
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

## `app/meetings/meeting-form.tsx`

<a id="app-meetings-meeting-form-tsx"></a>

```ts
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createMeetingAction, updateMeetingAction } from "./actions";
import { displayName } from "@/lib/display";
import { useT } from "@/lib/i18n/client";

interface UserLite {
  id: string;
  name: string;
  nickname: string | null;
}

interface MeetingInitial {
  id: string;
  clientName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  websiteUrl: string | null;
  socialNotes: string | null;
  meetingAt: Date;
  durationMin: number;
  location: string | null;
  meetingLink: string | null;
  agendaNotes: string | null;
  status: string;
  outcomeNotes: string | null;
  ownerId: string | null;
}

interface Props {
  mode: "create" | "edit";
  users: UserLite[];
  currentUserId: string;
  initial?: MeetingInitial;
  triggerLabel?: string;
}

function dateToLocalInput(d: Date): string {
  // Format as YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function MeetingForm({
  mode,
  users,
  currentUserId,
  initial,
  triggerLabel,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const defaultStart = initial
    ? dateToLocalInput(new Date(initial.meetingAt))
    : (() => {
        // Default: tomorrow at 10:00 local
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(10, 0, 0, 0);
        return dateToLocalInput(d);
      })();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createMeetingAction(formData)
          : await updateMeetingAction(initial!.id, formData);
      if (res.ok) {
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
      } else {
        const msg = (res as { message?: string }).message;
        setError(msg ?? t("common.errorGeneric"));
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
          mode === "create"
            ? "text-zinc-950 hover:opacity-90"
            : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        )}
        style={
          mode === "create" ? { background: "var(--color-brand)" } : undefined
        }
      >
        {mode === "create" && <Plus className="h-4 w-4" />}
        {triggerLabel ??
          (mode === "create" ? t("meetings.new") : t("action.edit"))}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-[5vh]"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {mode === "create"
                  ? t("meetings.new")
                  : t("meetings.edit")}
              </h3>
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
              <Section title={t("meetings.section.client")} />
              <Field label={`${t("meetings.field.clientName")} *`}>
                <input
                  name="clientName"
                  required
                  defaultValue={initial?.clientName ?? ""}
                  placeholder={t("meetings.field.clientNamePlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.companyName")}>
                <input
                  name="companyName"
                  defaultValue={initial?.companyName ?? ""}
                  placeholder={t("meetings.field.companyPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.phone")}>
                <input
                  name="phone"
                  defaultValue={initial?.phone ?? ""}
                  placeholder="+974 5555 0000"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.email")}>
                <input
                  type="email"
                  name="email"
                  defaultValue={initial?.email ?? ""}
                  placeholder="client@example.com"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <Section title={t("meetings.section.social")} />
              <Field label={t("meetings.field.instagram")}>
                <input
                  name="instagramHandle"
                  defaultValue={initial?.instagramHandle ?? ""}
                  placeholder="@clientname"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.tiktok")}>
                <input
                  name="tiktokHandle"
                  defaultValue={initial?.tiktokHandle ?? ""}
                  placeholder="@clientname"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.website")} full>
                <input
                  type="url"
                  name="websiteUrl"
                  defaultValue={initial?.websiteUrl ?? ""}
                  placeholder="https://example.com"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.socialNotes")} full>
                <input
                  name="socialNotes"
                  defaultValue={initial?.socialNotes ?? ""}
                  placeholder={t("meetings.field.socialNotesPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <Section title={t("meetings.section.schedule")} />
              <Field label={`${t("meetings.field.meetingAt")} *`}>
                <input
                  type="datetime-local"
                  name="meetingAt"
                  required
                  defaultValue={defaultStart}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.duration")}>
                <select
                  name="durationMin"
                  defaultValue={String(initial?.durationMin ?? 60)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="15">15 {t("meetings.minutes")}</option>
                  <option value="30">30 {t("meetings.minutes")}</option>
                  <option value="45">45 {t("meetings.minutes")}</option>
                  <option value="60">60 {t("meetings.minutes")}</option>
                  <option value="90">90 {t("meetings.minutes")}</option>
                  <option value="120">120 {t("meetings.minutes")}</option>
                </select>
              </Field>
              <Field label={t("meetings.field.location")}>
                <input
                  name="location"
                  defaultValue={initial?.location ?? ""}
                  placeholder={t("meetings.field.locationPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.meetingLink")}>
                <input
                  type="url"
                  name="meetingLink"
                  defaultValue={initial?.meetingLink ?? ""}
                  placeholder="https://meet.google.com/..."
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.owner")}>
                <select
                  name="ownerId"
                  defaultValue={initial?.ownerId ?? currentUserId}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {displayName(u)}
                    </option>
                  ))}
                </select>
              </Field>
              {mode === "edit" && (
                <Field label={t("meetings.field.status")}>
                  <select
                    name="status"
                    defaultValue={initial?.status ?? "scheduled"}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                  >
                    <option value="scheduled">{t("meetings.status.scheduled")}</option>
                    <option value="done">{t("meetings.status.done")}</option>
                    <option value="cancelled">{t("meetings.status.cancelled")}</option>
                    <option value="no_show">{t("meetings.status.no_show")}</option>
                  </select>
                </Field>
              )}

              <Section title={t("meetings.section.notes")} />
              <Field label={t("meetings.field.agendaNotes")} full>
                <textarea
                  name="agendaNotes"
                  rows={3}
                  defaultValue={initial?.agendaNotes ?? ""}
                  placeholder={t("meetings.field.agendaPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              {mode === "edit" && (
                <Field label={t("meetings.field.outcomeNotes")} full>
                  <textarea
                    name="outcomeNotes"
                    rows={3}
                    defaultValue={initial?.outcomeNotes ?? ""}
                    placeholder={t("meetings.field.outcomePlaceholder")}
                    className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                  />
                </Field>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 sm:col-span-2">
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
                  className="rounded-md px-4 py-1.5 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--color-brand)" }}
                >
                  {isPending
                    ? t("action.saving")
                    : mode === "create"
                    ? t("meetings.create")
                    : t("action.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="sm:col-span-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </div>
      <div className="border-t border-zinc-800" />
    </div>
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

## `app/meetings/meetings-list.tsx`

<a id="app-meetings-meetings-list-tsx"></a>

```ts
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  Trash2,
  Video,
  XCircle,
  UserCheck,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { displayName } from "@/lib/display";
import { useT, useLocale } from "@/lib/i18n/client";
import { deleteMeetingAction, updateMeetingAction } from "./actions";
import { MeetingForm } from "./meeting-form";

type Filter = "upcoming" | "past" | "all";

interface Meeting {
  id: string;
  clientName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  websiteUrl: string | null;
  socialNotes: string | null;
  meetingAt: Date;
  durationMin: number;
  location: string | null;
  meetingLink: string | null;
  agendaNotes: string | null;
  status: string;
  outcomeNotes: string | null;
  ownerId: string | null;
  reminderSentAt: Date | null;
  owner: { id: string; name: string; nickname: string | null } | null;
}

interface UserLite {
  id: string;
  name: string;
  nickname: string | null;
}

interface Props {
  meetings: Meeting[];
  users: UserLite[];
  currentUserId: string;
  canManage: boolean;
}

function normalizeInstaUrl(v: string): string {
  const s = v.trim().replace(/^@/, "");
  if (/^https?:\/\//.test(s)) return s;
  return `https://instagram.com/${s}`;
}
function normalizeTiktokUrl(v: string): string {
  const s = v.trim().replace(/^@/, "");
  if (/^https?:\/\//.test(s)) return s;
  return `https://www.tiktok.com/@${s}`;
}
function normalizeWebsite(v: string): string {
  const s = v.trim();
  if (/^https?:\/\//.test(s)) return s;
  return `https://${s}`;
}

function formatWhen(d: Date, locale: "ar" | "en"): string {
  const bcp = locale === "en" ? "en-US" : "en";
  return new Date(d).toLocaleString(bcp, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function timeUntil(d: Date, locale: "ar" | "en"): string {
  const ms = new Date(d).getTime() - Date.now();
  const min = Math.round(ms / 60_000);
  if (ms < 0) {
    const ago = Math.abs(min);
    if (locale === "en")
      return ago < 60
        ? `${ago}m ago`
        : ago < 1440
        ? `${Math.round(ago / 60)}h ago`
        : `${Math.round(ago / 1440)}d ago`;
    return ago < 60
      ? `قبل ${ago} دقيقة`
      : ago < 1440
      ? `قبل ${Math.round(ago / 60)} ساعة`
      : `قبل ${Math.round(ago / 1440)} يوم`;
  }
  if (min < 60) return locale === "en" ? `in ${min}m` : `بعد ${min} دقيقة`;
  if (min < 1440)
    return locale === "en"
      ? `in ${Math.round(min / 60)}h`
      : `بعد ${Math.round(min / 60)} ساعة`;
  return locale === "en"
    ? `in ${Math.round(min / 1440)}d`
    : `بعد ${Math.round(min / 1440)} يوم`;
}

export function MeetingsList({ meetings, users, currentUserId, canManage }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const now = Date.now();
  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (filter === "upcoming")
        return m.status === "scheduled" && new Date(m.meetingAt).getTime() >= now - 15 * 60_000;
      if (filter === "past") return new Date(m.meetingAt).getTime() < now - 15 * 60_000 || m.status !== "scheduled";
      return true;
    });
  }, [meetings, filter, now]);

  const grouped = useMemo(() => {
    const bucket = new Map<string, Meeting[]>();
    for (const m of filtered) {
      const key = new Date(m.meetingAt).toDateString();
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key)!.push(m);
    }
    return Array.from(bucket.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  }, [filtered]);

  const markStatus = (id: string, status: string) => {
    const fd = new FormData();
    fd.set("status", status);
    startTransition(async () => {
      await updateMeetingAction(id, fd);
      router.refresh();
    });
  };

  const del = (id: string, clientName: string) => {
    if (!confirm(`${t("meetings.deleteConfirm")} ${clientName}`)) return;
    startTransition(async () => {
      await deleteMeetingAction(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1 w-fit">
        {(["upcoming", "past", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs transition",
              filter === f
                ? "text-zinc-950"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            )}
            style={filter === f ? { background: "var(--color-brand)" } : undefined}
          >
            {t(`meetings.filter.${f}`)}{" "}
            {f === "upcoming" && (
              <span className="ms-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
                {
                  meetings.filter(
                    (m) =>
                      m.status === "scheduled" &&
                      new Date(m.meetingAt).getTime() >= now - 15 * 60_000
                  ).length
                }
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <CalIcon className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("meetings.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">
            {t("meetings.empty.desc")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dayKey, items]) => (
            <div key={dayKey}>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                <CalIcon className="h-3.5 w-3.5" />
                {new Date(dayKey).toLocaleDateString(
                  locale === "en" ? "en-US" : "en",
                  { weekday: "long", year: "numeric", month: "long", day: "numeric" }
                )}
                <span className="text-zinc-600">
                  · {items.length} {t("meetings.items")}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((m) => {
                  const statusTone =
                    m.status === "scheduled"
                      ? "border-sky-500/30 bg-sky-500/5"
                      : m.status === "done"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : m.status === "cancelled"
                      ? "border-zinc-700 bg-zinc-900/40 opacity-70"
                      : "border-rose-500/30 bg-rose-500/5";
                  const msUntil = new Date(m.meetingAt).getTime() - now;
                  const isSoon =
                    m.status === "scheduled" && msUntil > 0 && msUntil <= 60 * 60_000;

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-xl border p-4 transition hover:border-zinc-600",
                        statusTone,
                        isSoon && "ring-1 ring-amber-500/30"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-zinc-100">
                              {m.clientName}
                            </div>
                            {m.companyName && (
                              <div className="text-xs text-zinc-500">
                                · {m.companyName}
                              </div>
                            )}
                            <StatusBadge status={m.status} t={t} />
                            {isSoon && (
                              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                ⚡ {t("meetings.soon")}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatWhen(m.meetingAt, locale)}
                              <span className="text-zinc-600">
                                ({timeUntil(m.meetingAt, locale)})
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              ⏱ {m.durationMin} {t("meetings.minutes")}
                            </span>
                            {m.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {m.location}
                              </span>
                            )}
                            {m.owner && (
                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                {displayName(m.owner)}
                              </span>
                            )}
                          </div>

                          {/* Client contact + social row */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {m.phone && (
                              <Chip
                                icon={Phone}
                                label={m.phone}
                                href={`tel:${m.phone}`}
                              />
                            )}
                            {m.email && (
                              <Chip
                                icon={Mail}
                                label={m.email}
                                href={`mailto:${m.email}`}
                              />
                            )}
                            {m.instagramHandle && (
                              <Chip
                                icon={InstagramIcon}
                                label={m.instagramHandle}
                                href={normalizeInstaUrl(m.instagramHandle)}
                                tone="accent"
                              />
                            )}
                            {m.tiktokHandle && (
                              <Chip
                                icon={TikTokIcon}
                                label={m.tiktokHandle}
                                href={normalizeTiktokUrl(m.tiktokHandle)}
                                tone="accent"
                              />
                            )}
                            {m.websiteUrl && (
                              <Chip
                                icon={GlobeIcon}
                                label={m.websiteUrl.replace(
                                  /^https?:\/\/(www\.)?/,
                                  ""
                                )}
                                href={normalizeWebsite(m.websiteUrl)}
                                tone="accent"
                              />
                            )}
                            {m.meetingLink && (
                              <Chip
                                icon={Video}
                                label={t("meetings.joinCall")}
                                href={m.meetingLink}
                                tone="brand"
                              />
                            )}
                          </div>

                          {m.agendaNotes && (
                            <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
                              <span className="font-semibold text-zinc-300">
                                {t("meetings.field.agendaNotes")}:
                              </span>{" "}
                              {m.agendaNotes}
                            </div>
                          )}
                          {m.outcomeNotes && (
                            <div className="mt-2 rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
                              <span className="font-semibold">
                                {t("meetings.field.outcomeNotes")}:
                              </span>{" "}
                              {m.outcomeNotes}
                            </div>
                          )}
                          {m.socialNotes && (
                            <div className="mt-2 text-[11px] text-zinc-500">
                              💬 {m.socialNotes}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        {canManage && (
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {m.status === "scheduled" && (
                              <>
                                <button
                                  onClick={() => markStatus(m.id, "done")}
                                  disabled={isPending}
                                  className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-400 transition hover:bg-emerald-500/15 disabled:opacity-40"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t("meetings.markDone")}
                                </button>
                                <button
                                  onClick={() => markStatus(m.id, "cancelled")}
                                  disabled={isPending}
                                  className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-40"
                                >
                                  <XCircle className="h-3 w-3" />
                                  {t("meetings.cancel")}
                                </button>
                              </>
                            )}
                            <MeetingForm
                              mode="edit"
                              users={users}
                              currentUserId={currentUserId}
                              initial={m}
                            />
                            <button
                              onClick={() => del(m.id, m.clientName)}
                              disabled={isPending}
                              className="rounded-md border border-rose-500/30 p-1 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
                              aria-label={t("action.delete")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  href,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  tone?: "accent" | "brand";
}) {
  const style =
    tone === "brand"
      ? {
          background: "var(--color-brand-dim)",
          color: "var(--color-brand)",
          borderColor: "var(--color-brand-border)",
        }
      : tone === "accent"
      ? {
          background: "var(--color-accent-dim)",
          color: "var(--color-accent)",
        }
      : undefined;

  const classes = cn(
    "inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-300",
    href && "transition hover:border-zinc-600"
  );

  const content = (
    <>
      <Icon className="h-3 w-3" />
      <span className="truncate max-w-[180px]" dir="ltr">
        {label}
      </span>
      {href && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        style={style}
      >
        {content}
      </a>
    );
  }
  return (
    <span className={classes} style={style}>
      {content}
    </span>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (k: string) => string;
}) {
  const map: Record<string, string> = {
    scheduled: "bg-sky-500/10 text-sky-400",
    done: "bg-emerald-500/10 text-emerald-400",
    cancelled: "bg-zinc-700/40 text-zinc-400",
    no_show: "bg-rose-500/10 text-rose-400",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px]",
        map[status] ?? "bg-zinc-700/40 text-zinc-400"
      )}
    >
      {t(`meetings.status.${status}`)}
    </span>
  );
}

// Inline social icons — lucide@1.x doesn't ship all of them, and we want the
// brand-accurate shape anyway. Stroke-based so they inherit currentColor.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M19.321 5.562a5.124 5.124 0 01-5.16-4.956h-3.427v13.672a3.1 3.1 0 11-2.163-2.954v-3.48a6.579 6.579 0 00-.78-.047A6.597 6.597 0 005.8 18.407v.005A6.6 6.6 0 0017.8 14.01V7.56a8.545 8.545 0 001.521.137V5.562z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
```

---

## `app/meetings/page.tsx`

<a id="app-meetings-page-tsx"></a>

```ts
import { Calendar as CalIcon } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { MeetingForm } from "./meeting-form";
import { MeetingsList } from "./meetings-list";
import { CalendarView } from "./calendar-view";

export default async function MeetingsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const user = session?.user;
  if (!user) return null;

  const canManage = user.role === "admin" || user.role === "manager";

  const [meetings, users] = await Promise.all([
    prisma.clientMeeting.findMany({
      orderBy: { meetingAt: "desc" },
      include: { owner: { select: { id: true, name: true, nickname: true } } },
      take: 500,
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, nickname: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const upcoming = meetings.filter(
    (m) => m.status === "scheduled" && m.meetingAt.getTime() >= now.getTime() - 15 * 60_000
  );
  const next = upcoming.sort((a, b) => a.meetingAt.getTime() - b.meetingAt.getTime())[0];

  const statCount = {
    scheduled: upcoming.length,
    done: meetings.filter((m) => m.status === "done").length,
    cancelled: meetings.filter((m) => m.status === "cancelled").length,
    no_show: meetings.filter((m) => m.status === "no_show").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalIcon className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
            {t("page.meetings.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.meetings.subtitle")}
          </p>
        </div>
        {canManage && (
          <MeetingForm mode="create" users={users} currentUserId={user.id} />
        )}
      </div>

      {/* Next meeting banner */}
      {next && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--color-brand-border)",
            background: "var(--color-brand-dim)",
          }}
        >
          <div
            className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-brand)" }}
          >
            {t("meetings.nextUp")}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-zinc-100">
                {next.clientName}
                {next.companyName && (
                  <span className="ms-2 text-sm font-normal text-zinc-400">
                    · {next.companyName}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {new Date(next.meetingAt).toLocaleString(
                  locale === "en" ? "en-US" : "en",
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }
                )}
                {next.location && ` · ${next.location}`}
                {next.owner && ` · ${next.owner.name}`}
              </div>
            </div>
            {next.meetingLink && (
              <a
                href={next.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-950"
                style={{ background: "var(--color-brand)" }}
              >
                {t("meetings.joinCall")}
              </a>
            )}
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("meetings.status.scheduled")} value={statCount.scheduled} tone="brand" />
        <Kpi label={t("meetings.status.done")} value={statCount.done} tone="positive" />
        <Kpi label={t("meetings.status.cancelled")} value={statCount.cancelled} tone="muted" />
        <Kpi label={t("meetings.status.no_show")} value={statCount.no_show} tone="danger" />
      </div>

      {/* Calendar */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("meetings.calendar.heading")}
        </h2>
        <CalendarView
          meetings={meetings.map((m) => ({
            id: m.id,
            clientName: m.clientName,
            meetingAt: m.meetingAt,
            status: m.status,
          }))}
        />
      </section>

      {/* Full list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("meetings.list.heading")}
        </h2>
        <MeetingsList
          meetings={meetings}
          users={users}
          currentUserId={user.id}
          canManage={canManage}
        />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "positive" | "muted" | "danger";
}) {
  const style =
    tone === "brand"
      ? { color: "var(--color-brand)" }
      : tone === "positive"
      ? { color: "#34d399" }
      : tone === "danger"
      ? { color: "#fb7185" }
      : { color: "#a1a1aa" };
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={style}>
        {value}
      </div>
    </div>
  );
}
```

---

## `app/not-found.tsx`

<a id="app-not-found-tsx"></a>

```ts
// 404 — Next.js renders this for any route that doesn't match.
// Outside the proxy's RBAC layer, so we don't reveal whether a route is
// admin-only vs. truly missing — the 403 redirect handles the former.

import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";

export default async function NotFound() {
  const locale = await getLocale();
  const isAr = locale === "ar";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
        <div className="space-y-1 border-b border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400">
            <Compass className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">404</h1>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-zinc-400">
            {isAr ? "الصفحة اللي تدور عليها مو موجودة." : "The page you’re looking for doesn’t exist."}
          </p>
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-emerald-500/30 hover:text-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {isAr ? "رجوع للرئيسية" : "Back to home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## `app/onboarding/nickname/actions.ts`

<a id="app-onboarding-nickname-actions-ts"></a>

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireActiveUser } from "@/lib/auth-guards";

const NICK_RE = /^[A-Za-z0-9_-]{2,24}$/;

export async function saveNicknameAction(
  nickname: string
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "taken" }> {
  const user = await requireActiveUser();
  const trimmed = nickname.trim();
  if (!NICK_RE.test(trimmed)) {
    return { ok: false, reason: "invalid" };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { nickname: trimmed },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, reason: "taken" };
    }
    throw e;
  }

  revalidatePath("/", "layout");
  redirect("/");
}
```

---

## `app/projects/[id]/members-manager.tsx`

<a id="app-projects--id--members-manager-tsx"></a>

```ts
"use client";

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { addMemberAction, removeMemberAction } from "../actions";
import { displayName } from "@/lib/display";
import { useT } from "@/lib/i18n/client";

interface User {
  id: string;
  name: string;
  nickname: string | null;
  role: string;
  jobTitle: string | null;
  department: string | null;
}

interface Props {
  projectId: string;
  currentMembers: { userId: string; role: string | null; user: User }[];
  allUsers: User[];
}

export function ProjectMembersManager({
  projectId,
  currentMembers,
  allUsers,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const memberIds = new Set(currentMembers.map((m) => m.userId));
  const addable = allUsers.filter((u) => !memberIds.has(u.id));

  const onAdd = (userId: string, role: string) => {
    startTransition(async () => {
      await addMemberAction(projectId, userId, role);
    });
  };

  const onRemove = (userId: string) => {
    if (!confirm(t("projects.members.removeConfirm"))) return;
    startTransition(async () => {
      await removeMemberAction(projectId, userId);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400"
      >
        <UserPlus className="h-3.5 w-3.5" />
        {t("projects.members.manage")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("projects.members.manage")}</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-xs font-semibold text-zinc-400">
                  {t("projects.members.current")}
                </h4>
                {currentMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-500">
                    {t("projects.members.none")}
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
                    {currentMembers.map((m) => (
                      <li key={m.userId} className="flex items-center justify-between p-2">
                        <div>
                          <div className="text-sm text-zinc-200">{displayName(m.user)}</div>
                          <div className="text-[11px] text-zinc-500">
                            {m.role || m.user.jobTitle || m.user.role}
                          </div>
                        </div>
                        <button
                          onClick={() => onRemove(m.userId)}
                          disabled={isPending}
                          className="rounded-md border border-rose-500/30 px-2 py-1 text-[11px] text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
                        >
                          {t("projects.members.remove")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold text-zinc-400">
                  {t("projects.members.add")}
                </h4>
                {addable.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-500">
                    {t("projects.members.allAdded")}
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 max-h-64 overflow-auto">
                    {addable.map((u) => (
                      <AddRow
                        key={u.id}
                        user={u}
                        onAdd={(role) => onAdd(u.id, role)}
                        disabled={isPending}
                        t={t}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                {t("action.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AddRow({
  user,
  onAdd,
  disabled,
  t,
}: {
  user: User;
  onAdd: (role: string) => void;
  disabled: boolean;
  t: (key: string) => string;
}) {
  const [role, setRole] = useState(user.jobTitle || "");
  return (
    <li className="flex items-center gap-2 p-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-zinc-200">{displayName(user)}</div>
      </div>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder={t("team.member.role")}
        className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
      />
      <button
        onClick={() => onAdd(role)}
        disabled={disabled}
        className="rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {t("projects.members.addBtn")}
      </button>
    </li>
  );
}
```

---

## `app/projects/[id]/page.tsx`

<a id="app-projects--id--page-tsx"></a>

```ts
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
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { ProjectMembersManager } from "./members-manager";
import { displayName } from "@/lib/display";
import { ProjectActionsMenu } from "./project-actions-menu";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { InvoiceBadge } from "@/components/projects/invoice-badge";

export default async function ProjectDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const canManage =
    session?.user.role === "admin" || session?.user.role === "manager";

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      lead: { select: { id: true, name: true, nickname: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              nickname: true,
              role: true,
              jobTitle: true,
              department: true,
            },
          },
        },
      },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, nickname: true } },
          project: { select: { id: true, title: true } },
          collaborators: {
            include: { user: { select: { id: true, name: true, nickname: true } } },
          },
        },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
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
        nickname: true,
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
                  {displayName(m.user)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-100">{displayName(m.user)}</div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {m.role ? m.role : m.user.jobTitle || m.user.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tasks Kanban */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("page.tasks.title")} ({project.tasks.length})
          </h2>
          <NewTaskButton
            users={allUsers.map((u) => ({ id: u.id, name: u.name, nickname: u.nickname }))}
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
            }))}
            users={allUsers.map((u) => ({ id: u.id, name: u.name, nickname: u.nickname }))}
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

## `app/projects/new-project-button.tsx`

<a id="app-projects-new-project-button-tsx"></a>

```ts
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createProjectAction } from "./actions";
import { displayName } from "@/lib/display";
import { useT } from "@/lib/i18n/client";

interface User {
  id: string;
  name: string;
  nickname: string | null;
  role: string;
}

export function NewProjectButton({ users }: { users: User[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [billingType, setBillingType] = useState<"one_time" | "monthly">("one_time");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await createProjectAction(formData);
      if (res.ok && res.id) {
        setOpen(false);
        formRef.current?.reset();
        setBillingType("one_time");
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
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
                <input
                  name="clientName"
                  placeholder={t("projects.field.clientPlaceholder")}
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
                      {displayName(u)}
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

## `app/projects/page.tsx`

<a id="app-projects-page-tsx"></a>

```ts
import Link from "next/link";
import { AlertCircle, Briefcase, Repeat, Users } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import {
  PRIORITY_COLOR,
  PROJECT_STATUS_COLOR,
  formatDate,
  formatQar,
  isOverdue,
} from "@/lib/db/helpers";
import { cn } from "@/lib/cn";
import { NewProjectButton } from "./new-project-button";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { InvoiceBadge } from "@/components/projects/invoice-badge";

export default async function ProjectsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const canManage =
    session?.user.role === "admin" || session?.user.role === "manager";

  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      include: {
        client: true,
        lead: { select: { id: true, name: true, nickname: true } },
        _count: {
          select: { members: true, tasks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, nickname: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("page.projects.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {projects.length} {t("projects.count")} · {t("projects.subtitle")}
          </p>
        </div>
        {canManage && <NewProjectButton users={users} />}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Briefcase className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("projects.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">
            {t("projects.empty.desc.full")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const overdue = isOverdue(p.deadlineAt, p.status);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className={cn(
                  "group rounded-xl border bg-zinc-900/40 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-900/60",
                  overdue ? "border-rose-500/50" : "border-zinc-800"
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {p.title}
                    </div>
                    {p.client && (
                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                        {p.client.name}
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                      PROJECT_STATUS_COLOR[p.status]
                    )}
                  >
                    {t(`projectStatus.${p.status}`)}
                  </span>
                </div>

                {p.description && (
                  <p className="mb-3 line-clamp-2 text-xs text-zinc-400">
                    {p.description}
                  </p>
                )}

                {/* Progress */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{t("projects.progress")}</span>
                    <span className="tabular-nums">{p.progressPct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={cn(
                        "h-full transition-all",
                        p.progressPct >= 100
                          ? "bg-emerald-500"
                          : overdue
                          ? "bg-rose-500"
                          : "bg-sky-500"
                      )}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-[11px] text-zinc-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {p._count.members}
                    </span>
                    <span>
                      {p._count.tasks} {t("projects.taskWord")}
                    </span>
                  </div>
                  <div className="text-start">
                    {p.type && (
                      <span className="text-zinc-600">
                        {t(`projectType.${p.type}`)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={cn("tabular-nums", PRIORITY_COLOR[p.priority])}>
                    {t("projects.priorityPrefix")} {t(`priority.${p.priority}`)}
                  </span>
                  {p.deadlineAt && (
                    <span
                      className={cn(
                        "flex items-center gap-1 tabular-nums",
                        overdue ? "text-rose-400" : "text-zinc-500"
                      )}
                    >
                      {overdue && <AlertCircle className="h-3 w-3" />}
                      {formatDate(p.deadlineAt, locale)}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  {p.budgetQar > 0 && (
                    <span className="tabular-nums text-emerald-400">
                      {formatQar(p.budgetQar, { locale })}
                      {p.billingType === "monthly" && (
                        <span className="opacity-70">{t("projects.perMonth")}</span>
                      )}
                    </span>
                  )}
                  {p.billingType === "monthly" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
                      <Repeat className="h-2.5 w-2.5" />
                      {t("projects.monthly")}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-600">
                      {t("projects.oneTime")}
                    </span>
                  )}
                </div>

                {p.billingType === "monthly" && p.nextInvoiceDueAt && (
                  <div className="mt-2 flex justify-end">
                    <InvoiceBadge
                      projectId={p.id}
                      budgetQar={p.budgetQar}
                      nextInvoiceDueAt={p.nextInvoiceDueAt}
                      locale={locale}
                      size="compact"
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## `app/shoots/[id]/page.tsx`

<a id="app-shoots--id--page-tsx"></a>

```ts
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
import { displayName } from "@/lib/display";
import { ShootActions } from "../shoot-actions";

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
 * We keep it simple: if it's a maps.google.com or maps.app.goo.gl link with a
 * place or `q=` param, we fall back to the generic "q=<encoded location>" embed.
 * Otherwise we just return null and the UI shows a button link.
 */
function buildMapEmbed(rawLocation: string, mapUrl: string | null): string {
  // Use the text location as a search query — reliable across all Google links.
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
  const canManage = user.role === "admin" || user.role === "manager";

  const shoot = await prisma.photoShoot.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true } },
      crew: {
        include: {
          user: {
            select: { id: true, name: true, nickname: true, jobTitle: true, role: true },
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
          select: { id: true, name: true, nickname: true },
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
                ? shoot.crew.map((c) => displayName(c.user)).join(" · ")
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
                    {displayName(c.user)}
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

## `app/shoots/page.tsx`

<a id="app-shoots-page-tsx"></a>

```ts
import Link from "next/link";
import {
  Camera,
  Clock,
  MapPin,
  Users,
  Package,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";
import { displayName } from "@/lib/display";
import { ShootForm } from "./shoot-form";
import { CalendarView } from "../meetings/calendar-view";
import { ShootActions } from "./shoot-actions";

export default async function ShootsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const user = session?.user;
  if (!user) return null;
  const canManage = user.role === "admin" || user.role === "manager";

  const [shoots, users, projects, equipment] = await Promise.all([
    prisma.photoShoot.findMany({
      orderBy: { shootDate: "desc" },
      include: {
        project: { select: { id: true, title: true } },
        crew: {
          include: { user: { select: { id: true, name: true, nickname: true } } },
        },
        equipment: {
          include: {
            equipment: {
              select: { id: true, name: true, category: true },
            },
          },
        },
      },
      take: 500,
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, nickname: true },
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
  ]);

  const now = new Date();

  // User-specific upcoming shoots — so a photographer sees "my next shoots"
  const myUpcoming = shoots.filter(
    (s) =>
      s.status === "scheduled" &&
      s.shootDate.getTime() >= now.getTime() &&
      s.crew.some((c) => c.user.id === user.id)
  );

  // Conflict detection — crew members booked on overlapping shoots.
  const conflicts = detectConflicts(
    shoots.filter((s) => s.status === "scheduled")
  );

  const upcomingAll = shoots
    .filter(
      (s) => s.status === "scheduled" && s.shootDate.getTime() >= now.getTime()
    )
    .sort((a, b) => a.shootDate.getTime() - b.shootDate.getTime());
  const past = shoots.filter(
    (s) => s.status !== "scheduled" || s.shootDate.getTime() < now.getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Camera className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
            {t("page.shoots.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.shoots.subtitle")}
          </p>
        </div>
        {canManage && (
          <ShootForm
            mode="create"
            users={users}
            projects={projects}
            equipment={equipment}
          />
        )}
      </div>

      {/* "My next shoots" banner — only shown when the user is on crew of upcoming shoots */}
      {myUpcoming.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--color-brand-border)",
            background: "var(--color-brand-dim)",
          }}
        >
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-brand)" }}
          >
            {t("shoots.myUpcoming")} · {myUpcoming.length}
          </div>
          <div className="space-y-2">
            {myUpcoming.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-950/40 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-semibold text-zinc-100">{s.title}</div>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    {s.shootDate.toLocaleString(
                      locale === "en" ? "en-US" : "en",
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      }
                    )}
                    {" · "}
                    <MapPin className="inline h-3 w-3" /> {s.location}
                  </div>
                </div>
                {s.mapUrl && (
                  <a
                    href={s.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                  >
                    <MapPin className="h-3 w-3" />
                    {t("shoots.openMap")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts warning */}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <div className="mb-2 text-xs font-semibold text-rose-300">
            ⚠ {t("shoots.conflictsTitle")} · {conflicts.length}
          </div>
          <ul className="space-y-1 text-xs text-rose-200/80">
            {conflicts.slice(0, 5).map((c, i) => (
              <li key={i}>
                {c.userName}: {c.shootA} & {c.shootB}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("shoots.stats.upcoming")} value={upcomingAll.length} tone="brand" />
        <Kpi label={t("shoots.stats.done")} value={shoots.filter((s) => s.status === "done").length} tone="positive" />
        <Kpi label={t("shoots.stats.cancelled")} value={shoots.filter((s) => s.status === "cancelled").length} tone="muted" />
        <Kpi label={t("shoots.stats.postponed")} value={shoots.filter((s) => s.status === "postponed").length} tone="accent" />
      </div>

      {/* Calendar */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("shoots.calendar.heading")}
        </h2>
        <CalendarView
          meetings={shoots.map((s) => ({
            id: s.id,
            clientName: s.title,
            meetingAt: s.shootDate,
            status: s.status,
          }))}
        />
      </section>

      {/* Upcoming list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("shoots.list.upcoming")}
        </h2>
        {upcomingAll.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
            {t("shoots.empty.upcoming")}
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingAll.map((s) => (
              <ShootCard
                key={s.id}
                shoot={s}
                locale={locale}
                t={t}
                canManage={canManage}
                users={users}
                projects={projects}
                equipment={equipment}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past list */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">
            {t("shoots.list.past")}
          </h2>
          <div className="space-y-2">
            {past.slice(0, 20).map((s) => (
              <ShootCard
                key={s.id}
                shoot={s}
                locale={locale}
                t={t}
                canManage={canManage}
                users={users}
                projects={projects}
                equipment={equipment}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type ShootWithIncludes = Awaited<
  ReturnType<typeof prisma.photoShoot.findMany>
>[number] & {
  project: { id: string; title: string } | null;
  crew: { user: { id: string; name: string } }[];
  equipment: {
    equipment: { id: string; name: string; category: string };
  }[];
};

function ShootCard({
  shoot,
  locale,
  t,
  canManage,
  users,
  projects,
  equipment,
}: {
  shoot: ShootWithIncludes;
  locale: "ar" | "en";
  t: (k: string) => string;
  canManage: boolean;
  users: { id: string; name: string; nickname: string | null }[];
  projects: { id: string; title: string }[];
  equipment: { id: string; name: string; category: string }[];
}) {
  const now = Date.now();
  const msUntil = new Date(shoot.shootDate).getTime() - now;
  const isSoon = shoot.status === "scheduled" && msUntil > 0 && msUntil <= 24 * 60 * 60_000;

  const statusTone =
    shoot.status === "scheduled"
      ? "border-sky-500/30 bg-sky-500/5"
      : shoot.status === "done"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : shoot.status === "postponed"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-zinc-700 bg-zinc-900/40 opacity-70";

  const statusBadge: Record<string, string> = {
    scheduled: "bg-sky-500/10 text-sky-400",
    done: "bg-emerald-500/10 text-emerald-400",
    cancelled: "bg-zinc-700/40 text-zinc-400",
    postponed: "bg-amber-500/10 text-amber-400",
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        statusTone,
        isSoon && "ring-1 ring-amber-500/30"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Link
              href={`/shoots/${shoot.id}`}
              className="text-base font-semibold text-zinc-100 transition hover:underline"
              style={{ textDecorationColor: "var(--color-brand)" }}
            >
              {shoot.title}
            </Link>
            {shoot.project && (
              <Link
                href={`/projects/${shoot.project.id}`}
                className="text-xs text-sky-400 hover:underline"
              >
                📁 {shoot.project.title}
              </Link>
            )}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px]",
                statusBadge[shoot.status] ?? "bg-zinc-700/40 text-zinc-400"
              )}
            >
              {t(`shoots.status.${shoot.status}`)}
            </span>
            {isSoon && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                ⚡ {t("shoots.soon")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {shoot.shootDate.toLocaleString(
                locale === "en" ? "en-US" : "en",
                {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                }
              )}
            </span>
            <span>⏱ {shoot.durationHours}{t("shoots.hoursShort")}</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {shoot.location}
            </span>
            {shoot.mapUrl && (
              <a
                href={shoot.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-zinc-200"
                style={{ color: "var(--color-accent)" }}
              >
                <ExternalLink className="h-3 w-3" />
                {t("shoots.openMap")}
              </a>
            )}
            <Link
              href={`/shoots/${shoot.id}`}
              className="flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800"
            >
              {t("shoots.viewDetails")}
            </Link>
          </div>
          {shoot.locationNotes && (
            <div className="mt-1 text-[11px] text-zinc-500">
              📍 {shoot.locationNotes}
            </div>
          )}
          {shoot.clientContact && (
            <div className="mt-1 text-[11px] text-zinc-500">
              📞 {shoot.clientContact}
            </div>
          )}

          {/* Crew chips */}
          {shoot.crew.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Users className="h-3 w-3" />
              </span>
              {shoot.crew.map((c) => (
                <span
                  key={c.user.id}
                  className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-[10px] text-zinc-300"
                >
                  {displayName(c.user)}
                </span>
              ))}
            </div>
          )}
          {/* Equipment chips */}
          {shoot.equipment.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Package className="h-3 w-3" />
              </span>
              {shoot.equipment.map((e) => (
                <span
                  key={e.equipment.id}
                  className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-[10px] text-zinc-300"
                >
                  {e.equipment.name}
                </span>
              ))}
            </div>
          )}

          {shoot.shotList && (
            <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">
                📋 {t("shoots.field.shotList")}:
              </span>{" "}
              {shoot.shotList}
            </div>
          )}
          {shoot.referenceUrl && (
            <div className="mt-1.5">
              <a
                href={shoot.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px]"
                style={{ color: "var(--color-accent)" }}
              >
                <ExternalLink className="h-3 w-3" />
                {t("shoots.openReference")}
              </a>
            </div>
          )}
        </div>

        {canManage && (
          <ShootActions
            shoot={shoot}
            users={users}
            projects={projects}
            equipment={equipment}
          />
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "positive" | "muted" | "accent";
}) {
  const style =
    tone === "brand"
      ? { color: "var(--color-brand)" }
      : tone === "positive"
      ? { color: "#34d399" }
      : tone === "accent"
      ? { color: "var(--color-accent)" }
      : { color: "#a1a1aa" };
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={style}>
        {value}
      </div>
    </div>
  );
}

interface Conflict {
  userName: string;
  shootA: string;
  shootB: string;
}

/**
 * Two shoots conflict for a crew member if they overlap in time.
 * Overlap check: A starts before B ends, and B starts before A ends.
 */
function detectConflicts(
  shoots: {
    title: string;
    shootDate: Date;
    durationHours: number;
    crew: { user: { id: string; name: string } }[];
  }[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < shoots.length; i++) {
    for (let j = i + 1; j < shoots.length; j++) {
      const a = shoots[i];
      const b = shoots[j];
      const aStart = a.shootDate.getTime();
      const aEnd = aStart + a.durationHours * 3600_000;
      const bStart = b.shootDate.getTime();
      const bEnd = bStart + b.durationHours * 3600_000;
      if (aStart < bEnd && bStart < aEnd) {
        const aUsers = new Map(a.crew.map((c) => [c.user.id, displayName(c.user)]));
        for (const c of b.crew) {
          if (aUsers.has(c.user.id)) {
            conflicts.push({
              userName: aUsers.get(c.user.id)!,
              shootA: a.title,
              shootB: b.title,
            });
          }
        }
      }
    }
  }
  return conflicts;
}
```

---

## `app/shoots/shoot-actions.tsx`

<a id="app-shoots-shoot-actions-tsx"></a>

```ts
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { deleteShootAction, updateShootAction } from "./actions";
import { ShootForm } from "./shoot-form";
import { useT } from "@/lib/i18n/client";

interface Shoot {
  id: string;
  title: string;
  projectId: string | null;
  shootDate: Date;
  durationHours: number;
  location: string;
  locationNotes: string | null;
  mapUrl: string | null;
  clientContact: string | null;
  shotList: string | null;
  referenceUrl: string | null;
  notes: string | null;
  status: string;
  crew: { user: { id: string; name: string } }[];
  equipment: { equipment: { id: string; name: string; category: string } }[];
}

interface Props {
  shoot: Shoot;
  users: { id: string; name: string; nickname: string | null }[];
  projects: { id: string; title: string }[];
  equipment: { id: string; name: string; category: string }[];
}

export function ShootActions({ shoot, users, projects, equipment }: Props) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setStatus = (status: string) => {
    const fd = new FormData();
    fd.set("status", status);
    startTransition(async () => {
      await updateShootAction(shoot.id, fd);
      router.refresh();
    });
  };

  const del = () => {
    if (!confirm(`${t("shoots.deleteConfirm")} ${shoot.title}`)) return;
    startTransition(async () => {
      await deleteShootAction(shoot.id);
      router.refresh();
    });
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {shoot.status === "scheduled" && (
        <>
          <button
            onClick={() => setStatus("done")}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-400 transition hover:bg-emerald-500/15 disabled:opacity-40"
          >
            <CheckCircle2 className="h-3 w-3" />
            {t("shoots.markDone")}
          </button>
          <button
            onClick={() => setStatus("cancelled")}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            <XCircle className="h-3 w-3" />
            {t("shoots.cancel")}
          </button>
        </>
      )}
      <ShootForm
        mode="edit"
        users={users}
        projects={projects}
        equipment={equipment}
        initial={{
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
          crewIds: shoot.crew.map((c) => c.user.id),
          equipmentIds: shoot.equipment.map((e) => e.equipment.id),
        }}
      />
      <button
        onClick={del}
        disabled={isPending}
        className="rounded-md border border-rose-500/30 p-1 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
        aria-label={t("action.delete")}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
```

---

## `app/shoots/shoot-form.tsx`

<a id="app-shoots-shoot-form-tsx"></a>

```ts
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, Users, Package } from "lucide-react";
import { cn } from "@/lib/cn";
import { createShootAction, updateShootAction } from "./actions";
import { displayName } from "@/lib/display";
import { useT } from "@/lib/i18n/client";

interface UserLite {
  id: string;
  name: string;
  nickname: string | null;
}
interface ProjectLite {
  id: string;
  title: string;
}
interface EquipmentLite {
  id: string;
  name: string;
  category: string;
}

interface ShootInitial {
  id: string;
  title: string;
  projectId: string | null;
  shootDate: Date;
  durationHours: number;
  location: string;
  locationNotes: string | null;
  mapUrl: string | null;
  clientContact: string | null;
  shotList: string | null;
  referenceUrl: string | null;
  notes: string | null;
  status: string;
  crewIds: string[];
  equipmentIds: string[];
}

interface Props {
  mode: "create" | "edit";
  users: UserLite[];
  projects: ProjectLite[];
  equipment: EquipmentLite[];
  initial?: ShootInitial;
}

function dateToLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function ShootForm({
  mode,
  users,
  projects,
  equipment,
  initial,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [crewIds, setCrewIds] = useState<string[]>(initial?.crewIds ?? []);
  const [equipmentIds, setEquipmentIds] = useState<string[]>(
    initial?.equipmentIds ?? []
  );

  const defaultStart = initial
    ? dateToLocalInput(new Date(initial.shootDate))
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return dateToLocalInput(d);
      })();

  const toggleCrew = (id: string) =>
    setCrewIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  const toggleEquipment = (id: string) =>
    setEquipmentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  const onSubmit = (formData: FormData) => {
    setError(null);
    formData.set("crewIds", crewIds.join(","));
    formData.set("equipmentIds", equipmentIds.join(","));
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createShootAction(formData)
          : await updateShootAction(initial!.id, formData);
      if (res.ok) {
        setOpen(false);
        if (!initial) {
          setCrewIds([]);
          setEquipmentIds([]);
        }
        formRef.current?.reset();
        router.refresh();
      } else {
        const msg = (res as { message?: string }).message;
        setError(msg ?? t("common.errorGeneric"));
      }
    });
  };

  // Group equipment by category so the picker is navigable.
  const byCategory = equipment.reduce<Record<string, EquipmentLite[]>>(
    (acc, e) => {
      if (!acc[e.category]) acc[e.category] = [];
      acc[e.category].push(e);
      return acc;
    },
    {}
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
          mode === "create"
            ? "text-zinc-950 hover:opacity-90"
            : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        )}
        style={
          mode === "create" ? { background: "var(--color-brand)" } : undefined
        }
      >
        {mode === "create" && <Plus className="h-4 w-4" />}
        {mode === "create" ? t("shoots.new") : t("action.edit")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-[5vh]"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {mode === "create" ? t("shoots.new") : t("shoots.edit")}
              </h3>
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
              <Field label={`${t("shoots.field.title")} *`} full>
                <input
                  name="title"
                  required
                  defaultValue={initial?.title ?? ""}
                  placeholder={t("shoots.field.titlePlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.project")}>
                <select
                  name="projectId"
                  defaultValue={initial?.projectId ?? ""}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </Field>
              {mode === "edit" && (
                <Field label={t("shoots.field.status")}>
                  <select
                    name="status"
                    defaultValue={initial?.status ?? "scheduled"}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                  >
                    <option value="scheduled">{t("shoots.status.scheduled")}</option>
                    <option value="done">{t("shoots.status.done")}</option>
                    <option value="cancelled">{t("shoots.status.cancelled")}</option>
                    <option value="postponed">{t("shoots.status.postponed")}</option>
                  </select>
                </Field>
              )}
              <Field label={`${t("shoots.field.date")} *`}>
                <input
                  type="datetime-local"
                  name="shootDate"
                  required
                  defaultValue={defaultStart}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.duration")}>
                <select
                  name="durationHours"
                  defaultValue={String(initial?.durationHours ?? 4)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="1">1 {t("shoots.hours")}</option>
                  <option value="2">2 {t("shoots.hours")}</option>
                  <option value="3">3 {t("shoots.hours")}</option>
                  <option value="4">4 {t("shoots.hours")}</option>
                  <option value="6">6 {t("shoots.hours")}</option>
                  <option value="8">8 {t("shoots.hours")}</option>
                  <option value="12">12 {t("shoots.hours")}</option>
                </select>
              </Field>
              <Field label={`${t("shoots.field.location")} *`} full>
                <input
                  name="location"
                  required
                  defaultValue={initial?.location ?? ""}
                  placeholder={t("shoots.field.locationPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.locationNotes")}>
                <input
                  name="locationNotes"
                  defaultValue={initial?.locationNotes ?? ""}
                  placeholder={t("shoots.field.locationNotesPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.mapUrl")}>
                <input
                  type="url"
                  name="mapUrl"
                  defaultValue={initial?.mapUrl ?? ""}
                  placeholder="https://maps.google.com/..."
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.clientContact")}>
                <input
                  name="clientContact"
                  defaultValue={initial?.clientContact ?? ""}
                  placeholder={t("shoots.field.clientContactPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.referenceUrl")}>
                <input
                  type="url"
                  name="referenceUrl"
                  defaultValue={initial?.referenceUrl ?? ""}
                  placeholder="https://drive.google.com/..."
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              {/* Crew multi-select */}
              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users className="h-3 w-3" />
                  {t("shoots.field.crew")} · {crewIds.length}
                </div>
                <div className="flex flex-wrap gap-1.5 rounded-md border border-zinc-700 bg-zinc-950 p-2">
                  {users.length === 0 && (
                    <span className="text-xs text-zinc-600">
                      {t("shoots.noCrewAvailable")}
                    </span>
                  )}
                  {users.map((u) => {
                    const selected = crewIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleCrew(u.id)}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                          selected
                            ? "border-transparent text-zinc-950"
                            : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        )}
                        style={
                          selected
                            ? { background: "var(--color-brand)" }
                            : undefined
                        }
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {displayName(u)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Equipment multi-select */}
              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Package className="h-3 w-3" />
                  {t("shoots.field.equipment")} · {equipmentIds.length}
                </div>
                <div className="space-y-2 rounded-md border border-zinc-700 bg-zinc-950 p-2 max-h-64 overflow-auto">
                  {equipment.length === 0 && (
                    <span className="text-xs text-zinc-600">
                      {t("shoots.noEquipmentAvailable")}
                    </span>
                  )}
                  {Object.entries(byCategory).map(([cat, items]) => (
                    <div key={cat}>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        {t(`equipment.category.${cat}`)}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((e) => {
                          const selected = equipmentIds.includes(e.id);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => toggleEquipment(e.id)}
                              className={cn(
                                "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition",
                                selected
                                  ? "border-transparent text-zinc-950"
                                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                              )}
                              style={
                                selected
                                  ? { background: "var(--color-brand)" }
                                  : undefined
                              }
                            >
                              {selected && <Check className="h-2.5 w-2.5" />}
                              {e.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Field label={t("shoots.field.shotList")} full>
                <textarea
                  name="shotList"
                  rows={3}
                  defaultValue={initial?.shotList ?? ""}
                  placeholder={t("shoots.field.shotListPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.notes")} full>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={initial?.notes ?? ""}
                  placeholder={t("shoots.field.notesPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <div className="flex items-center justify-end gap-2 pt-3 sm:col-span-2">
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
                  className="rounded-md px-4 py-1.5 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--color-brand)" }}
                >
                  {isPending
                    ? t("action.saving")
                    : mode === "create"
                    ? t("shoots.create")
                    : t("action.save")}
                </button>
              </div>
            </form>
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

## `app/tasks/page.tsx`

<a id="app-tasks-page-tsx"></a>

```ts
import { prisma } from "@/lib/db/prisma";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { KanbanSquare } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

export default async function TasksPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(key, locale);

  const [tasks, users, projects, badges] = await Promise.all([
    prisma.task.findMany({
      include: {
        assignee: { select: { id: true, name: true, nickname: true } },
        project: { select: { id: true, title: true } },
        collaborators: {
          include: { user: { select: { id: true, name: true, nickname: true } } },
        },
        _count: { select: { comments: true } },
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, nickname: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { status: { in: ["active", "on_hold"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
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

  const overdueCount = tasks.filter(
    (t) =>
      t.dueAt &&
      t.dueAt.getTime() < Date.now() &&
      t.status !== "done" &&
      t.status !== "cancelled"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("page.tasks.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {tasks.length} {t("tasks.count")}
            {overdueCount > 0 && (
              <span className="mx-1 text-rose-400">
                ·{" "}
                <span className="font-semibold">
                  {overdueCount} {t("tasks.overdue")}
                </span>
              </span>
            )}
            <span className="mx-2 text-zinc-600">· {t("tasks.clickToEdit")}</span>
          </p>
        </div>
        <NewTaskButton users={users} projects={projects} badges={badges} />
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <KanbanSquare className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("tasks.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">
            {t("tasks.empty.desc.full")}
          </p>
        </div>
      ) : (
        <KanbanBoard
          tasks={tasks.map((t) => ({
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
          }))}
          users={users}
          projects={projects}
          allowProjectChange
        />
      )}
    </div>
  );
}
```

---

## `app/team/[id]/page.tsx`

<a id="app-team--id--page-tsx"></a>

```ts
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  DollarSign,
  KanbanSquare,
  Mail,
  Phone,
} from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";
import {
  PROJECT_STATUS_COLOR,
  formatDate,
  formatQar,
  isOverdue,
} from "@/lib/db/helpers";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { displayName } from "@/lib/display";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

export default async function EmployeeDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const isAdmin = session?.user.role === "admin";

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          project: {
            select: {
              id: true,
              title: true,
              status: true,
              deadlineAt: true,
              progressPct: true,
              clientId: true,
              client: { select: { name: true } },
            },
          },
        },
      },
      tasksAssigned: {
        include: {
          assignee: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
          collaborators: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      },
      taskCollaborations: {
        include: {
          task: {
            include: {
              assignee: { select: { id: true, name: true } },
              project: { select: { id: true, title: true } },
              collaborators: {
                include: { user: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      badges: {
        include: { badge: true },
        orderBy: { badge: { sortOrder: "asc" } },
      },
    },
  });

  if (!user) notFound();

  const allUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, nickname: true },
    orderBy: { name: "asc" },
  });

  const allProjects = await prisma.project.findMany({
    where: { status: { in: ["active", "on_hold"] } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  // Combine tasks where user is primary assignee + tasks where user is a collaborator.
  // Dedupe by task id (a task could have user as primary AND collaborator in theory).
  const tasksMap = new Map<string, (typeof user.tasksAssigned)[number]>();
  for (const t of user.tasksAssigned) tasksMap.set(t.id, t);
  for (const c of user.taskCollaborations) {
    if (!tasksMap.has(c.task.id)) {
      tasksMap.set(c.task.id, c.task as (typeof user.tasksAssigned)[number]);
    }
  }
  const allTasks = Array.from(tasksMap.values());

  const openTasks = allTasks.filter(
    (t) => t.status !== "done" && t.status !== "blocked"
  );
  const overdueTasks = allTasks.filter((t) => isOverdue(t.dueAt, t.status));
  const doneTasks = allTasks.filter((t) => t.status === "done");

  const totalEstimated = allTasks.reduce(
    (s, t) => s + (t.estimatedHours ?? 0),
    0
  );

  const activeProjects = user.memberships.filter(
    (m) => m.project.status === "active" || m.project.status === "on_hold"
  );

  const roleColor =
    user.role === "admin"
      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
      : user.role === "manager"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : user.role === "department_head"
      ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

  return (
    <div className="space-y-6">
      <Link
        href="/team"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowRight className="h-3 w-3" />
        {t("team.allTeam")}
      </Link>

      {/* Profile */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-2xl font-bold text-zinc-100">
            {displayName(user)[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-100">{displayName(user)}</h1>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", roleColor)}>
                {t(`role.${user.role}`) ?? user.role}
              </span>
              {!user.active && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                  {t("team.label.disabled")}
                </span>
              )}
            </div>
            {user.jobTitle && (
              <div className="mt-1 text-sm text-zinc-400">{user.jobTitle}</div>
            )}
            {user.department && (
              <div className="text-xs text-zinc-500">{user.department}</div>
            )}
            {user.badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.badges.map((ub) => (
                  <span
                    key={ub.badgeId}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      borderColor: ub.badge.colorHex + "55",
                      backgroundColor: ub.badge.colorHex + "15",
                      color: ub.badge.colorHex,
                    }}
                  >
                    <span>{ub.badge.icon}</span>
                    <span>
                      {locale === "ar" ? ub.badge.labelAr : ub.badge.labelEn}
                    </span>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
              {/* Real email is president-only. */}
              {isAdmin && (
                <span className="flex items-center gap-1.5" dir="ltr">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </span>
              )}
              {user.phone && (
                <span className="flex items-center gap-1.5" dir="ltr">
                  <Phone className="h-3 w-3" />
                  {user.phone}
                </span>
              )}
              {user.hiredAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {t("team.hiredLabel")}: {formatDate(user.hiredAt, locale)}
                </span>
              )}
              {isAdmin && user.salaryQar && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <DollarSign className="h-3 w-3" />
                  {formatQar(user.salaryQar, { locale })}
                  {t("team.salarySuffix.ar")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 md:grid-cols-4">
          <Stat icon={Briefcase} label={t("kpi.activeProjects")} value={String(activeProjects.length)} />
          <Stat
            icon={KanbanSquare}
            label={t("kpi.openTasks")}
            value={String(openTasks.length)}
          />
          <Stat
            icon={AlertCircle}
            label={t("kpi.overdueTasks")}
            value={String(overdueTasks.length)}
            tone={overdueTasks.length > 0 ? "danger" : undefined}
          />
          <Stat
            label={t("team.estimatedHours")}
            value={`${totalEstimated}h`}
            subtext={t("team.completedCount").replace("{n}", String(doneTasks.length))}
          />
        </div>
      </div>

      {/* Projects the user is in */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          {t("team.projectsCount").replace("{n}", String(user.memberships.length))}
        </h2>
        {user.memberships.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
            {t("team.noMemberAssigned")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {user.memberships.map((m) => (
              <Link
                key={m.projectId}
                href={`/projects/${m.projectId}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 transition hover:border-emerald-500/40 hover:bg-zinc-900/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {m.project.title}
                    </div>
                    {m.project.client && (
                      <div className="truncate text-xs text-zinc-500">
                        {m.project.client.name}
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                      PROJECT_STATUS_COLOR[m.project.status]
                    )}
                  >
                    {t(`projectStatus.${m.project.status}`)}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-zinc-500">
                  {t("team.member.role")}: {m.role || t("team.member.default")}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-sky-500"
                    style={{ width: `${m.project.progressPct}%` }}
                  />
                </div>
                {m.project.deadlineAt && (
                  <div className="mt-1 text-[10px] text-zinc-600 tabular-nums">
                    {t("projects.deadline")}: {formatDate(m.project.deadlineAt, locale)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Tasks Kanban */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("team.tasksCount").replace("{n}", String(allTasks.length))}
          </h2>
          <div className="text-xs text-zinc-500">
            {t("team.tasks.hint")}
          </div>
        </div>
        {allTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
            {t("team.tasks.none")}
          </div>
        ) : (
          <KanbanBoard
            tasks={allTasks.map((t) => ({
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
            }))}
            users={allUsers}
            projects={allProjects}
            allowProjectChange
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
      <div className={cn("mt-1 text-xl font-bold tabular-nums", color)}>
        {value}
      </div>
      {subtext && <div className="text-[10px] text-zinc-600">{subtext}</div>}
    </div>
  );
}
```

---

## `app/team/page.tsx`

<a id="app-team-page-tsx"></a>

```ts
import Link from "next/link";
import { AlertCircle, ChevronLeft, ChevronRight, Mail, Phone, Users } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { formatQar, isOverdue } from "@/lib/db/helpers";
import { cn } from "@/lib/cn";
import { displayName } from "@/lib/display";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

export default async function TeamPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const Chevron = locale === "ar" ? ChevronLeft : ChevronRight;
  const isAdmin = session?.user.role === "admin";

  const users = await prisma.user.findMany({
    where: { active: true },
    include: {
      memberships: {
        include: {
          project: {
            select: { id: true, title: true, status: true },
          },
        },
      },
      tasksAssigned: {
        where: { status: { in: ["todo", "in_progress", "in_review"] } },
        select: { id: true, status: true, dueAt: true, title: true },
      },
      badges: {
        include: { badge: true },
        orderBy: { badge: { sortOrder: "asc" } },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("page.team.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {users.length} {t("team.count")} · {t("page.team.subtitle")}
        </p>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Users className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("team.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">{t("team.empty.desc")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((u) => {
            const activeProjects = u.memberships.filter(
              (m) => m.project.status === "active" || m.project.status === "on_hold"
            );
            const openTasks = u.tasksAssigned.length;
            const overdueTasks = u.tasksAssigned.filter((t) =>
              isOverdue(t.dueAt, t.status)
            ).length;

            const roleColor =
              u.role === "admin"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : u.role === "manager"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : u.role === "department_head"
                ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

            const handle = displayName(u);

            return (
              <Link
                key={u.id}
                href={`/team/${u.id}`}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-900/60"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-lg font-semibold text-zinc-200">
                      {handle[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-zinc-100">
                        {handle}
                      </div>
                      {u.jobTitle && (
                        <div className="text-[11px] text-zinc-500">
                          {u.jobTitle}
                        </div>
                      )}
                      {u.department && (
                        <div className="text-[10px] text-zinc-600">
                          {u.department}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", roleColor)}>
                    {t(`role.${u.role}`)}
                  </span>
                </div>

                <div className="mb-3 space-y-1">
                  {/* Real email is president-only — everyone else sees just the phone, if any. */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500" dir="ltr">
                      <Mail className="h-3 w-3" />
                      {u.email}
                    </div>
                  )}
                  {u.phone && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500" dir="ltr">
                      <Phone className="h-3 w-3" />
                      {u.phone}
                    </div>
                  )}
                </div>

                {u.badges.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {u.badges.map((ub) => (
                      <span
                        key={ub.badgeId}
                        className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px]"
                        style={{
                          borderColor: ub.badge.colorHex + "55",
                          backgroundColor: ub.badge.colorHex + "15",
                          color: ub.badge.colorHex,
                        }}
                      >
                        <span>{ub.badge.icon}</span>
                        <span>
                          {locale === "ar" ? ub.badge.labelAr : ub.badge.labelEn}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Workload */}
                <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
                  <StatMini label={t("team.stats.projects")} value={String(activeProjects.length)} />
                  <StatMini
                    label={t("team.stats.openTasks")}
                    value={String(openTasks)}
                    tone={openTasks > 10 ? "warn" : "default"}
                  />
                  <StatMini
                    label={t("team.stats.overdue")}
                    value={String(overdueTasks)}
                    tone={overdueTasks > 0 ? "danger" : "default"}
                  />
                </div>

                {isAdmin && u.salaryQar && (
                  <div className="mt-2 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500 tabular-nums">
                    {t("team.salary")}: {formatQar(u.salaryQar, { locale })}/
                    {locale === "ar" ? "شهر" : "mo"}
                  </div>
                )}

                {overdueTasks > 0 && (
                  <div className="mt-3 flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[10px] text-rose-400">
                    <AlertCircle className="h-3 w-3" />
                    {overdueTasks} {t("team.overdueBadge")}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-end text-[11px] text-zinc-500 opacity-0 transition group-hover:opacity-100">
                  <span className="flex items-center gap-0.5 text-emerald-400">
                    <Chevron className="h-3 w-3" />
                    {t("team.viewDetails")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatMini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-rose-400"
      : tone === "warn"
      ? "text-amber-400"
      : "text-zinc-100";
  return (
    <div className="text-center">
      <div className={cn("text-lg font-bold tabular-nums", toneClass)}>{value}</div>
      <div className="text-[9px] text-zinc-500">{label}</div>
    </div>
  );
}
```

---

## `auth.config.ts`

<a id="auth-config-ts"></a>

```ts
// Edge-safe Auth.js config used by proxy.ts (Next.js 16 middleware).
// No DB access here — better-sqlite3 is a native module and doesn't work at the edge.
//
// The full DB-backed jwt/session callbacks live in auth.ts; this file only maps
// what's already in the JWT onto req.auth.user so the proxy can do RBAC without
// a DB roundtrip.

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export default {
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.role =
          (token.role as
            | "admin"
            | "manager"
            | "department_head"
            | "employee") ?? "employee";
        session.user.active = (token.active as boolean | undefined) ?? false;
        session.user.nickname = (token.nickname as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

---

## `auth.ts`

<a id="auth-ts"></a>

```ts
// Full Auth.js config — used by API handlers, server components, and server actions.
// Phase 2: reads users from Prisma (app.db) instead of auth.db.
//
// Sign-in policy: the system is self-service.
// - Any Google account can sign in.
// - First-time sign-in auto-creates a User row with active=false, approvedAt=null,
//   role="employee". The admin then approves them from /admin/users.
// - Subsequent sign-ins always succeed; the layout gates page access for unapproved
//   or deactivated users.

import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { prisma } from "@/lib/db/prisma";
import { findUserByEmail, touchLogin } from "@/lib/db/users";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email) return false;
      const email = profile.email.trim().toLowerCase();
      let user = await findUserByEmail(email);

      if (!user) {
        // Bootstrap: the very first sign-in by ADMIN_EMAIL (when no admin exists yet)
        // auto-creates that user as an active admin. This lets a freshly deployed
        // instance be initialized without any manual DB seeding.
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const adminCount = await prisma.user.count({
          where: { role: "admin", active: true },
        });
        const shouldBeAdmin =
          !!adminEmail && email === adminEmail && adminCount === 0;

        user = await prisma.user.create({
          data: {
            email,
            name:
              (profile.name as string | undefined)?.trim() ||
              process.env.ADMIN_NAME?.trim() ||
              email.split("@")[0],
            role: shouldBeAdmin ? "admin" : "employee",
            active: shouldBeAdmin,
            approvedAt: shouldBeAdmin ? new Date() : null,
          },
        });
      }

      // Always allow sign-in to succeed — the layout will render a "pending approval"
      // gate for users whose account is not active yet. This lets the admin see them
      // in the pending queue after they've attempted to log in.
      await touchLogin(user.id);
      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const user = await findUserByEmail(token.email);
        if (user) {
          token.userId = user.id;
          token.role = user.role as
            | "admin"
            | "manager"
            | "department_head"
            | "employee";
          token.department = user.department;
          token.name = user.name;
          token.active = user.active;
          token.approved = !!user.approvedAt;
          token.nickname = user.nickname;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.role =
          (token.role as
            | "admin"
            | "manager"
            | "department_head"
            | "employee") ?? "employee";
        session.user.department = (token.department as string | null) ?? null;
        session.user.active = (token.active as boolean | undefined) ?? false;
        session.user.approved = (token.approved as boolean | undefined) ?? false;
        session.user.nickname = (token.nickname as string | null) ?? null;
      }
      return session;
    },
  },
});
```

---

## `components/nickname-gate.tsx`

<a id="components-nickname-gate-tsx"></a>

```ts
"use client";

// Full-page gate shown to active users who haven't picked a nickname yet.
// Renders instead of the normal app shell so the user can't reach any data
// (or have their email shown to teammates) before they choose a handle.

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { LogOut, UserCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "./language-switcher";
import { saveNicknameAction } from "@/app/onboarding/nickname/actions";

const NICK_RE = /^[A-Za-z0-9_-]{2,24}$/;

interface Props {
  userName: string;
}

export function NicknameGate({ userName }: Props) {
  const t = useT();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = value.trim();
    if (!NICK_RE.test(trimmed)) {
      setError(t("onboarding.nickname.invalid"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveNicknameAction(trimmed);
      if (!res.ok) {
        setError(
          res.reason === "taken"
            ? t("onboarding.nickname.taken")
            : t("onboarding.nickname.invalid")
        );
      }
      // On success the action calls revalidatePath("/") and a redirect happens;
      // we don't need to do anything client-side.
    });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
        <div className="space-y-1 border-b border-zinc-800 bg-gradient-to-b from-emerald-950/30 to-zinc-900/40 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <UserCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">
            {t("onboarding.nickname.title")}
          </h1>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-zinc-400">{t("onboarding.nickname.body")}</p>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-500">
            {userName}
          </div>

          <div>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={t("onboarding.nickname.placeholder")}
              dir="ltr"
              maxLength={24}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              autoFocus
            />
            {error && (
              <div className="mt-2 text-xs text-rose-400">{error}</div>
            )}
          </div>

          <button
            onClick={submit}
            disabled={isPending || value.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {t("onboarding.nickname.save")}
          </button>

          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-500 transition hover:border-rose-500/30 hover:text-rose-400"
          >
            <LogOut className="h-3 w-3" />
            {t("auth.signout")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## `components/sidebar.tsx`

<a id="components-sidebar-tsx"></a>

```ts
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Home,
  Briefcase,
  Users,
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
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";

type Role = "admin" | "manager" | "department_head" | "employee";

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

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof Home;
  highlight?: boolean;
  adminOnly?: boolean;
}

const nav: NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: Home },
  { href: "/projects", labelKey: "nav.projects", icon: Briefcase, highlight: true },
  { href: "/tasks", labelKey: "nav.tasks", icon: KanbanSquare, highlight: true },
  { href: "/team", labelKey: "nav.team", icon: Users },
  { href: "/meetings", labelKey: "nav.meetings", icon: Calendar, highlight: true },
  { href: "/shoots", labelKey: "nav.shoots", icon: Camera, highlight: true },
  { href: "/equipment", labelKey: "nav.equipment", icon: Package },
  { href: "/finance", labelKey: "nav.finance", icon: DollarSign },
  { href: "/reports", labelKey: "nav.reports", icon: FileText, adminOnly: true },
  { href: "/admin/users", labelKey: "nav.admin_users", icon: ShieldCheck, adminOnly: true },
  { href: "/admin/audit", labelKey: "nav.admin_audit", icon: Shield, adminOnly: true },
  { href: "/admin/backup", labelKey: "nav.admin_backup", icon: Archive, adminOnly: true },
  { href: "/admin/theme", labelKey: "nav.admin_theme", icon: Palette, adminOnly: true },
];

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
          if (item.adminOnly && userRole !== "admin") return null;
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
                  : userRole === "department_head"
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

## `components/sim-provider.tsx`

<a id="components-sim-provider-tsx"></a>

```ts
"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { csrfFetch } from "@/lib/csrf-client";
import type { ActivityEntry, Scenario, SimState } from "@/lib/sim/types";

interface SimContextValue {
  state: SimState | null;
  connected: boolean;
  setSpeed: (n: number) => void;
  pause: () => void;
  play: () => void;
  reset: () => void;
  decide: (scenarioId: string, choiceKey: string) => Promise<void>;
  spawn: (templateId: string) => Promise<{ ok: boolean; scenario?: Scenario; error?: string }>;
  action: (type: string, params?: Record<string, unknown>) => Promise<{ ok: boolean; message: string }>;
}

const SimContext = createContext<SimContextValue | null>(null);

export function useSim(): SimContextValue {
  const v = useContext(SimContext);
  if (!v) throw new Error("useSim must be used inside <SimProvider>");
  return v;
}

export function SimProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SimState | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/sim/stream");
    esRef.current = es;

    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as SimState;
        setState(data);
        setConnected(true);
      } catch {}
    });

    es.addEventListener("activity", (e) => {
      try {
        const entry = JSON.parse((e as MessageEvent).data) as ActivityEntry;
        setState((prev) => {
          if (!prev) return prev;
          const exists = prev.activityLog.some((a) => a.id === entry.id);
          if (exists) return prev;
          return {
            ...prev,
            activityLog: [entry, ...prev.activityLog].slice(0, 150),
          };
        });
      } catch {}
    });

    es.onerror = () => setConnected(false);
    es.onopen = () => setConnected(true);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  const control = async (action: string, value?: number) => {
    try {
      await csrfFetch("/api/sim/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value }),
      });
    } catch {}
  };

  const decide = async (scenarioId: string, choiceKey: string) => {
    try {
      await csrfFetch("/api/sim/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, choiceKey }),
      });
    } catch {}
  };

  const spawn = async (
    templateId: string
  ): Promise<{ ok: boolean; scenario?: Scenario; error?: string }> => {
    try {
      const res = await csrfFetch("/api/sim/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      return (await res.json()) as { ok: boolean; scenario?: Scenario; error?: string };
    } catch {
      return { ok: false, error: "فشل الاتصال" };
    }
  };

  const action = async (
    type: string,
    params?: Record<string, unknown>
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await csrfFetch("/api/sim/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, params }),
      });
      return (await res.json()) as { ok: boolean; message: string };
    } catch {
      return { ok: false, message: "فشل الاتصال" };
    }
  };

  return (
    <SimContext.Provider
      value={{
        state,
        connected,
        setSpeed: (n) => control("speed", n),
        pause: () => control("pause"),
        play: () => control("play"),
        reset: () => control("reset"),
        decide,
        spawn,
        action,
      }}
    >
      {children}
    </SimContext.Provider>
  );
}
```

---

## `components/tasks/new-task-button.tsx`

<a id="components-tasks-new-task-button-tsx"></a>

```ts
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createTaskAction } from "@/app/tasks/actions";
import { displayName } from "@/lib/display";
import { useLocale, useT } from "@/lib/i18n/client";
import { SmartAssigneeSuggestions } from "./smart-assignee-suggestions";
import { BadgePicker, type BadgeOption } from "./badge-picker";

interface User {
  id: string;
  name: string;
  nickname: string | null;
}
interface ProjectLite {
  id: string;
  title: string;
}

interface Props {
  users: User[];
  projects?: ProjectLite[];
  badges?: BadgeOption[];
  defaultProjectId?: string;
  label?: string;
}

export function NewTaskButton({
  users,
  projects,
  badges = [],
  defaultProjectId,
  label,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Controlled state for the fields the suggestions engine reads.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [requiredBadgeSlugs, setRequiredBadgeSlugs] = useState<string[]>([]);
  const [autoDetectedSlugs, setAutoDetectedSlugs] = useState<string[]>([]);

  // Reset form state whenever the modal closes/reopens.
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setProjectId(defaultProjectId ?? "");
      setAssigneeId("");
      setRequiredBadgeSlugs([]);
      setAutoDetectedSlugs([]);
      setError(null);
    }
  }, [open, defaultProjectId]);

  const onSubmit = (formData: FormData) => {
    setError(null);
    if (defaultProjectId && !formData.get("projectId")) {
      formData.set("projectId", defaultProjectId);
    }
    startTransition(async () => {
      const res = await createTaskAction(formData);
      if (res.ok) {
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
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
        {label ?? t("action.newTask")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("action.newTask")}</h3>
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
              <Field label={t("tasks.field.titleRequired")} full>
                <input
                  name="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("tasks.field.titlePlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              {badges.length > 0 && (
                <div className="sm:col-span-2">
                  <BadgePicker
                    badges={badges}
                    selectedSlugs={requiredBadgeSlugs}
                    onChange={setRequiredBadgeSlugs}
                    autoDetectedSlugs={autoDetectedSlugs}
                    locale={locale}
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <SmartAssigneeSuggestions
                  title={title}
                  description={description}
                  projectId={projectId || undefined}
                  requiredBadgeSlugs={requiredBadgeSlugs}
                  selectedAssigneeId={assigneeId}
                  onPick={(id) => setAssigneeId(id)}
                  onInferredBadges={setAutoDetectedSlugs}
                  locale={locale}
                />
              </div>

              {!defaultProjectId && projects && (
                <Field label={t("tasks.field.project")}>
                  <select
                    name="projectId"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                  >
                    <option value="">{t("tasks.noProject")}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label={t("tasks.field.assignee")}>
                <select
                  name="assigneeId"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">{t("tasks.unassigned")}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {displayName(u)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("tasks.field.priority")}>
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

              <Field label={t("tasks.field.status")}>
                <select
                  name="status"
                  defaultValue="todo"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="todo">{t("taskStatus.todo")}</option>
                  <option value="in_progress">
                    {t("taskStatus.in_progress")}
                  </option>
                  <option value="in_review">{t("taskStatus.in_review")}</option>
                  <option value="done">{t("taskStatus.done")}</option>
                </select>
              </Field>

              <Field label={t("tasks.field.due")}>
                <input
                  name="dueAt"
                  type="date"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <Field label={t("tasks.field.estimated")}>
                <input
                  name="estimatedHours"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder={t("tasks.field.hoursPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <Field label={t("tasks.field.description")} full>
                <textarea
                  name="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("tasks.field.descPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
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
                  {isPending ? t("action.creating") : t("tasks.create")}
                </button>
              </div>
            </form>
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

## `components/tasks/smart-assignee-suggestions.tsx`

<a id="components-tasks-smart-assignee-suggestions-tsx"></a>

```ts
"use client";

// Smart assignee suggestions — rendered inside the new-task modal.
// Watches { title, description, projectId, requiredBadgeSlugs } and asks the
// API who best fits. User can click a suggestion card to one-tap-assign.

import { useEffect, useRef, useState } from "react";
import { Sparkles, CheckCircle2, Briefcase, Users, Clock, Award, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { csrfFetch } from "@/lib/csrf-client";
import { displayName } from "@/lib/display";
import { translate, type Locale } from "@/lib/i18n/dict";

interface SuggestionReason {
  kind: "badge" | "free" | "topic" | "project" | "track_record" | "department";
  ar: string;
  en: string;
}

interface SuggestionBadge {
  slug: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  colorHex: string;
  matched: boolean;
}

interface AssigneeSuggestion {
  user: {
    id: string;
    nickname: string | null;
    name: string;
    jobTitle: string | null;
    department: string | null;
    role: string;
  };
  badges: SuggestionBadge[];
  score: number;
  reasons: SuggestionReason[];
  openTaskCount: number;
  completionRate: number | null;
  topicMatchCount: number;
  isProjectMember: boolean;
}

interface SuggestionsResponse {
  suggestions: AssigneeSuggestion[];
  inferredBadgeSlugs: string[];
  filteredByBadge: boolean;
}

const REASON_ICONS: Record<SuggestionReason["kind"], LucideIcon> = {
  badge: Award,
  free: Clock,
  topic: Sparkles,
  project: Briefcase,
  track_record: Award,
  department: Users,
};

const DEBOUNCE_MS = 350;

export function SmartAssigneeSuggestions({
  title,
  description,
  projectId,
  requiredBadgeSlugs,
  selectedAssigneeId,
  onPick,
  onInferredBadges,
  locale,
}: {
  title: string;
  description?: string;
  projectId?: string;
  requiredBadgeSlugs?: string[];
  selectedAssigneeId?: string;
  onPick: (userId: string) => void;
  /** Bubble auto-detected badges back so the BadgePicker can highlight them. */
  onInferredBadges?: (slugs: string[]) => void;
  locale: Locale;
}) {
  const t = (k: string) => translate(k, locale);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [err, setErr] = useState(false);
  const lastRequestRef = useRef(0);

  const reqBadges = requiredBadgeSlugs ?? [];
  const reqBadgesKey = reqBadges.slice().sort().join(",");

  useEffect(() => {
    const trimmed = title.trim();
    if (trimmed.length < 2 && reqBadges.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }

    const myReq = ++lastRequestRef.current;
    setLoading(true);

    const handle = setTimeout(async () => {
      try {
        const res = await csrfFetch("/api/tasks/suggest-assignees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmed,
            description: description ?? null,
            projectId: projectId ?? null,
            requiredBadgeSlugs: reqBadges,
            limit: 5,
          }),
        });
        if (!res.ok) {
          if (myReq === lastRequestRef.current) {
            setErr(true);
            setData(null);
          }
          return;
        }
        const json = (await res.json()) as SuggestionsResponse;
        if (myReq === lastRequestRef.current) {
          setData(json);
          setErr(false);
          // Bubble auto-detected badges back when no explicit picks were sent.
          if (reqBadges.length === 0 && onInferredBadges) {
            onInferredBadges(json.inferredBadgeSlugs);
          }
        }
      } catch {
        if (myReq === lastRequestRef.current) {
          setErr(true);
          setData(null);
        }
      } finally {
        if (myReq === lastRequestRef.current) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, projectId, reqBadgesKey]);

  // Empty-state hint — only when there's literally nothing to act on.
  if (title.trim().length < 2 && reqBadges.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 p-3 text-center">
        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-600">
          <Sparkles className="h-3 w-3" />
          {t("tasks.suggest.hint")}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center text-[11px] text-zinc-500">
        {t("tasks.suggest.error")}
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <Sparkles className="h-3 w-3 animate-pulse text-emerald-400" />
          {t("tasks.suggest.thinking")}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { suggestions, filteredByBadge } = data;

  if (suggestions.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-300">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {filteredByBadge
            ? t("tasks.suggest.noMatchBadge")
            : t("tasks.suggest.noMatch")}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400">
        <Sparkles className="h-3 w-3" />
        {t("tasks.suggest.title")}
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s, idx) => (
          <SuggestionCard
            key={s.user.id}
            suggestion={s}
            rank={idx + 1}
            isPicked={selectedAssigneeId === s.user.id}
            onPick={() => onPick(s.user.id)}
            locale={locale}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  rank,
  isPicked,
  onPick,
  locale,
  t,
}: {
  suggestion: AssigneeSuggestion;
  rank: number;
  isPicked: boolean;
  onPick: () => void;
  locale: Locale;
  t: (k: string) => string;
}) {
  const { user, score, reasons, badges } = suggestion;
  const handle = displayName(user);
  const initials = handle
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const fitPct = Math.round(score * 100);
  const tone =
    rank === 1
      ? "border-emerald-500/40 bg-emerald-500/5"
      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700";

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-2.5 text-start transition",
        tone,
        isPicked && "ring-2 ring-emerald-500"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          rank === 1
            ? "bg-emerald-500/20 text-emerald-300"
            : "bg-zinc-800 text-zinc-300"
        )}
      >
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-100">
            {handle}
          </span>
          {rank === 1 && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
              {t("tasks.suggest.bestFit")}
            </span>
          )}
          {isPicked && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
        </div>

        {badges.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {badges.slice(0, 4).map((b) => (
              <span
                key={b.slug}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px]",
                  b.matched && "ring-1 ring-emerald-400"
                )}
                style={{
                  borderColor: b.colorHex + "55",
                  backgroundColor: b.colorHex + "15",
                  color: b.colorHex,
                }}
              >
                <span>{b.icon}</span>
                <span>{locale === "ar" ? b.labelAr : b.labelEn}</span>
              </span>
            ))}
          </div>
        )}

        {(user.jobTitle || user.department) && (
          <div className="mt-0.5 text-[10px] text-zinc-500">
            {[user.jobTitle, user.department].filter(Boolean).join(" · ")}
          </div>
        )}
        <ul className="mt-1.5 space-y-0.5">
          {reasons.slice(0, 3).map((r, i) => {
            const Icon = REASON_ICONS[r.kind];
            return (
              <li key={i} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <Icon className="h-2.5 w-2.5 shrink-0 text-zinc-500" />
                <span className="truncate">{locale === "ar" ? r.ar : r.en}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="shrink-0 text-end">
        <div
          className={cn(
            "text-base font-bold tabular-nums",
            fitPct >= 70
              ? "text-emerald-400"
              : fitPct >= 40
                ? "text-amber-400"
                : "text-zinc-500"
          )}
        >
          {fitPct}%
        </div>
        <div className="text-[9px] text-zinc-600">{t("tasks.suggest.fit")}</div>
      </div>
    </button>
  );
}
```

---

## `components/tasks/task-detail-modal.tsx`

<a id="components-tasks-task-detail-modal-tsx"></a>

```ts
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, UserIcon, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { deleteTaskAction, updateTaskAction } from "@/app/tasks/actions";
import { isOverdue } from "@/lib/db/helpers";
import { displayName } from "@/lib/display";
import { useT } from "@/lib/i18n/client";

const TASK_STATUSES = ["todo", "in_progress", "in_review", "done", "blocked"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: Date | null;
  estimatedHours: number | null;
  assignee: { id: string; name: string } | null;
  collaborators?: { user: { id: string; name: string } }[];
  project: { id: string; title: string } | null;
}

export interface UserLite {
  id: string;
  name: string;
  nickname: string | null;
}

export interface ProjectLite {
  id: string;
  title: string;
}

interface Props {
  task: TaskDetail;
  users: UserLite[];
  projects?: ProjectLite[];
  allowProjectChange?: boolean;
  onClose: () => void;
}

export function TaskDetailModal({
  task,
  users,
  projects,
  allowProjectChange,
  onClose,
}: Props) {
  const router = useRouter();
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState<string>(
    task.assignee?.id ?? ""
  );
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(
    (task.collaborators ?? []).map((c) => c.user.id)
  );
  const [showCollaboratorPicker, setShowCollaboratorPicker] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const overdue = isOverdue(task.dueAt, task.status);
  const dueAtStr = task.dueAt
    ? new Date(task.dueAt).toISOString().slice(0, 10)
    : "";

  const onSubmit = (formData: FormData) => {
    setError(null);
    // Add collaborators as CSV
    formData.set(
      "collaboratorIds",
      collaboratorIds.filter((id) => id !== primaryAssigneeId).join(",")
    );
    formData.set("assigneeId", primaryAssigneeId);
    startTransition(async () => {
      const res = await updateTaskAction(task.id, formData);
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.message ?? t("common.error"));
      }
    });
  };

  const onDelete = () => {
    if (!confirm(t("tasks.deleteConfirm"))) return;
    startTransition(async () => {
      await deleteTaskAction(task.id);
      router.refresh();
      onClose();
    });
  };

  const addCollaborator = (userId: string) => {
    if (userId === primaryAssigneeId) return;
    setCollaboratorIds((prev) =>
      prev.includes(userId) ? prev : [...prev, userId]
    );
    setShowCollaboratorPicker(false);
  };

  const removeCollaborator = (userId: string) => {
    setCollaboratorIds((prev) => prev.filter((id) => id !== userId));
  };

  const collaboratorUsers = collaboratorIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is UserLite => !!u);

  const addable = users.filter(
    (u) => u.id !== primaryAssigneeId && !collaboratorIds.includes(u.id)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-[5vh]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
              {t("tasks.edit")}
            </div>
            <h3 className="text-lg font-bold text-zinc-100">{task.title}</h3>
            {task.project && (
              <div className="mt-1 text-xs text-sky-400">
                📁 {task.project.title}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {overdue && (
          <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-400">
            {t("tasks.overdueBanner")}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
            {error}
          </div>
        )}

        <form action={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("tasks.field.title")} full>
            <input
              name="title"
              defaultValue={task.title}
              required
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>

          <Field label={t("tasks.field.status")}>
            <select
              name="status"
              defaultValue={task.status}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            >
              {TASK_STATUSES.map((k) => (
                <option key={k} value={k}>
                  {t(`taskStatus.${k}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("tasks.field.priority")}>
            <select
              name="priority"
              defaultValue={task.priority}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            >
              {PRIORITIES.map((k) => (
                <option key={k} value={k}>
                  {t(`priority.${k}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("tasks.field.due")}>
            <input
              name="dueAt"
              type="date"
              defaultValue={dueAtStr}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>

          <Field label={t("tasks.field.estimated")}>
            <input
              name="estimatedHours"
              type="number"
              step="0.5"
              min="0"
              defaultValue={task.estimatedHours ?? ""}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>

          {allowProjectChange && projects && (
            <Field label={t("tasks.field.project")} full>
              <select
                name="projectId"
                defaultValue={task.project?.id ?? ""}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              >
                <option value="">{t("tasks.noProject")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label={t("tasks.field.assigneePrimary")} full>
            <select
              value={primaryAssigneeId}
              onChange={(e) => {
                setPrimaryAssigneeId(e.target.value);
                setCollaboratorIds((prev) =>
                  prev.filter((id) => id !== e.target.value)
                );
              }}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            >
              <option value="">{t("tasks.unassigned")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Collaborators */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs text-zinc-500">
              {t("tasks.field.collaborators")}
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 p-2 min-h-[44px]">
              {collaboratorUsers.length === 0 && !showCollaboratorPicker && (
                <span className="text-xs text-zinc-600">
                  {t("tasks.collaborators.empty")}
                </span>
              )}
              {collaboratorUsers.map((u) => (
                <span
                  key={u.id}
                  className="flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300"
                >
                  <UserIcon className="h-3 w-3" />
                  {u.name}
                  <button
                    type="button"
                    onClick={() => removeCollaborator(u.id)}
                    className="ml-1 text-sky-400 hover:text-rose-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {addable.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCollaboratorPicker((v) => !v)}
                    className="flex items-center gap-1 rounded-full border border-dashed border-zinc-600 px-2 py-0.5 text-xs text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-400"
                  >
                    <UserPlus className="h-3 w-3" />
                    {t("tasks.collaborators.add")}
                  </button>
                  {showCollaboratorPicker && (
                    <div className="absolute right-0 top-full z-10 mt-1 max-h-56 w-56 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                      {addable.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => addCollaborator(u.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-right text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                          <UserIcon className="h-3 w-3" />
                          <span className="flex-1">{displayName(u)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-1 text-[10px] text-zinc-600">
              {t("tasks.collaborators.hint")}
            </div>
          </div>

          <Field label={t("tasks.field.description")} full>
            <textarea
              name="description"
              rows={3}
              defaultValue={task.description ?? ""}
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>

          <div className="flex items-center justify-between pt-2 sm:col-span-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-rose-500/15 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("tasks.delete")}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                {t("action.cancel")}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" />
                {isPending ? t("action.saving") : t("action.save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
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

## `lib/auth-guards.ts`

<a id="lib-auth-guards-ts"></a>

```ts
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
```

---

## `lib/csrf-client.ts`

<a id="lib-csrf-client-ts"></a>

```ts
// Client-side CSRF helper. Reads the `csrf-token` cookie (set by proxy.ts) and
// attaches it as `x-csrf-token` on state-changing fetches. Wrap every mutating
// fetch from a "use client" component with `csrfFetch` — it's a drop-in for fetch.

import { CSRF_COOKIE, CSRF_HEADER } from "./csrf";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = name + "=";
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

export function csrfHeader(): Record<string, string> {
  const token = readCookie(CSRF_COOKIE);
  return token ? { [CSRF_HEADER]: token } : {};
}

export function csrfFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (SAFE_METHODS.has(method)) return fetch(input, init);

  const headers = new Headers(init.headers);
  const token = readCookie(CSRF_COOKIE);
  if (token && !headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, token);
  return fetch(input, { ...init, headers });
}
```

---

## `lib/csrf.ts`

<a id="lib-csrf-ts"></a>

```ts
// CSRF — double-submit cookie pattern.
// proxy.ts issues a `csrf-token` cookie on every authed response, and rejects
// state-changing /api/* requests whose `x-csrf-token` header doesn't match the
// cookie. Web-Crypto only — runs in the edge runtime.

export const CSRF_COOKIE = "csrf-token";
export const CSRF_HEADER = "x-csrf-token";

// 32 random bytes hex-encoded → 64-char token. Edge-safe (no Node crypto).
export function generateCsrfToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string compare to avoid leaking the token via timing.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

---

## `lib/db/users.ts`

<a id="lib-db-users-ts"></a>

```ts
// Prisma-backed User functions. Replaces lib/auth/users.ts going forward.
// The Auth.js callbacks still use lib/auth/users.ts (better-sqlite3) for now —
// we'll migrate that in the next pass. For now, Prisma is the truth for the app.

import { prisma } from "./prisma";
import type { User } from "@prisma/client";

export type { User };

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

export async function listUsers(options?: {
  activeOnly?: boolean;
  department?: string;
}): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      ...(options?.activeOnly ? { active: true } : {}),
      ...(options?.department ? { department: options.department } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Same as listUsers but eagerly loads each user's badges. Used by the admin
 * page (to render badge chips) and the team profile (to display them).
 */
export async function listUsersWithBadges(options?: {
  activeOnly?: boolean;
  department?: string;
}) {
  return prisma.user.findMany({
    where: {
      ...(options?.activeOnly ? { active: true } : {}),
      ...(options?.department ? { department: options.department } : {}),
    },
    include: {
      badges: {
        include: { badge: true },
        orderBy: { badge: { sortOrder: "asc" } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createUser(input: {
  email: string;
  name: string;
  role: "admin" | "manager" | "department_head" | "employee";
  department?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  salaryQar?: number | null;
  hiredAt?: Date | null;
  nickname?: string | null;
}): Promise<User> {
  return prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: input.role,
      department: input.department ?? null,
      jobTitle: input.jobTitle ?? null,
      phone: input.phone ?? null,
      salaryQar: input.salaryQar ?? null,
      hiredAt: input.hiredAt ?? null,
      nickname: input.nickname ?? null,
    },
  });
}

export async function updateUser(
  id: string,
  patch: Partial<
    Pick<
      User,
      | "name"
      | "nickname"
      | "role"
      | "department"
      | "active"
      | "jobTitle"
      | "phone"
      | "salaryQar"
      | "hiredAt"
      | "avatarUrl"
    >
  >
): Promise<User> {
  return prisma.user.update({ where: { id }, data: patch });
}

export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}

export async function touchLogin(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}
```

---

## `lib/display.ts`

<a id="lib-display-ts"></a>

```ts
// Privacy-aware display helpers.
//
// Rule of thumb across the app:
//   - Show NICKNAME when set, falling back to NAME, never an email.
//   - Real emails are visible only to the president (role=admin).
//   - Everyone else sees a masked "a***@gmail.com" or just nothing.

export type RoleLike = "admin" | "manager" | "department_head" | "employee";

interface UserLike {
  nickname?: string | null;
  name: string;
  email?: string | null;
}

// What to show in lists, mentions, assignee pickers, sidebar.
// Always prefers the chosen nickname so users don't leak real names either.
export function displayName(u: UserLike): string {
  const nick = u.nickname?.trim();
  if (nick) return nick;
  return u.name;
}

// "ahmed.ali@gmail.com" → "a***@gmail.com"
// "x@gmail.com"          → "x***@gmail.com"
// Returns "" for falsy input so it's safe to drop into JSX.
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

// Email shown to the viewer. President sees the raw address; everyone else
// sees the mask (or nothing if `hideForOthers` is true).
export function visibleEmail(
  email: string | null | undefined,
  viewerRole: RoleLike | null | undefined,
  options: { hideForOthers?: boolean } = {}
): string {
  if (!email) return "";
  if (viewerRole === "admin") return email;
  if (options.hideForOthers) return "";
  return maskEmail(email);
}
```

---

## `lib/i18n/dict.ts`

<a id="lib-i18n-dict-ts"></a>

```ts
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

  // Roles — admin is the president (top of the hierarchy).
  "role.admin": { ar: "الرئيس", en: "President" },
  "role.manager": { ar: "المدير", en: "Manager" },
  "role.department_head": { ar: "رئيس قسم", en: "Department head" },
  "role.employee": { ar: "موظف", en: "Employee" },

  // Onboarding — nickname picker shown right after sign-in approval.
  "onboarding.nickname.title": { ar: "اختر اسم مستعار", en: "Pick a nickname" },
  "onboarding.nickname.body": {
    ar: "بيظهر هذا الاسم لزملائك بدل إيميلك. خلّيه قصير وواضح.",
    en: "This name shows to your teammates instead of your email. Keep it short and clear.",
  },
  "onboarding.nickname.placeholder": { ar: "مثال: hadi", en: "e.g. hadi" },
  "onboarding.nickname.save": { ar: "حفظ ومتابعة", en: "Save and continue" },
  "onboarding.nickname.taken": {
    ar: "هذا الاسم مستخدم. اختر غيره.",
    en: "That nickname is taken. Pick another.",
  },
  "onboarding.nickname.invalid": {
    ar: "الاسم بين 2 و 24 حرف، حروف وأرقام و _ - فقط.",
    en: "Nickname must be 2–24 chars: letters, digits, _ and -.",
  },

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
  "role.labelAdmin": { ar: "الرئيس", en: "President" },
  "role.labelManager": { ar: "المدير", en: "Manager" },
  "role.labelDepartmentHead": { ar: "رئيس قسم", en: "Department head" },
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
  "admin.users.roleOptAdmin": { ar: "مدير — يشوف كل شي", en: "Admin — sees everything" },
  "admin.users.roleOptManager": { ar: "رئيس قسم — قسمه فقط", en: "Manager — their dept only" },
  "admin.users.roleOptEmployee": { ar: "موظف — مهامه فقط", en: "Employee — own tasks only" },
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

  // Misc
  "brand.internal": { ar: "داخلي", en: "Internal" },
  "time.today": { ar: "اليوم", en: "Today" },
  "time.yesterday": { ar: "أمس", en: "Yesterday" },
  "time.days": { ar: "{n} يوم", en: "{n} day(s)" },
};

/** Translate a key into a given locale. Falls back to English if key missing. */
export function translate(key: string, locale: Locale): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en ?? key;
}
```

---

## `lib/rate-limit.ts`

<a id="lib-rate-limit-ts"></a>

```ts
// In-memory token-bucket rate limiter.
//
// Keyed by an arbitrary string (we use IP for unauth, userId for authed). Stores
// per-key bucket state on globalThis so HMR doesn't reset counters during dev.
// Cheap, fixed-window — enough to slow down brute-force / scraping; not a
// substitute for a real WAF on a public endpoint.

const STORE_KEY = "__srb_rate_limit_buckets__" as const;

interface Bucket {
  count: number;
  // Wall-clock ms when the current window opened.
  windowStartedAt: number;
}

type Store = Map<string, Bucket>;

function getStore(): Store {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, Bucket>();
  return g[STORE_KEY] as Store;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

// `windowMs` is the window length; `max` is the cap inside that window.
export function rateLimit(
  key: string,
  options: { windowMs: number; max: number }
): RateLimitResult {
  const store = getStore();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now - existing.windowStartedAt >= options.windowMs) {
    store.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, remaining: options.max - 1, retryAfterMs: 0 };
  }

  if (existing.count >= options.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: options.windowMs - (now - existing.windowStartedAt),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: options.max - existing.count,
    retryAfterMs: 0,
  };
}
```

---

## `lib/tasks/suggest-assignees.ts`

<a id="lib-tasks-suggest-assignees-ts"></a>

```ts
// Smart assignee suggestion engine — v2 (badge-aware).
//
// When a manager creates a task they can either:
//   (a) explicitly pick required badges (e.g. "صور" + "ديزاينر"), or
//   (b) just type a title — we detect the badges automatically from keywords.
//
// Either way, candidates are scored on four signals:
//
//   1. Badge match (50%)        — % of required badges the user holds.
//                                  When badges are in play this dominates;
//                                  no badge match = filtered out entirely.
//   2. Workload (25%)           — fewer open tasks = more available
//   3. Project membership (15%) — already on the project gets a boost
//   4. Track record (10%)       — % of recent tasks completed
//
// If neither user-picked nor auto-detected badges exist, we fall back to
// the old text-similarity scoring so the suggester still works for one-off
// "buy office supplies" type tasks.

import { prisma } from "@/lib/db/prisma";
import { detectBadgesFromText } from "@/lib/db/badges";

const MAX_PAST_TASKS_PER_USER = 50;
const MAX_OPEN_TASKS_FLOOR = 3;

export interface AssigneeSuggestion {
  user: {
    id: string;
    name: string;
    nickname: string | null;
    jobTitle: string | null;
    department: string | null;
    role: string;
  };
  /** Skill badges the user holds — exposed so the UI can render chips. */
  badges: Array<{
    slug: string;
    labelAr: string;
    labelEn: string;
    icon: string;
    colorHex: string;
    matched: boolean;
  }>;
  score: number; // 0..1
  reasons: SuggestionReason[];
  openTaskCount: number;
  completionRate: number | null;
  topicMatchCount: number;
  isProjectMember: boolean;
}

export interface SuggestionReason {
  kind: "badge" | "free" | "topic" | "project" | "track_record" | "department";
  ar: string;
  en: string;
}

export async function suggestAssignees(opts: {
  title: string;
  description?: string | null;
  projectId?: string | null;
  /** Slugs of badges the manager explicitly required. */
  requiredBadgeSlugs?: string[];
  limit?: number;
}): Promise<{
  suggestions: AssigneeSuggestion[];
  /** Badges we either auto-detected (no explicit picks) or echoed back from the request. */
  inferredBadgeSlugs: string[];
  /** True iff we actually filtered out users who had no matching badge. */
  filteredByBadge: boolean;
}> {
  const { title, description, projectId } = opts;
  const limit = opts.limit ?? 3;
  const explicitBadges = (opts.requiredBadgeSlugs ?? []).filter(Boolean);

  // Auto-detect when the user didn't pick any. Detected badges hint the
  // ranking but don't filter anyone out — we want to surface alternatives.
  const detected = explicitBadges.length === 0
    ? detectBadgesFromText(`${title} ${description ?? ""}`)
    : [];
  const inferredBadgeSlugs = explicitBadges.length > 0 ? explicitBadges : detected;
  const isExplicit = explicitBadges.length > 0;

  // Pull every active employee with their badges in one shot.
  const users = await prisma.user.findMany({
    where: { active: true, approvedAt: { not: null } },
    select: {
      id: true,
      name: true,
      nickname: true,
      role: true,
      jobTitle: true,
      department: true,
      badges: {
        include: { badge: true },
      },
    },
  });

  if (users.length === 0) {
    return { suggestions: [], inferredBadgeSlugs, filteredByBadge: false };
  }

  const userIds = users.map((u) => u.id);
  const [openCounts, recentTasks, projectMembers, project] = await Promise.all([
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: userIds },
        status: { in: ["todo", "in_progress", "in_review"] },
      },
      _count: { _all: true },
    }),
    prisma.task.findMany({
      where: { assigneeId: { in: userIds } },
      orderBy: { updatedAt: "desc" },
      take: MAX_PAST_TASKS_PER_USER * userIds.length,
      select: {
        assigneeId: true,
        title: true,
        status: true,
        completedAt: true,
      },
    }),
    projectId
      ? prisma.projectMember.findMany({
          where: { projectId, userId: { in: userIds } },
          select: { userId: true, role: true },
        })
      : Promise.resolve([] as { userId: string; role: string | null }[]),
    projectId
      ? prisma.project.findUnique({
          where: { id: projectId },
          select: { type: true, title: true, description: true },
        })
      : Promise.resolve(null),
  ]);

  const openByUser = new Map<string, number>();
  for (const row of openCounts) {
    if (row.assigneeId) openByUser.set(row.assigneeId, row._count._all);
  }
  const tasksByUser = new Map<
    string,
    Array<{ title: string; status: string; completedAt: Date | null }>
  >();
  for (const t of recentTasks) {
    if (!t.assigneeId) continue;
    const arr = tasksByUser.get(t.assigneeId) ?? [];
    if (arr.length < MAX_PAST_TASKS_PER_USER) {
      arr.push({ title: t.title, status: t.status, completedAt: t.completedAt });
      tasksByUser.set(t.assigneeId, arr);
    }
  }
  const projectMemberIds = new Set(projectMembers.map((m) => m.userId));

  const newKeywords = tokenize(`${title} ${description ?? ""} ${project?.title ?? ""}`);

  let maxOpen = MAX_OPEN_TASKS_FLOOR;
  for (const c of openByUser.values()) {
    if (c > maxOpen) maxOpen = c;
  }

  // Eligibility filter: when the manager explicitly required badges, hide
  // anyone who has zero of them. With auto-detected badges we keep everyone
  // (the badge match still boosts ranking).
  const filteredByBadge = isExplicit && inferredBadgeSlugs.length > 0;

  const requiredSet = new Set(inferredBadgeSlugs);

  const candidates: AssigneeSuggestion[] = [];
  for (const user of users) {
    const userBadgeSlugs = new Set(user.badges.map((ub) => ub.badge.slug));
    const matchedBadges = inferredBadgeSlugs.filter((slug) => userBadgeSlugs.has(slug));

    if (filteredByBadge && matchedBadges.length === 0) continue;

    const open = openByUser.get(user.id) ?? 0;
    const past = tasksByUser.get(user.id) ?? [];

    const workloadScore = 1 - open / maxOpen;

    // Badge match score — fraction of required badges the user holds.
    const badgeScore =
      inferredBadgeSlugs.length > 0
        ? matchedBadges.length / inferredBadgeSlugs.length
        : 0;

    // Topic similarity from past task titles — used as fallback signal when
    // there are no badges in play, and as a tiny bonus otherwise.
    let topicMatchCount = 0;
    for (const p of past) {
      if (hasOverlap(newKeywords, tokenize(p.title))) topicMatchCount++;
    }
    const topicScore = Math.min(topicMatchCount / 5, 1);

    const projectBonus = projectMemberIds.has(user.id) ? 1 : 0;

    const finished = past.filter((t) => t.status === "done").length;
    const trackRecordRate = past.length >= 3 ? finished / past.length : null;
    const trackRecordScore = trackRecordRate ?? 0.5;

    let score: number;
    if (inferredBadgeSlugs.length > 0) {
      // Badge-driven mode: badges dominate.
      score =
        badgeScore * 0.5 +
        workloadScore * 0.25 +
        projectBonus * 0.15 +
        trackRecordScore * 0.1;
    } else {
      // Free-text mode: fall back to text similarity (old algorithm).
      score =
        workloadScore * 0.4 +
        topicScore * 0.3 +
        projectBonus * 0.2 +
        trackRecordScore * 0.1;
    }

    candidates.push({
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        jobTitle: user.jobTitle,
        department: user.department,
        role: user.role,
      },
      badges: user.badges.map((ub) => ({
        slug: ub.badge.slug,
        labelAr: ub.badge.labelAr,
        labelEn: ub.badge.labelEn,
        icon: ub.badge.icon,
        colorHex: ub.badge.colorHex,
        matched: requiredSet.has(ub.badge.slug),
      })),
      score,
      reasons: buildReasons({
        matchedBadges,
        userBadgesAr: user.badges.map((ub) => ub.badge.labelAr),
        open,
        topicMatchCount,
        isProjectMember: projectBonus > 0,
        completionRate: trackRecordRate,
      }),
      openTaskCount: open,
      completionRate: trackRecordRate,
      topicMatchCount,
      isProjectMember: projectBonus > 0,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return {
    suggestions: candidates.slice(0, limit),
    inferredBadgeSlugs,
    filteredByBadge,
  };
}

function tokenize(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, " ")
    .trim();
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

function hasOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const word of a) {
    if (b.has(word)) return true;
  }
  return false;
}

const STOP_WORDS = new Set([
  "في","من","إلى","على","هذا","هذه","ذلك","تلك","التي","الذي","كان","يكون","هل","ما","لا","نعم","مع","عن","بعد","قبل","خلال","أو","ثم","لكن","كل","بعض","جدا","اي","وش","شنو",
  "the","and","for","with","that","this","these","those","from","into","about","have","has","had","will","would","should","could","can","may","any","all","some","new",
]);

function buildReasons(input: {
  matchedBadges: string[];
  userBadgesAr: string[];
  open: number;
  topicMatchCount: number;
  isProjectMember: boolean;
  completionRate: number | null;
}): SuggestionReason[] {
  const reasons: SuggestionReason[] = [];

  if (input.matchedBadges.length > 0) {
    const labels = input.userBadgesAr.slice(0, 2).join(" + ");
    reasons.push({
      kind: "badge",
      ar: `يحمل شارة: ${labels}`,
      en: `Has badge: ${labels}`,
    });
  }

  if (input.isProjectMember) {
    reasons.push({
      kind: "project",
      ar: "عضو في نفس المشروع",
      en: "Already on this project",
    });
  }

  if (input.open === 0) {
    reasons.push({
      kind: "free",
      ar: "متفرّغ تماماً — ما عنده مهام مفتوحة",
      en: "Fully free — no open tasks",
    });
  } else if (input.open <= 2) {
    reasons.push({
      kind: "free",
      ar: `خفيف الجدول — ${input.open} مهام بس`,
      en: `Light load — only ${input.open} task${input.open === 1 ? "" : "s"}`,
    });
  }

  if (input.topicMatchCount > 0) {
    const word = input.topicMatchCount === 1 ? "مهمة مشابهة" : "مهام مشابهة";
    reasons.push({
      kind: "topic",
      ar: `سوّى ${input.topicMatchCount} ${word} قبل`,
      en: `Did ${input.topicMatchCount} similar task${input.topicMatchCount === 1 ? "" : "s"} before`,
    });
  }

  if (input.completionRate !== null && input.completionRate >= 0.8) {
    const pct = Math.round(input.completionRate * 100);
    reasons.push({
      kind: "track_record",
      ar: `نسبة إنجاز عالية: ${pct}%`,
      en: `Strong track record: ${pct}%`,
    });
  }

  return reasons;
}
```

---

## `next.config.ts`

<a id="next-config-ts"></a>

```ts
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP — strict by default; relaxes only what Next.js / Tailwind / Google fonts
// genuinely need. 'unsafe-inline' on style-src covers Next's inline <style> tags
// and Tailwind's runtime utilities. 'unsafe-eval' is dev-only for HMR.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Allow requests through the Cloudflare quick tunnel in dev.
  // Tunnels give random *.trycloudflare.com subdomains, so we whitelist the whole suffix.
  allowedDevOrigins: ["*.trycloudflare.com"],

  // better-sqlite3 is a native (C++) module loaded at runtime — leave it
  // outside the bundler so Next.js doesn't try to inline its prebuilt binaries.
  // Without this the production build fails with "Cannot find module ../build/Release/better_sqlite3.node".
  serverExternalPackages: ["better-sqlite3"],

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

---

## `prisma/schema.prisma`

<a id="prisma-schema-prisma"></a>

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
model User {
  id          String    @id @default(cuid())
  email       String    @unique
  name        String
  // Public-facing handle the user picks on first sign-in. Replaces the email/name
  // in every list, mention, and assignee picker — only the president (role=admin)
  // sees real emails. Nullable so newly-approved users get redirected to the
  // /onboarding/nickname gate the first time they land in the app.
  nickname    String?   @unique
  role        String    @default("employee") // admin (= president) | manager | department_head | employee
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

  @@index([active])
  @@index([role])
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

model Client {
  id        String    @id @default(cuid())
  name      String
  email     String?
  phone     String?
  notes     String?
  createdAt DateTime  @default(now())
  projects  Project[]
}

model Project {
  id           String    @id @default(cuid())
  title        String
  description  String?
  clientId     String?
  client       Client?   @relation(fields: [clientId], references: [id], onDelete: SetNull)
  type         String? // video | photo | event | digital_campaign | web | other
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

  @@index([status])
  @@index([clientId])
  @@index([leadId])
  @@index([deadlineAt])
  @@index([nextInvoiceDueAt])
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

  comments      TaskComment[]
  updates       TaskUpdate[]
  collaborators TaskCollaborator[]

  @@index([projectId])
  @@index([assigneeId])
  @@index([creatorId])
  @@index([status])
  @@index([dueAt])
  @@index([assigneeId, status])
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
  category    String // project_payment | salary | bonus | tool | ad | overhead | refund | other
  amountQar   Float // always positive; sign comes from kind
  description String?
  occurredAt  DateTime
  // Recurrence — none: one-time; monthly: recurring every month starting occurredAt until recurrenceEndsAt (or forever).
  recurrence       String    @default("none") // none | monthly
  recurrenceEndsAt DateTime?
  createdAt        DateTime  @default(now())
  createdById      String?

  @@index([occurredAt])
  @@index([projectId])
  @@index([kind])
  @@index([recurrence])
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

<a id="proxy-ts"></a>

```ts
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
import { rateLimit } from "@/lib/rate-limit";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/login", "/403"]);
const PUBLIC_PREFIXES = ["/api/auth"];

// Paths reserved for admins. Includes UI routes under /admin/* and the legacy
// /api/sim/* control surface (CEO-only actions).
const ADMIN_PREFIXES = [
  "/admin",
  "/api/admin",
  "/api/sim/control",
  "/api/sim/decide",
  "/api/sim/action",
];

// API paths exempt from CSRF — Auth.js endpoints have their own CSRF guard.
const CSRF_EXEMPT_PREFIXES = ["/api/auth"];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function startsWithSegment(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

function isAdminPath(path: string): boolean {
  return ADMIN_PREFIXES.some((p) => startsWithSegment(path, p));
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

  // 2) Admin RBAC — runs after auth so we know the role.
  if (isAuthed && isAdminPath(path) && role !== "admin") {
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

  // 3b) Rate limit /api/* mutations: 60 writes / minute / user (or IP if anon).
  //     Read-only API routes are unlimited; the SSE stream and prefetch fetches
  //     stay snappy even with the proxy on the hot path.
  if (path.startsWith("/api/") && !isCsrfExempt(path) && !SAFE_METHODS.has(method)) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const key = req.auth?.user?.email
      ? `u:${req.auth.user.email}`
      : `ip:${ip}`;
    const limit = rateLimit(key, { windowMs: 60_000, max: 60 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
          },
        }
      );
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

## `types/next-auth.d.ts`

<a id="types-next-auth-d-ts"></a>

```ts
import type { DefaultSession } from "next-auth";

type Role = "admin" | "manager" | "department_head" | "employee";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      department: string | null;
      active: boolean;
      approved: boolean; // approvedAt is not null
      nickname: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    department?: string | null;
    active?: boolean;
    approved?: boolean;
    nickname?: string | null;
  }
}
```

---

