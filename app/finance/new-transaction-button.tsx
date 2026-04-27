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
