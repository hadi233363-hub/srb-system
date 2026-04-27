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
