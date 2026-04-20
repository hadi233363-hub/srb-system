"use client";

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { addMemberAction, removeMemberAction } from "../actions";
import { cn } from "@/lib/cn";

interface User {
  id: string;
  name: string;
  email: string;
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
    if (!confirm("تشيل هذا الموظف من المشروع؟")) return;
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
        إدارة الفريق
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">إدارة الفريق</h3>
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
                  الأعضاء الحاليون
                </h4>
                {currentMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-500">
                    ما فيه أعضاء
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
                    {currentMembers.map((m) => (
                      <li key={m.userId} className="flex items-center justify-between p-2">
                        <div>
                          <div className="text-sm text-zinc-200">{m.user.name}</div>
                          <div className="text-[11px] text-zinc-500">
                            {m.role || m.user.jobTitle || m.user.role}
                          </div>
                        </div>
                        <button
                          onClick={() => onRemove(m.userId)}
                          disabled={isPending}
                          className="rounded-md border border-rose-500/30 px-2 py-1 text-[11px] text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
                        >
                          إزالة
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold text-zinc-400">
                  إضافة عضو
                </h4>
                {addable.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-500">
                    كل الموظفين مضافين
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 max-h-64 overflow-auto">
                    {addable.map((u) => (
                      <AddRow
                        key={u.id}
                        user={u}
                        onAdd={(role) => onAdd(u.id, role)}
                        disabled={isPending}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                إغلاق
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
}: {
  user: User;
  onAdd: (role: string) => void;
  disabled: boolean;
}) {
  const [role, setRole] = useState(user.jobTitle || "");
  return (
    <li className="flex items-center gap-2 p-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-zinc-200">{user.name}</div>
        <div className="text-[11px] text-zinc-500">{user.email}</div>
      </div>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="دوره"
        className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
      />
      <button
        onClick={() => onAdd(role)}
        disabled={disabled}
        className="rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        ضيف
      </button>
    </li>
  );
}
