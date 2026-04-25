"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  Trash2,
  Video,
  XCircle,
  UserCheck,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { displayName } from "@/lib/display";
import { useT, useLocale } from "@/lib/i18n/client";
import { deleteMeetingAction, updateMeetingAction } from "./actions";
import { MeetingForm } from "./meeting-form";

type Filter = "upcoming" | "past" | "all";

interface Meeting {
  id: string;
  clientName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  websiteUrl: string | null;
  socialNotes: string | null;
  meetingAt: Date;
  durationMin: number;
  location: string | null;
  meetingLink: string | null;
  agendaNotes: string | null;
  status: string;
  outcomeNotes: string | null;
  ownerId: string | null;
  reminderSentAt: Date | null;
  owner: { id: string; name: string; nickname: string | null } | null;
}

interface UserLite {
  id: string;
  name: string;
  nickname: string | null;
}

interface Props {
  meetings: Meeting[];
  users: UserLite[];
  currentUserId: string;
  canManage: boolean;
}

function normalizeInstaUrl(v: string): string {
  const s = v.trim().replace(/^@/, "");
  if (/^https?:\/\//.test(s)) return s;
  return `https://instagram.com/${s}`;
}
function normalizeTiktokUrl(v: string): string {
  const s = v.trim().replace(/^@/, "");
  if (/^https?:\/\//.test(s)) return s;
  return `https://www.tiktok.com/@${s}`;
}
function normalizeWebsite(v: string): string {
  const s = v.trim();
  if (/^https?:\/\//.test(s)) return s;
  return `https://${s}`;
}

function formatWhen(d: Date, locale: "ar" | "en"): string {
  const bcp = locale === "en" ? "en-US" : "en";
  return new Date(d).toLocaleString(bcp, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function timeUntil(d: Date, locale: "ar" | "en"): string {
  const ms = new Date(d).getTime() - Date.now();
  const min = Math.round(ms / 60_000);
  if (ms < 0) {
    const ago = Math.abs(min);
    if (locale === "en")
      return ago < 60
        ? `${ago}m ago`
        : ago < 1440
        ? `${Math.round(ago / 60)}h ago`
        : `${Math.round(ago / 1440)}d ago`;
    return ago < 60
      ? `قبل ${ago} دقيقة`
      : ago < 1440
      ? `قبل ${Math.round(ago / 60)} ساعة`
      : `قبل ${Math.round(ago / 1440)} يوم`;
  }
  if (min < 60) return locale === "en" ? `in ${min}m` : `بعد ${min} دقيقة`;
  if (min < 1440)
    return locale === "en"
      ? `in ${Math.round(min / 60)}h`
      : `بعد ${Math.round(min / 60)} ساعة`;
  return locale === "en"
    ? `in ${Math.round(min / 1440)}d`
    : `بعد ${Math.round(min / 1440)} يوم`;
}

export function MeetingsList({ meetings, users, currentUserId, canManage }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const now = Date.now();
  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (filter === "upcoming")
        return m.status === "scheduled" && new Date(m.meetingAt).getTime() >= now - 15 * 60_000;
      if (filter === "past") return new Date(m.meetingAt).getTime() < now - 15 * 60_000 || m.status !== "scheduled";
      return true;
    });
  }, [meetings, filter, now]);

  const grouped = useMemo(() => {
    const bucket = new Map<string, Meeting[]>();
    for (const m of filtered) {
      const key = new Date(m.meetingAt).toDateString();
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key)!.push(m);
    }
    return Array.from(bucket.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  }, [filtered]);

  const markStatus = (id: string, status: string) => {
    const fd = new FormData();
    fd.set("status", status);
    startTransition(async () => {
      await updateMeetingAction(id, fd);
      router.refresh();
    });
  };

  const del = (id: string, clientName: string) => {
    if (!confirm(`${t("meetings.deleteConfirm")} ${clientName}`)) return;
    startTransition(async () => {
      await deleteMeetingAction(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1 w-fit">
        {(["upcoming", "past", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs transition",
              filter === f
                ? "text-zinc-950"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            )}
            style={filter === f ? { background: "var(--color-brand)" } : undefined}
          >
            {t(`meetings.filter.${f}`)}{" "}
            {f === "upcoming" && (
              <span className="ms-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
                {
                  meetings.filter(
                    (m) =>
                      m.status === "scheduled" &&
                      new Date(m.meetingAt).getTime() >= now - 15 * 60_000
                  ).length
                }
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <CalIcon className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("meetings.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">
            {t("meetings.empty.desc")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dayKey, items]) => (
            <div key={dayKey}>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                <CalIcon className="h-3.5 w-3.5" />
                {new Date(dayKey).toLocaleDateString(
                  locale === "en" ? "en-US" : "en",
                  { weekday: "long", year: "numeric", month: "long", day: "numeric" }
                )}
                <span className="text-zinc-600">
                  · {items.length} {t("meetings.items")}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((m) => {
                  const statusTone =
                    m.status === "scheduled"
                      ? "border-sky-500/30 bg-sky-500/5"
                      : m.status === "done"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : m.status === "cancelled"
                      ? "border-zinc-700 bg-zinc-900/40 opacity-70"
                      : "border-rose-500/30 bg-rose-500/5";
                  const msUntil = new Date(m.meetingAt).getTime() - now;
                  const isSoon =
                    m.status === "scheduled" && msUntil > 0 && msUntil <= 60 * 60_000;

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-xl border p-4 transition hover:border-zinc-600",
                        statusTone,
                        isSoon && "ring-1 ring-amber-500/30"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-zinc-100">
                              {m.clientName}
                            </div>
                            {m.companyName && (
                              <div className="text-xs text-zinc-500">
                                · {m.companyName}
                              </div>
                            )}
                            <StatusBadge status={m.status} t={t} />
                            {isSoon && (
                              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                ⚡ {t("meetings.soon")}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatWhen(m.meetingAt, locale)}
                              <span className="text-zinc-600">
                                ({timeUntil(m.meetingAt, locale)})
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              ⏱ {m.durationMin} {t("meetings.minutes")}
                            </span>
                            {m.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {m.location}
                              </span>
                            )}
                            {m.owner && (
                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                {displayName(m.owner)}
                              </span>
                            )}
                          </div>

                          {/* Client contact + social row */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {m.phone && (
                              <Chip
                                icon={Phone}
                                label={m.phone}
                                href={`tel:${m.phone}`}
                              />
                            )}
                            {m.email && (
                              <Chip
                                icon={Mail}
                                label={m.email}
                                href={`mailto:${m.email}`}
                              />
                            )}
                            {m.instagramHandle && (
                              <Chip
                                icon={InstagramIcon}
                                label={m.instagramHandle}
                                href={normalizeInstaUrl(m.instagramHandle)}
                                tone="accent"
                              />
                            )}
                            {m.tiktokHandle && (
                              <Chip
                                icon={TikTokIcon}
                                label={m.tiktokHandle}
                                href={normalizeTiktokUrl(m.tiktokHandle)}
                                tone="accent"
                              />
                            )}
                            {m.websiteUrl && (
                              <Chip
                                icon={GlobeIcon}
                                label={m.websiteUrl.replace(
                                  /^https?:\/\/(www\.)?/,
                                  ""
                                )}
                                href={normalizeWebsite(m.websiteUrl)}
                                tone="accent"
                              />
                            )}
                            {m.meetingLink && (
                              <Chip
                                icon={Video}
                                label={t("meetings.joinCall")}
                                href={m.meetingLink}
                                tone="brand"
                              />
                            )}
                          </div>

                          {m.agendaNotes && (
                            <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
                              <span className="font-semibold text-zinc-300">
                                {t("meetings.field.agendaNotes")}:
                              </span>{" "}
                              {m.agendaNotes}
                            </div>
                          )}
                          {m.outcomeNotes && (
                            <div className="mt-2 rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
                              <span className="font-semibold">
                                {t("meetings.field.outcomeNotes")}:
                              </span>{" "}
                              {m.outcomeNotes}
                            </div>
                          )}
                          {m.socialNotes && (
                            <div className="mt-2 text-[11px] text-zinc-500">
                              💬 {m.socialNotes}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        {canManage && (
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {m.status === "scheduled" && (
                              <>
                                <button
                                  onClick={() => markStatus(m.id, "done")}
                                  disabled={isPending}
                                  className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-400 transition hover:bg-emerald-500/15 disabled:opacity-40"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t("meetings.markDone")}
                                </button>
                                <button
                                  onClick={() => markStatus(m.id, "cancelled")}
                                  disabled={isPending}
                                  className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-40"
                                >
                                  <XCircle className="h-3 w-3" />
                                  {t("meetings.cancel")}
                                </button>
                              </>
                            )}
                            <MeetingForm
                              mode="edit"
                              users={users}
                              currentUserId={currentUserId}
                              initial={m}
                            />
                            <button
                              onClick={() => del(m.id, m.clientName)}
                              disabled={isPending}
                              className="rounded-md border border-rose-500/30 p-1 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
                              aria-label={t("action.delete")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  href,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  tone?: "accent" | "brand";
}) {
  const style =
    tone === "brand"
      ? {
          background: "var(--color-brand-dim)",
          color: "var(--color-brand)",
          borderColor: "var(--color-brand-border)",
        }
      : tone === "accent"
      ? {
          background: "var(--color-accent-dim)",
          color: "var(--color-accent)",
        }
      : undefined;

  const classes = cn(
    "inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-300",
    href && "transition hover:border-zinc-600"
  );

  const content = (
    <>
      <Icon className="h-3 w-3" />
      <span className="truncate max-w-[180px]" dir="ltr">
        {label}
      </span>
      {href && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        style={style}
      >
        {content}
      </a>
    );
  }
  return (
    <span className={classes} style={style}>
      {content}
    </span>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (k: string) => string;
}) {
  const map: Record<string, string> = {
    scheduled: "bg-sky-500/10 text-sky-400",
    done: "bg-emerald-500/10 text-emerald-400",
    cancelled: "bg-zinc-700/40 text-zinc-400",
    no_show: "bg-rose-500/10 text-rose-400",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px]",
        map[status] ?? "bg-zinc-700/40 text-zinc-400"
      )}
    >
      {t(`meetings.status.${status}`)}
    </span>
  );
}

// Inline social icons — lucide@1.x doesn't ship all of them, and we want the
// brand-accurate shape anyway. Stroke-based so they inherit currentColor.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M19.321 5.562a5.124 5.124 0 01-5.16-4.956h-3.427v13.672a3.1 3.1 0 11-2.163-2.954v-3.48a6.579 6.579 0 00-.78-.047A6.597 6.597 0 005.8 18.407v.005A6.6 6.6 0 0017.8 14.01V7.56a8.545 8.545 0 001.521.137V5.562z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
