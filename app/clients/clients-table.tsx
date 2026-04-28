"use client";

// Live-search table for /clients. Pure in-memory filter (no fetch on each
// keystroke) — at 1k rows this is faster than a network round-trip and the
// list page already has every row it needs.

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Search, X, Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dict";
import { formatDate, formatQar } from "@/lib/db/helpers";
import { cn } from "@/lib/cn";
import { createClientAction } from "./actions";
import { ClientStatusBadge } from "./client-status-badge";

interface Row {
  id: string;
  name: string;
  brandName: string | null;
  phone: string | null;
  email: string | null;
  projectsCount: number;
  totalRevenue: number;
  lastProjectTitle: string | null;
  lastProjectAt: Date | string | null;
  joinedAt: Date | string;
  isActive: boolean;
}

interface Props {
  rows: Row[];
  canCreate: boolean;
  locale: Locale;
  emptyAddOnly?: boolean;
}

export function ClientsTable({ rows, canCreate, locale, emptyAddOnly }: Props) {
  const t = useT();
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const name = r.name.toLowerCase();
      const phone = (r.phone ?? "").toLowerCase();
      const brand = (r.brandName ?? "").toLowerCase();
      return (
        name.includes(needle) ||
        phone.includes(needle) ||
        brand.includes(needle)
      );
    });
  }, [rows, q]);

  const onCopy = (id: string, phone: string | null) => {
    if (!phone) return;
    void navigator.clipboard?.writeText(phone).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1200);
    });
  };

  if (emptyAddOnly) {
    return (
      <>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            {t("clients.action.new")}
          </button>
        )}
        {showNew && <NewClientModal onClose={() => setShowNew(false)} />}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500",
              locale === "ar" ? "right-3" : "left-3"
            )}
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("clients.searchPlaceholder")}
            className={cn(
              "w-full rounded-lg border border-zinc-800 bg-zinc-900/40 py-2 text-sm text-zinc-100 focus:border-emerald-500/40 focus:outline-none",
              locale === "ar" ? "pr-9 pl-3" : "pl-9 pr-3"
            )}
          />
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            {t("clients.action.new")}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
              <Th>{t("clients.col.name")}</Th>
              <Th>{t("clients.col.status")}</Th>
              <Th>{t("clients.col.brand")}</Th>
              <Th>{t("clients.col.phone")}</Th>
              <Th align="end">{t("clients.col.projectsCount")}</Th>
              <Th align="end">{t("clients.col.totalRevenue")}</Th>
              <Th>{t("clients.col.lastProject")}</Th>
              <Th>{t("clients.col.joinedAt")}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-zinc-900 transition hover:bg-zinc-900/60 last:border-b-0"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/clients/${r.id}`}
                    className="font-semibold text-zinc-100 hover:text-emerald-400"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <ClientStatusBadge isActive={r.isActive} />
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {r.brandName ? (
                    <span className="truncate">{r.brandName}</span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {r.phone ? (
                    <div className="flex items-center gap-1.5" dir="ltr">
                      <span className="tabular-nums">{r.phone}</span>
                      <button
                        type="button"
                        title={t("clients.action.copyPhone")}
                        onClick={() => onCopy(r.id, r.phone)}
                        className={cn(
                          "rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200",
                          copiedId === r.id && "text-emerald-400"
                        )}
                      >
                        {copiedId === r.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-end tabular-nums text-zinc-200">
                  {r.projectsCount}
                </td>
                <td className="px-3 py-2 text-end tabular-nums text-emerald-400">
                  {r.totalRevenue > 0
                    ? formatQar(r.totalRevenue, { locale })
                    : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {r.lastProjectTitle ? (
                    <div>
                      <div className="truncate text-zinc-200">{r.lastProjectTitle}</div>
                      <div className="text-[10px] text-zinc-600">
                        {formatDate(r.lastProjectAt as Date | null, locale)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-500 tabular-nums">
                  {formatDate(r.joinedAt as Date, locale)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-zinc-500">
                  {q ? t("clients.combobox.noResults") : t("clients.empty.title")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && <NewClientModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th
      className={cn(
        "px-3 py-2 font-medium",
        align === "end" ? "text-end" : "text-start"
      )}
    >
      {children}
    </th>
  );
}

function NewClientModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await createClientAction(formData);
      if (res.ok && res.id) {
        onClose();
        router.push(`/clients/${res.id}`);
        router.refresh();
      } else {
        setError(res.message ?? t("common.errorGeneric"));
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{t("clients.action.new")}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
            {error}
          </div>
        )}

        <form action={onSubmit} className="space-y-3">
          <Field label={`${t("clients.field.name")} *`}>
            <input
              name="name"
              required
              autoFocus
              placeholder={t("clients.field.namePlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <Field label={t("clients.field.brand")}>
            <input
              name="brandName"
              placeholder={t("clients.field.brandPlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <Field label={t("clients.field.phone")}>
            <input
              name="phone"
              dir="ltr"
              placeholder={t("clients.field.phonePlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <Field label={t("clients.field.email")}>
            <input
              name="email"
              type="email"
              dir="ltr"
              placeholder={t("clients.field.emailPlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <Field label={t("clients.field.notes")}>
            <textarea
              name="notes"
              rows={3}
              placeholder={t("clients.field.notesPlaceholder")}
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            >
              {t("action.cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {isPending ? t("action.creating") : t("clients.action.add")}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
