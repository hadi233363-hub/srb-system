"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, UserIcon, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { deleteTaskAction, updateTaskAction } from "@/app/tasks/actions";
import { isOverdue } from "@/lib/db/helpers";
import { useT } from "@/lib/i18n/client";
import {
  TaskSubmissionSection,
  type SubmissionLite,
} from "./task-submission-section";

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
  // Submission snapshot (latest delivery on the task row)
  submissionUrl?: string | null;
  submissionFileUrl?: string | null;
  submissionFileName?: string | null;
  submissionFileType?: string | null;
  submissionNote?: string | null;
  submittedAt?: Date | string | null;
  reviewNote?: string | null;
  reviewedAt?: Date | string | null;
}

interface CurrentViewer {
  id: string;
  isOwner: boolean;
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
  viewer?: CurrentViewer;
  submissions?: SubmissionLite[];
}

export function TaskDetailModal({
  task,
  users,
  projects,
  allowProjectChange,
  onClose,
  viewer,
  submissions,
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

          {viewer && (
            <div className="sm:col-span-2">
              <TaskSubmissionSection
                taskId={task.id}
                taskTitle={task.title}
                taskStatus={task.status}
                isAssignee={
                  task.assignee?.id === viewer.id ||
                  (task.collaborators?.some((c) => c.user.id === viewer.id) ?? false)
                }
                isOwner={viewer.isOwner}
                submissionUrl={task.submissionUrl ?? null}
                submissionFileUrl={task.submissionFileUrl ?? null}
                submissionFileName={task.submissionFileName ?? null}
                submissionFileType={task.submissionFileType ?? null}
                submissionNote={task.submissionNote ?? null}
                submittedAt={task.submittedAt ?? null}
                reviewNote={task.reviewNote ?? null}
                reviewedAt={task.reviewedAt ?? null}
                submissions={submissions ?? []}
                onAfterAction={onClose}
              />
            </div>
          )}

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
