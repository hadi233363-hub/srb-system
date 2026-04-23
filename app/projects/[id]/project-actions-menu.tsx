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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setEditOpen(false)}
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
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
