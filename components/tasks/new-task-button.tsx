"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createTaskAction } from "@/app/tasks/actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { SmartAssigneeSuggestions } from "./smart-assignee-suggestions";
import { BadgePicker, type BadgeOption } from "./badge-picker";

interface User {
  id: string;
  name: string;
  email: string;
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
                      {u.name}
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
