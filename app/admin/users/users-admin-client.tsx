"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Trash2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { User } from "@prisma/client";
import { useT } from "@/lib/i18n/client";
import {
  addUserAction,
  approveUserAction,
  changeUserRoleAction,
  deleteUserAction,
  rejectUserAction,
  toggleUserActiveAction,
} from "./actions";

type AuthRole = "admin" | "manager" | "employee";

const ROLE_COLOR: Record<AuthRole, string> = {
  admin: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  manager: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  employee: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

interface Props {
  users: User[];
  currentUserId: string;
}

export function UsersAdminClient({ users, currentUserId }: Props) {
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

  // Pending = never approved (approvedAt is null).
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

      {/* Pending queue */}
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
                    else showFlash("error", res.message ?? "خطأ");
                  })
                }
                onReject={() =>
                  startTransition(async () => {
                    const res = await rejectUserAction(u.id);
                    if (res.ok) showFlash("success", t("admin.pending.rejectedToast"));
                    else showFlash("error", res.message ?? "خطأ");
                  })
                }
              />
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          كل حساب يقدر يدخل بجيميل هذا الإيميل فقط · المدير يقدر يعدّل أو يحذف
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          <UserPlus className="h-3.5 w-3.5" />
          إضافة موظف
        </button>
      </div>

      {addOpen && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold">حساب جديد</h4>
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
                  showFlash("success", res.message ?? "تم");
                  setAddOpen(false);
                } else {
                  showFlash("error", res.message ?? "فشل الإضافة");
                }
              });
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <Field label="الاسم">
              <input
                name="name"
                required
                placeholder="أحمد الكواري"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              />
            </Field>
            <Field label="إيميل جيميل">
              <input
                name="email"
                type="email"
                required
                placeholder="ahmed@gmail.com"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                dir="ltr"
              />
            </Field>
            <Field label="الدور">
              <select
                name="role"
                required
                defaultValue="employee"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              >
                <option value="admin">مدير — يشوف كل شي</option>
                <option value="manager">رئيس قسم — قسمه فقط</option>
                <option value="employee">موظف — مهامه فقط</option>
              </select>
            </Field>
            <Field label="القسم (اختياري)">
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
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {isPending ? "يضيف..." : "أضف"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
        <ul className="divide-y divide-zinc-800/60">
          {approvedUsers.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-zinc-500">
              ما فيه حسابات بعد. اضغط "إضافة موظف" لتبدأ.
            </li>
          )}
          {approvedUsers.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <li
                key={u.id}
                className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">
                      {u.name}
                    </span>
                    {isSelf && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                        أنت
                      </span>
                    )}
                    {!u.active && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                        معطّل
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500" dir="ltr">
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
                          آخر دخول: {new Date(u.lastLoginAt).toLocaleDateString("en")}
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
                    {u.active ? "تعطيل" : "تفعيل"}
                  </button>
                  <button
                    disabled={isSelf || isPending}
                    onClick={() => {
                      if (!confirm(`تحذف حساب ${u.name}؟`)) return;
                      startTransition(async () => {
                        const res = await deleteUserAction(u.id);
                        if (!res.ok) showFlash("error", res.message ?? "فشل");
                      });
                    }}
                    className="rounded-md border border-rose-500/30 p-1.5 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
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
