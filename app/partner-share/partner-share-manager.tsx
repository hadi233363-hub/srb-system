"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { formatQar } from "@/lib/db/helpers";
import type { Locale } from "@/lib/i18n/dict";
import {
  createPartnerShareAction,
  updatePartnerShareAction,
  deletePartnerShareAction,
} from "./actions";

export interface ShareEntry {
  id: string;
  projectId: string;
  projectTitle: string;
  partnerName: string;
  sharePercent: number;
  notes: string | null;
  projectIncome: number;
  partnerAmount: number;
}

export interface ProjectOption {
  id: string;
  title: string;
}

interface Props {
  shares: ShareEntry[];
  projects: ProjectOption[];
  locale: Locale;
}

type ModalState =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; share: ShareEntry }
  | { kind: "delete"; share: ShareEntry };

export function PartnerShareManager({ shares, projects, locale }: Props) {
  const t = useT();
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalPartnerAmount = shares.reduce((s, r) => s + r.partnerAmount, 0);
  const totalIncome = shares.reduce((s, r) => s + r.projectIncome, 0);

  function close() {
    setModal({ kind: "closed" });
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      let res: { ok: boolean; message?: string };
      if (modal.kind === "add") {
        res = await createPartnerShareAction(formData);
      } else if (modal.kind === "edit") {
        res = await updatePartnerShareAction(modal.share.id, formData);
      } else {
        return;
      }
      if (res.ok) close();
      else setError(res.message ?? t("common.error"));
    });
  }

  function handleDelete() {
    if (modal.kind !== "delete") return;
    startTransition(async () => {
      const res = await deletePartnerShareAction(modal.share.id);
      if (res.ok) close();
      else setError(res.message ?? t("common.error"));
    });
  }

  const fmt = (n: number) => formatQar(n, { locale });

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-[11px] text-zinc-500">{t("partnerShare.totalIncome")}</div>
          <div className="mt-1 text-xl font-bold text-emerald-400">{fmt(totalIncome)}</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="text-[11px] text-zinc-500">{t("partnerShare.totalPartnerAmount")}</div>
          <div className="mt-1 text-xl font-bold text-amber-300">{fmt(totalPartnerAmount)}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-[11px] text-zinc-500">{t("partnerShare.entryCount")}</div>
          <div className="mt-1 text-xl font-bold text-zinc-100">{shares.length}</div>
        </div>
      </div>

      {/* Table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-400">{t("partnerShare.tableHeading")}</h2>
          <button
            onClick={() => setModal({ kind: "add" })}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("partnerShare.addShare")}
          </button>
        </div>

        {shares.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center text-sm text-zinc-500">
            {t("partnerShare.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-start font-normal">{t("partnerShare.col.project")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("partnerShare.col.partner")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("partnerShare.col.percent")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("partnerShare.col.income")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("partnerShare.col.amount")}</th>
                  <th className="w-20 px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {shares.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-2 text-xs text-zinc-300">{s.projectTitle}</td>
                    <td className="px-4 py-2 text-xs font-medium text-zinc-100">{s.partnerName}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                        {s.sharePercent}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-emerald-400 tabular-nums">{fmt(s.projectIncome)}</td>
                    <td className="px-4 py-2 text-sm font-bold text-amber-300 tabular-nums">
                      {fmt(s.partnerAmount)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setModal({ kind: "edit", share: s })}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                          title={t("action.edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ kind: "delete", share: s })}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                          title={t("action.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {(modal.kind === "add" || modal.kind === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {modal.kind === "add" ? t("partnerShare.addShare") : t("partnerShare.editShare")}
              </h3>
              <button onClick={close} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
                {error}
              </div>
            )}

            <form action={handleSubmit} className="space-y-3">
              {/* Project — only for new shares */}
              {modal.kind === "add" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">{t("partnerShare.field.project")} *</label>
                  <select
                    name="projectId"
                    required
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                  >
                    <option value="">— {t("partnerShare.field.selectProject")} —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Partner name */}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("partnerShare.field.partnerName")} *</label>
                <input
                  name="partnerName"
                  type="text"
                  required
                  defaultValue={modal.kind === "edit" ? modal.share.partnerName : ""}
                  placeholder={t("partnerShare.field.partnerNamePlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              {/* Share % */}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("partnerShare.field.sharePercent")} *</label>
                <input
                  name="sharePercent"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  required
                  defaultValue={modal.kind === "edit" ? modal.share.sharePercent : ""}
                  placeholder="30"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("partnerShare.field.notes")}</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={modal.kind === "edit" ? (modal.share.notes ?? "") : ""}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  {t("action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-60"
                >
                  {isPending ? t("action.saving") : t("action.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {modal.kind === "delete" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="mb-2 text-base font-bold text-rose-400">{t("partnerShare.deleteConfirmTitle")}</h3>
            <p className="mb-4 text-sm text-zinc-400">
              {t("partnerShare.deleteConfirmBody")}{" "}
              <span className="font-semibold text-zinc-200">{modal.share.partnerName}</span>
              {" · "}{modal.share.sharePercent}%
            </p>
            {error && (
              <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
                {error}
              </div>
            )}
            <div className={cn("flex items-center justify-end gap-2")}>
              <button
                onClick={close}
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                {t("action.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {isPending ? t("action.deleting") : t("action.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
