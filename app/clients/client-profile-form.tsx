"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { deleteClientAction, updateClientAction } from "./actions";

interface Initial {
  name: string;
  brandName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface Props {
  id: string;
  initial: Initial;
  canEdit: boolean;
  canDelete: boolean;
}

export function ClientProfileForm({ id, initial, canEdit, canDelete }: Props) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await updateClientAction(id, formData);
      if (res.ok) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
        router.refresh();
      } else {
        setError(res.message ?? t("common.errorGeneric"));
      }
    });
  };

  const onDelete = () => {
    if (!confirm(t("clients.detail.deleteConfirm"))) return;
    startTransition(async () => {
      const res = await deleteClientAction(id);
      if (!res.ok) {
        setError(res.message ?? t("common.errorGeneric"));
      }
      // On success the action redirects to /clients; the router doesn't
      // reach here.
    });
  };

  return (
    <form
      action={onSubmit}
      className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">
          {t("clients.detail.profile")}
        </h2>
        {savedFlash && (
          <span className="text-[11px] text-emerald-400">
            ✓ {t("clients.detail.saved")}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={`${t("clients.field.name")} *`} full>
          <input
            name="name"
            required
            defaultValue={initial.name}
            disabled={!canEdit}
            className={cn(
              "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
        <Field label={t("clients.field.brand")}>
          <input
            name="brandName"
            defaultValue={initial.brandName ?? ""}
            disabled={!canEdit}
            placeholder={t("clients.field.brandPlaceholder")}
            className={cn(
              "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
        <Field label={t("clients.field.phone")}>
          <input
            name="phone"
            dir="ltr"
            defaultValue={initial.phone ?? ""}
            disabled={!canEdit}
            placeholder={t("clients.field.phonePlaceholder")}
            className={cn(
              "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
        <Field label={t("clients.field.email")}>
          <input
            name="email"
            type="email"
            dir="ltr"
            defaultValue={initial.email ?? ""}
            disabled={!canEdit}
            placeholder={t("clients.field.emailPlaceholder")}
            className={cn(
              "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
        <Field label={t("clients.field.notes")} full>
          <textarea
            name="notes"
            rows={3}
            defaultValue={initial.notes ?? ""}
            disabled={!canEdit}
            placeholder={t("clients.field.notesPlaceholder")}
            className={cn(
              "w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none",
              !canEdit && "opacity-60"
            )}
          />
        </Field>
      </div>

      {(canEdit || canDelete) && (
        <div className="flex items-center justify-between gap-2 border-t border-zinc-800 pt-3">
          {canDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("clients.detail.delete")}
            </button>
          ) : (
            <span />
          )}
          {canEdit && (
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {isPending ? t("clients.detail.saving") : t("clients.detail.save")}
            </button>
          )}
        </div>
      )}
    </form>
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
