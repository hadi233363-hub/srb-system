"use client";

import { useState, useTransition } from "react";
import { FileText, Pencil, X, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { updateClientAgreementAction } from "@/app/projects/actions";
import { useT } from "@/lib/i18n/client";

interface ClientAgreement {
  id: string;
  name: string;
  storiesPerMonth: number | null;
  reelsPerMonth: number | null;
  postsPerMonth: number | null;
  contentType: string | null;
  agreementNotes: string | null;
}

export function ClientAgreementForm({ client }: { client: ClientAgreement }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasAgreementData =
    client.storiesPerMonth !== null ||
    client.reelsPerMonth !== null ||
    client.postsPerMonth !== null ||
    client.contentType ||
    client.agreementNotes;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateClientAgreementAction(client.id, fd);
      if (res.ok) {
        setEditing(false);
      } else {
        setError(t("agreement.saveFailed"));
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-200">{t("agreement.title")}</h3>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            <Pencil className="h-3 w-3" />
            {t("action.edit")}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field
              name="storiesPerMonth"
              label={t("agreement.stories")}
              type="number"
              defaultValue={client.storiesPerMonth ?? ""}
              placeholder="0"
            />
            <Field
              name="reelsPerMonth"
              label={t("agreement.reels")}
              type="number"
              defaultValue={client.reelsPerMonth ?? ""}
              placeholder="0"
            />
            <Field
              name="postsPerMonth"
              label={t("agreement.posts")}
              type="number"
              defaultValue={client.postsPerMonth ?? ""}
              placeholder="0"
            />
          </div>
          <Field
            name="contentType"
            label={t("agreement.contentType")}
            defaultValue={client.contentType ?? ""}
            placeholder={t("agreement.contentTypePlaceholder")}
          />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-zinc-500">{t("agreement.notes")}</label>
            <textarea
              name="agreementNotes"
              defaultValue={client.agreementNotes ?? ""}
              rows={3}
              placeholder={t("agreement.notesPlaceholder")}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-[11px] text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {isPending ? t("agreement.saving") : t("action.save")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500"
            >
              <X className="h-3.5 w-3.5" />
              {t("action.cancel")}
            </button>
          </div>
        </form>
      ) : hasAgreementData ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <AgreementStat
              label={t("agreement.stories")}
              value={client.storiesPerMonth !== null ? String(client.storiesPerMonth) : "—"}
            />
            <AgreementStat
              label={t("agreement.reels")}
              value={client.reelsPerMonth !== null ? String(client.reelsPerMonth) : "—"}
            />
            <AgreementStat
              label={t("agreement.posts")}
              value={client.postsPerMonth !== null ? String(client.postsPerMonth) : "—"}
            />
          </div>
          {client.contentType && (
            <div>
              <div className="mb-0.5 text-[10px] text-zinc-500">{t("agreement.contentType")}</div>
              <div className="text-xs text-zinc-300">{client.contentType}</div>
            </div>
          )}
          {client.agreementNotes && (
            <div>
              <div className="mb-0.5 text-[10px] text-zinc-500">{t("agreement.notes")}</div>
              <div className="whitespace-pre-wrap text-xs text-zinc-400">{client.agreementNotes}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-[11px] text-zinc-600">
          {t("agreement.empty")}
        </div>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-zinc-500">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        min={type === "number" ? 0 : undefined}
        className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
      />
    </div>
  );
}

function AgreementStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-center">
      <div className="text-lg font-bold text-zinc-100 tabular-nums">{value}</div>
      <div className="text-[9px] text-zinc-500">{label}</div>
    </div>
  );
}
