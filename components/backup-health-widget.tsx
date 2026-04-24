"use client";

// Dashboard widget — polls /api/admin/backup/health every 60s and shows a
// traffic-light banner. Admin-only on the server, but the widget will simply
// render nothing if the API returns 401 (defensive).

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, ShieldX, Loader2 } from "lucide-react";
import { translate, type Locale } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";

type Level = "healthy" | "warning" | "critical";

interface HealthResponse {
  level: Level;
  lastSuccess: {
    id: string;
    createdAt: string;
    sizeBytes: number;
    trigger: string;
    reason: string | null;
    verified: boolean;
    ageMs: number;
  } | null;
  lastFailure: {
    id: string;
    createdAt: string;
    errorMessage: string | null;
    trigger: string;
  } | null;
  scheduler: {
    running: boolean;
    inProgress: boolean;
  };
}

const POLL_MS = 60 * 1000;

export function BackupHealthWidget({ locale }: { locale: Locale }) {
  const t = (k: string) => translate(k, locale);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/admin/backup/health", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setErrored(true);
          return;
        }
        const json = (await res.json()) as HealthResponse;
        if (!cancelled) {
          setData(json);
          setErrored(false);
        }
      } catch {
        if (!cancelled) setErrored(true);
      }
    };
    void fetchHealth();
    const id = setInterval(fetchHealth, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (errored || !data) return null;

  const palette = {
    healthy: {
      border: "border-emerald-900/50",
      bg: "bg-emerald-950/20",
      text: "text-emerald-400",
      iconBg: "bg-emerald-500/15",
      Icon: ShieldCheck,
    },
    warning: {
      border: "border-amber-900/50",
      bg: "bg-amber-950/20",
      text: "text-amber-400",
      iconBg: "bg-amber-500/15",
      Icon: ShieldAlert,
    },
    critical: {
      border: "border-rose-900/60",
      bg: "bg-rose-950/30",
      text: "text-rose-400",
      iconBg: "bg-rose-500/15",
      Icon: ShieldX,
    },
  }[data.level];

  const headlineText =
    data.level === "healthy"
      ? t("backup.health.healthy")
      : data.level === "warning"
        ? t("backup.health.warning")
        : t("backup.health.critical");

  let detail: string;
  if (!data.lastSuccess) {
    detail = t("backup.health.never");
  } else {
    const ago = formatAgo(data.lastSuccess.ageMs, locale);
    detail = `${t("backup.health.lastAgo")} ${ago}`;
    if (data.lastSuccess.verified) {
      detail += ` · ${t("backup.health.verified")}`;
    }
  }

  if (data.lastFailure) {
    detail += ` · ${t("backup.health.failedRecent")}`;
  }

  return (
    <Link
      href="/admin/backup"
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 transition hover:brightness-110",
        palette.border,
        palette.bg
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          palette.iconBg
        )}
      >
        {data.scheduler.inProgress ? (
          <Loader2 className={cn("h-4 w-4 animate-spin", palette.text)} />
        ) : (
          <palette.Icon className={cn("h-4 w-4", palette.text)} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", palette.text)}>
            {t("backup.health.title")}
          </span>
          <span className={cn("text-xs", palette.text)}>· {headlineText}</span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-zinc-400">{detail}</div>
      </div>
    </Link>
  );
}

function formatAgo(ms: number, locale: Locale): string {
  const t = (k: string) => translate(k, locale);
  const minutes = Math.floor(ms / (60 * 1000));
  if (minutes < 1) return t("backup.duration.justNow");
  if (minutes < 60) return `${minutes} ${t("backup.duration.minutes")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t("backup.duration.hours")}`;
  const days = Math.floor(hours / 24);
  return `${days} ${t("backup.duration.days")}`;
}
