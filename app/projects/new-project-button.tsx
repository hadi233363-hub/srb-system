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
