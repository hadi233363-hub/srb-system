"use client";

// Smart assignee suggestions — rendered inside the new-task modal.
// Watches { title, description, projectId, requiredBadgeSlugs } and asks the
// API who best fits. User can click a suggestion card to one-tap-assign.

import { useEffect, useRef, useState } from "react";
import { Sparkles, CheckCircle2, Briefcase, Users, Clock, Award, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { csrfFetch } from "@/lib/csrf-client";
import { translate, type Locale } from "@/lib/i18n/dict";

interface SuggestionReason {
  kind: "badge" | "free" | "topic" | "project" | "track_record" | "department";
  ar: string;
  en: string;
}

interface SuggestionBadge {
  slug: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  colorHex: string;
  matched: boolean;
}

interface AssigneeSuggestion {
  user: {
    id: string;
    name: string;
    email: string;
    jobTitle: string | null;
    department: string | null;
    role: string;
  };
  badges: SuggestionBadge[];
  score: number;
  reasons: SuggestionReason[];
  openTaskCount: number;
  completionRate: number | null;
  topicMatchCount: number;
  isProjectMember: boolean;
}

interface SuggestionsResponse {
  suggestions: AssigneeSuggestion[];
  inferredBadgeSlugs: string[];
  filteredByBadge: boolean;
}

const REASON_ICONS: Record<SuggestionReason["kind"], LucideIcon> = {
  badge: Award,
  free: Clock,
  topic: Sparkles,
  project: Briefcase,
  track_record: Award,
  department: Users,
};

const DEBOUNCE_MS = 350;

export function SmartAssigneeSuggestions({
  title,
  description,
  projectId,
  requiredBadgeSlugs,
  selectedAssigneeId,
  onPick,
  onInferredBadges,
  locale,
}: {
  title: string;
  description?: string;
  projectId?: string;
  requiredBadgeSlugs?: string[];
  selectedAssigneeId?: string;
  onPick: (userId: string) => void;
  /** Bubble auto-detected badges back so the BadgePicker can highlight them. */
  onInferredBadges?: (slugs: string[]) => void;
  locale: Locale;
}) {
  const t = (k: string) => translate(k, locale);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [err, setErr] = useState(false);
  const lastRequestRef = useRef(0);

  const reqBadges = requiredBadgeSlugs ?? [];
  const reqBadgesKey = reqBadges.slice().sort().join(",");

  useEffect(() => {
    const trimmed = title.trim();
    if (trimmed.length < 2 && reqBadges.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }

    const myReq = ++lastRequestRef.current;
    setLoading(true);

    const handle = setTimeout(async () => {
      try {
        const res = await csrfFetch("/api/tasks/suggest-assignees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmed,
            description: description ?? null,
            projectId: projectId ?? null,
            requiredBadgeSlugs: reqBadges,
            limit: 5,
          }),
        });
        if (!res.ok) {
          if (myReq === lastRequestRef.current) {
            setErr(true);
            setData(null);
          }
          return;
        }
        const json = (await res.json()) as SuggestionsResponse;
        if (myReq === lastRequestRef.current) {
          setData(json);
          setErr(false);
          // Bubble auto-detected badges back when no explicit picks were sent.
          if (reqBadges.length === 0 && onInferredBadges) {
            onInferredBadges(json.inferredBadgeSlugs);
          }
        }
      } catch {
        if (myReq === lastRequestRef.current) {
          setErr(true);
          setData(null);
        }
      } finally {
        if (myReq === lastRequestRef.current) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, projectId, reqBadgesKey]);

  // Empty-state hint — only when there's literally nothing to act on.
  if (title.trim().length < 2 && reqBadges.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 p-3 text-center">
        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-600">
          <Sparkles className="h-3 w-3" />
          {t("tasks.suggest.hint")}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center text-[11px] text-zinc-500">
        {t("tasks.suggest.error")}
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <Sparkles className="h-3 w-3 animate-pulse text-emerald-400" />
          {t("tasks.suggest.thinking")}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { suggestions, filteredByBadge } = data;

  if (suggestions.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-300">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {filteredByBadge
            ? t("tasks.suggest.noMatchBadge")
            : t("tasks.suggest.noMatch")}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400">
        <Sparkles className="h-3 w-3" />
        {t("tasks.suggest.title")}
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s, idx) => (
          <SuggestionCard
            key={s.user.id}
            suggestion={s}
            rank={idx + 1}
            isPicked={selectedAssigneeId === s.user.id}
            onPick={() => onPick(s.user.id)}
            locale={locale}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  rank,
  isPicked,
  onPick,
  locale,
  t,
}: {
  suggestion: AssigneeSuggestion;
  rank: number;
  isPicked: boolean;
  onPick: () => void;
  locale: Locale;
  t: (k: string) => string;
}) {
  const { user, score, reasons, badges } = suggestion;
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const fitPct = Math.round(score * 100);
  const tone =
    rank === 1
      ? "border-emerald-500/40 bg-emerald-500/5"
      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700";

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-2.5 text-start transition",
        tone,
        isPicked && "ring-2 ring-emerald-500"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          rank === 1
            ? "bg-emerald-500/20 text-emerald-300"
            : "bg-zinc-800 text-zinc-300"
        )}
      >
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-100">
            {user.name}
          </span>
          {rank === 1 && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
              {t("tasks.suggest.bestFit")}
            </span>
          )}
          {isPicked && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
        </div>

        {badges.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {badges.slice(0, 4).map((b) => (
              <span
                key={b.slug}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px]",
                  b.matched && "ring-1 ring-emerald-400"
                )}
                style={{
                  borderColor: b.colorHex + "55",
                  backgroundColor: b.colorHex + "15",
                  color: b.colorHex,
                }}
              >
                <span>{b.icon}</span>
                <span>{locale === "ar" ? b.labelAr : b.labelEn}</span>
              </span>
            ))}
          </div>
        )}

        {(user.jobTitle || user.department) && (
          <div className="mt-0.5 text-[10px] text-zinc-500">
            {[user.jobTitle, user.department].filter(Boolean).join(" · ")}
          </div>
        )}
        <ul className="mt-1.5 space-y-0.5">
          {reasons.slice(0, 3).map((r, i) => {
            const Icon = REASON_ICONS[r.kind];
            return (
              <li key={i} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <Icon className="h-2.5 w-2.5 shrink-0 text-zinc-500" />
                <span className="truncate">{locale === "ar" ? r.ar : r.en}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="shrink-0 text-end">
        <div
          className={cn(
            "text-base font-bold tabular-nums",
            fitPct >= 70
              ? "text-emerald-400"
              : fitPct >= 40
                ? "text-amber-400"
                : "text-zinc-500"
          )}
        >
          {fitPct}%
        </div>
        <div className="text-[9px] text-zinc-600">{t("tasks.suggest.fit")}</div>
      </div>
    </button>
  );
}
