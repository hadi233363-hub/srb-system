"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, UserIcon, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { deleteTaskAction, updateTaskAction } from "@/app/tasks/actions";
import {
  PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  isOverdue,
} from "@/lib/db/helpers";

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
  email: string;
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
        setError(res.message ?? "خطأ");
      }
    });
  };

  const onDelete = () => {
    if (!confirm("تحذف المهمة نهائياً؟")) return;
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
              تعديل المهمة
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
            ⚠ هذه المهمة متأخرة عن الـ deadline
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
            {error}
          </div>
        )}

        <form action={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="عنوان المهمة" full>
            <input
              name="title"
              defaultValue={task.title}
              required
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>

          <Field label="الحالة">
            <select
              name="status"
              defaultValue={task.status}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            >
              {Object.entries(TASK_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الأولوية">
            <select
              name="priority"
              defaultValue={task.priority}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            >
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field label="موعد التسليم">
            <input
              name="dueAt"
              type="date"
              defaultValue={dueAtStr}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>

          <Field label="الساعات التقديرية">
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
            <Field label="المشروع" full>
              <select
                name="projectId"
                defaultValue={task.project?.id ?? ""}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              >
                <option value="">بدون مشروع</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="المسؤول الأساسي" full>
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
              <option value="">بدون مسؤول</option>
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
              موظفون إضافيون (collaborators)
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 p-2 min-h-[44px]">
              {collaboratorUsers.length === 0 && !showCollaboratorPicker && (
                <span className="text-xs text-zinc-600">
                  ما فيه موظفون إضافيون
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
                    أضف موظف
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
                          <span className="flex-1">{u.name}</span>
                          <span className="text-[10px] text-zinc-500" dir="ltr">
                            {u.email}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-1 text-[10px] text-zinc-600">
              المسؤول الأساسي + الموظفون الإضافيون كلهم يشوفون المهمة في قائمة
              مهامهم.
            </div>
          </div>

          <Field label="الوصف" full>
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
              حذف المهمة
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" />
                {isPending ? "يحفظ..." : "احفظ"}
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
