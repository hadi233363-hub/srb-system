"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { updateTransactionAction } from "./actions";
import { useT } from "@/lib/i18n/client";

interface ProjectLite {
  id: string;
  title: string;
}

interface Transaction {
  id: string;
  kind: string;
  category: string;
  amountQar: number;
  description: string | null;
  occurredAt: Date;
  recurrence: string;
  recurrenceEndsAt: Date | null;
  projectId: string | null;
}

const MONTHLY_DEFAULT = new Set(["salary", "overhead", "tool"]);

const INCOME_CATS = ["project_payment", "other"] as const;
const EXPENSE_CATS = ["salary", "bonus", "tool", "ad", "freelance", "overhead", "refund", "other"] as const;

interface Props {
  tx: Transaction;
  projects: ProjectLite[];
}

export function EditTransactionButton({ tx, projects }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<"income" | "expense">(tx.kind as "income" | "expense");
  const [category, setCategory] = useState(tx.category);
  const [recurrence, setRecurrence] = useState<"none" | "monthly">(tx.recurrence as "none" | "monthly");
  const formRef = useRef<HTMLFormElement>(null);

  function handleKindChange(k: "income" | "expense") {
    setKind(k);
    if (k === "income") { setCategory("project_payment"); setRecurrence("none"); }
    else { setCategory("salary"); setRecurrence("monthly"); }
  }

  function handleCategoryChange(cat: string) {
    setCategory(cat);
    setRecurrence(MONTHLY_DEFAULT.has(cat) ? "monthly" : "none");
  }

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await updateTransactionAction(tx.id, formData);
      if (res.ok) {
        setOpen(false);
      } else {
        setError(res.message ?? t("common.error"));
      }
    });
  };

  const incomeCategories = INCOME_CATS.map((v) => ({ value: v, label: t(`txCategory.${v}`) }));
  const expenseCategories = EXPENSE_CATS.map((v) => ({ value: v, label: t(`txCategory.${v}`) }));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
        title={t("finance.editTx")}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("finance.editTx")}</h3>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
                {error}
              </div>
            )}

            <form ref={formRef} action={onSubmit} className="space-y-3">
              {/* Kind */}
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">{t("finance.field.kind")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["income", "expense"] as const).map((k) => (
                    <label
                      key={k}
                      className={cn(
                        "cursor-pointer rounded-md border px-3 py-2 text-center text-sm transition",
                        kind === k
                          ? k === "income"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-400"
                          : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                      )}
                    >
                      <input
                        type="radio"
                        name="kind"
                        value={k}
                        checked={kind === k}
                        onChange={() => handleKindChange(k)}
                        className="sr-only"
                      />
                      {k === "income" ? `💰 ${t("tx.income")}` : `💸 ${t("tx.expense")}`}
                    </label>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("finance.field.category")}</label>
                <select
                  name="category"
                  required
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  {(kind === "income" ? incomeCategories : expenseCategories).map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Recurrence */}
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">{t("finance.field.recurrence")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["none", "monthly"] as const).map((r) => (
                    <label
                      key={r}
                      className={cn(
                        "cursor-pointer rounded-md border px-3 py-2 text-center text-sm transition",
                        recurrence === r
                          ? r === "none"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-sky-500/40 bg-sky-500/10 text-sky-400"
                          : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                      )}
                    >
                      <input
                        type="radio"
                        name="recurrence"
                        value={r}
                        checked={recurrence === r}
                        onChange={() => setRecurrence(r)}
                        className="sr-only"
                      />
                      {r === "none" ? t("recurrence.none") : `🔁 ${t("recurrence.monthly")}`}
                    </label>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("finance.field.amount")} *</label>
                <input
                  name="amountQar"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={tx.amountQar}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>

              {/* Date */}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("finance.field.occurredAt")}</label>
                <input
                  name="occurredAt"
                  type="date"
                  defaultValue={new Date(tx.occurredAt).toISOString().slice(0, 10)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>

              {/* Recurrence end date */}
              {recurrence === "monthly" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">{t("finance.field.recurrenceEnds")}</label>
                  <input
                    name="recurrenceEndsAt"
                    type="date"
                    defaultValue={tx.recurrenceEndsAt ? new Date(tx.recurrenceEndsAt).toISOString().slice(0, 10) : ""}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                  />
                </div>
              )}

              {/* Project */}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("finance.field.project")}</label>
                <select
                  name="projectId"
                  defaultValue={tx.projectId ?? ""}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("finance.field.description")}</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={tx.description ?? ""}
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
