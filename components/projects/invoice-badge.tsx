"use client";

// Per-project inline widget that summarises the current monthly-invoice cycle.
// Shown on the projects list card and the project detail header.
// Color ladder:
//   > 7 days away   — zinc  (neutral)
//   1-7 days away   — amber (heads-up)
//   due today       — sky   (action)
//   overdue         — rose  (urgent)
// One-click "record" button creates the income transaction and advances the
// cycle. Prevents double-record by disabling while pending.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { recordInvoiceAction } from "@/app/projects/actions";

interface Props {
  projectId: string;
  budgetQar: number;
  nextInvoiceDueAt: Date | string | null;
  locale: "ar" | "en";
  /** Compact mode = list card; full mode = project detail page. */
  size?: "compact" | "full";
}

function diffDays(target: Date): number {
  const ms = target.getTime() - Date.now();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function InvoiceBadge({
  projectId,
  budgetQar,
  nextInvoiceDueAt,
  locale,
  size = "compact",
}: Props) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [justRecorded, setJustRecorded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!nextInvoiceDueAt) return null;

  const due =
    nextInvoiceDueAt instanceof Date
      ? nextInvoiceDueAt
      : new Date(nextInvoiceDueAt);
  const days = diffDays(due);

  const isOverdue = days < 0;
  const isDueToday = days === 0;
  const isSoon = days > 0 && days <= 7;

  const label = isOverdue
    ? `${t("invoice.overdueBy")} ${Math.abs(days)} ${t("invoice.daysShort")}`
    : isDueToday
    ? t("invoice.status.dueToday")
    : `${t("invoice.status.upcoming")} · ${t("invoice.in")} ${days} ${t(
        "invoice.daysShort"
      )}`;

  const colorClasses = isOverdue
    ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
    : isDueToday
    ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
    : isSoon
    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
    : "border-zinc-700 bg-zinc-800/50 text-zinc-400";

  const Icon = isOverdue ? AlertCircle : isDueToday ? Clock : Clock;

  const canRecord =
    !pending && !justRecorded && (isOverdue || isDueToday || isSoon);

  const handleRecord = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canRecord) return;
    setError(null);
    startTransition(async () => {
      const res = await recordInvoiceAction(projectId);
      if (res.ok) {
        setJustRecorded(true);
        router.refresh();
      } else {
        setError(res.message ?? "");
      }
    });
  };

  if (justRecorded) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
        <CheckCircle2 className="h-2.5 w-2.5" />
        {t("invoice.recorded")}
      </span>
    );
  }

  if (size === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] tabular-nums",
          colorClasses
        )}
      >
        <Icon className="h-2.5 w-2.5" />
        {label}
      </span>
    );
  }

  // Full mode: inline row with the one-click record button.
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
        colorClasses
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="font-semibold">{label}</span>
        <span className="opacity-80 tabular-nums">
          {due.toLocaleDateString(locale === "ar" ? "ar-QA" : "en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span className="tabular-nums opacity-80">
          · {Math.round(budgetQar).toLocaleString("en")} ر.ق
        </span>
      </div>
      {canRecord && (
        <button
          onClick={handleRecord}
          disabled={pending}
          className="rounded-md bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {pending ? t("invoice.recording") : t("invoice.record")}
        </button>
      )}
      {error && <span className="text-rose-400">{error}</span>}
    </div>
  );
}
