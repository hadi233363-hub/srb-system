"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createEquipmentAction, updateEquipmentAction } from "./actions";
import { EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS } from "./constants";
import { useT } from "@/lib/i18n/client";

interface EquipmentInitial {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  condition: string;
  notes: string | null;
  purchasedAt: Date | null;
  purchasePriceQar: number | null;
}

interface Props {
  mode: "create" | "edit";
  initial?: EquipmentInitial;
}

function dateToInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EquipmentForm({ mode, initial }: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createEquipmentAction(formData)
          : await updateEquipmentAction(initial!.id, formData);
      if (res.ok) {
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
      } else {
        const msg = (res as { message?: string }).message;
        setError(msg ?? t("common.errorGeneric"));
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
          mode === "create"
            ? "text-zinc-950 hover:opacity-90"
            : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        )}
        style={
          mode === "create" ? { background: "var(--color-brand)" } : undefined
        }
      >
        {mode === "create" && <Plus className="h-4 w-4" />}
        {mode === "create" ? t("equipment.new") : t("action.edit")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-[5vh]"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {mode === "create" ? t("equipment.new") : t("equipment.edit")}
              </h3>
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
              <Field label={`${t("equipment.field.name")} *`} full>
                <input
                  name="name"
                  required
                  defaultValue={initial?.name ?? ""}
                  placeholder={t("equipment.field.namePlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("equipment.field.category")}>
                <select
                  name="category"
                  defaultValue={initial?.category ?? "camera"}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`equipment.category.${c}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("equipment.field.condition")}>
                <select
                  name="condition"
                  defaultValue={initial?.condition ?? "good"}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  {EQUIPMENT_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`equipment.condition.${c}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("equipment.field.brand")}>
                <input
                  name="brand"
                  defaultValue={initial?.brand ?? ""}
                  placeholder="Sony · Canon · Sigma"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("equipment.field.model")}>
                <input
                  name="model"
                  defaultValue={initial?.model ?? ""}
                  placeholder="A7 IV · 24-70mm f/2.8"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("equipment.field.serial")}>
                <input
                  name="serialNumber"
                  defaultValue={initial?.serialNumber ?? ""}
                  placeholder="SN-XXXX"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("equipment.field.purchasedAt")}>
                <input
                  type="date"
                  name="purchasedAt"
                  defaultValue={dateToInput(initial?.purchasedAt ?? null)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("equipment.field.price")}>
                <input
                  type="number"
                  step="any"
                  min="0"
                  name="purchasePriceQar"
                  defaultValue={initial?.purchasePriceQar ?? ""}
                  placeholder="15000"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("equipment.field.notes")} full>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={initial?.notes ?? ""}
                  placeholder={t("equipment.field.notesPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <div className="flex items-center justify-end gap-2 pt-2 sm:col-span-2">
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
                  className="rounded-md px-4 py-1.5 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--color-brand)" }}
                >
                  {isPending
                    ? t("action.saving")
                    : mode === "create"
                    ? t("equipment.create")
                    : t("action.save")}
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
