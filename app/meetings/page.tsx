import { Calendar as CalIcon } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { MeetingForm } from "./meeting-form";
import { MeetingsList } from "./meetings-list";
import { CalendarView } from "./calendar-view";

export default async function MeetingsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const user = session?.user;
  if (!user) return null;

  const canManage = user.role === "admin" || user.role === "manager";

  const [meetings, users] = await Promise.all([
    prisma.clientMeeting.findMany({
      orderBy: { meetingAt: "desc" },
      include: { owner: { select: { id: true, name: true } } },
      take: 500,
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const upcoming = meetings.filter(
    (m) => m.status === "scheduled" && m.meetingAt.getTime() >= now.getTime() - 15 * 60_000
  );
  const next = upcoming.sort((a, b) => a.meetingAt.getTime() - b.meetingAt.getTime())[0];

  const statCount = {
    scheduled: upcoming.length,
    done: meetings.filter((m) => m.status === "done").length,
    cancelled: meetings.filter((m) => m.status === "cancelled").length,
    no_show: meetings.filter((m) => m.status === "no_show").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalIcon className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
            {t("page.meetings.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.meetings.subtitle")}
          </p>
        </div>
        {canManage && (
          <MeetingForm mode="create" users={users} currentUserId={user.id} />
        )}
      </div>

      {/* Next meeting banner */}
      {next && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--color-brand-border)",
            background: "var(--color-brand-dim)",
          }}
        >
          <div
            className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-brand)" }}
          >
            {t("meetings.nextUp")}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-zinc-100">
                {next.clientName}
                {next.companyName && (
                  <span className="ms-2 text-sm font-normal text-zinc-400">
                    · {next.companyName}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {new Date(next.meetingAt).toLocaleString(
                  locale === "en" ? "en-US" : "en",
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }
                )}
                {next.location && ` · ${next.location}`}
                {next.owner && ` · ${next.owner.name}`}
              </div>
            </div>
            {next.meetingLink && (
              <a
                href={next.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-950"
                style={{ background: "var(--color-brand)" }}
              >
                {t("meetings.joinCall")}
              </a>
            )}
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("meetings.status.scheduled")} value={statCount.scheduled} tone="brand" />
        <Kpi label={t("meetings.status.done")} value={statCount.done} tone="positive" />
        <Kpi label={t("meetings.status.cancelled")} value={statCount.cancelled} tone="muted" />
        <Kpi label={t("meetings.status.no_show")} value={statCount.no_show} tone="danger" />
      </div>

      {/* Calendar */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("meetings.calendar.heading")}
        </h2>
        <CalendarView
          meetings={meetings.map((m) => ({
            id: m.id,
            clientName: m.clientName,
            meetingAt: m.meetingAt,
            status: m.status,
          }))}
        />
      </section>

      {/* Full list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("meetings.list.heading")}
        </h2>
        <MeetingsList
          meetings={meetings}
          users={users}
          currentUserId={user.id}
          canManage={canManage}
        />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "positive" | "muted" | "danger";
}) {
  const style =
    tone === "brand"
      ? { color: "var(--color-brand)" }
      : tone === "positive"
      ? { color: "#34d399" }
      : tone === "danger"
      ? { color: "#fb7185" }
      : { color: "#a1a1aa" };
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={style}>
        {value}
      </div>
    </div>
  );
}
