import Link from "next/link";
import {
  Camera,
  Clock,
  MapPin,
  Users,
  Package,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";
import { displayName } from "@/lib/display";
import { ShootForm } from "./shoot-form";
import { CalendarView } from "../meetings/calendar-view";
import { ShootActions } from "./shoot-actions";

export default async function ShootsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const user = session?.user;
  if (!user) return null;
  const canManage = user.role === "admin" || user.role === "manager";

  const [shoots, users, projects, equipment] = await Promise.all([
    prisma.photoShoot.findMany({
      orderBy: { shootDate: "desc" },
      include: {
        project: { select: { id: true, title: true } },
        crew: {
          include: { user: { select: { id: true, name: true, nickname: true } } },
        },
        equipment: {
          include: {
            equipment: {
              select: { id: true, name: true, category: true },
            },
          },
        },
      },
      take: 500,
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, nickname: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { status: { in: ["active", "on_hold"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.equipment.findMany({
      select: { id: true, name: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  const now = new Date();

  // User-specific upcoming shoots — so a photographer sees "my next shoots"
  const myUpcoming = shoots.filter(
    (s) =>
      s.status === "scheduled" &&
      s.shootDate.getTime() >= now.getTime() &&
      s.crew.some((c) => c.user.id === user.id)
  );

  // Conflict detection — crew members booked on overlapping shoots.
  const conflicts = detectConflicts(
    shoots.filter((s) => s.status === "scheduled")
  );

  const upcomingAll = shoots
    .filter(
      (s) => s.status === "scheduled" && s.shootDate.getTime() >= now.getTime()
    )
    .sort((a, b) => a.shootDate.getTime() - b.shootDate.getTime());
  const past = shoots.filter(
    (s) => s.status !== "scheduled" || s.shootDate.getTime() < now.getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Camera className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
            {t("page.shoots.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.shoots.subtitle")}
          </p>
        </div>
        {canManage && (
          <ShootForm
            mode="create"
            users={users}
            projects={projects}
            equipment={equipment}
          />
        )}
      </div>

      {/* "My next shoots" banner — only shown when the user is on crew of upcoming shoots */}
      {myUpcoming.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--color-brand-border)",
            background: "var(--color-brand-dim)",
          }}
        >
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-brand)" }}
          >
            {t("shoots.myUpcoming")} · {myUpcoming.length}
          </div>
          <div className="space-y-2">
            {myUpcoming.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-950/40 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-semibold text-zinc-100">{s.title}</div>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    {s.shootDate.toLocaleString(
                      locale === "en" ? "en-US" : "en",
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      }
                    )}
                    {" · "}
                    <MapPin className="inline h-3 w-3" /> {s.location}
                  </div>
                </div>
                {s.mapUrl && (
                  <a
                    href={s.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                  >
                    <MapPin className="h-3 w-3" />
                    {t("shoots.openMap")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts warning */}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <div className="mb-2 text-xs font-semibold text-rose-300">
            ⚠ {t("shoots.conflictsTitle")} · {conflicts.length}
          </div>
          <ul className="space-y-1 text-xs text-rose-200/80">
            {conflicts.slice(0, 5).map((c, i) => (
              <li key={i}>
                {c.userName}: {c.shootA} & {c.shootB}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("shoots.stats.upcoming")} value={upcomingAll.length} tone="brand" />
        <Kpi label={t("shoots.stats.done")} value={shoots.filter((s) => s.status === "done").length} tone="positive" />
        <Kpi label={t("shoots.stats.cancelled")} value={shoots.filter((s) => s.status === "cancelled").length} tone="muted" />
        <Kpi label={t("shoots.stats.postponed")} value={shoots.filter((s) => s.status === "postponed").length} tone="accent" />
      </div>

      {/* Calendar */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("shoots.calendar.heading")}
        </h2>
        <CalendarView
          meetings={shoots.map((s) => ({
            id: s.id,
            clientName: s.title,
            meetingAt: s.shootDate,
            status: s.status,
          }))}
        />
      </section>

      {/* Upcoming list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("shoots.list.upcoming")}
        </h2>
        {upcomingAll.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
            {t("shoots.empty.upcoming")}
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingAll.map((s) => (
              <ShootCard
                key={s.id}
                shoot={s}
                locale={locale}
                t={t}
                canManage={canManage}
                users={users}
                projects={projects}
                equipment={equipment}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past list */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">
            {t("shoots.list.past")}
          </h2>
          <div className="space-y-2">
            {past.slice(0, 20).map((s) => (
              <ShootCard
                key={s.id}
                shoot={s}
                locale={locale}
                t={t}
                canManage={canManage}
                users={users}
                projects={projects}
                equipment={equipment}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type ShootWithIncludes = Awaited<
  ReturnType<typeof prisma.photoShoot.findMany>
>[number] & {
  project: { id: string; title: string } | null;
  crew: { user: { id: string; name: string } }[];
  equipment: {
    equipment: { id: string; name: string; category: string };
  }[];
};

function ShootCard({
  shoot,
  locale,
  t,
  canManage,
  users,
  projects,
  equipment,
}: {
  shoot: ShootWithIncludes;
  locale: "ar" | "en";
  t: (k: string) => string;
  canManage: boolean;
  users: { id: string; name: string; nickname: string | null }[];
  projects: { id: string; title: string }[];
  equipment: { id: string; name: string; category: string }[];
}) {
  const now = Date.now();
  const msUntil = new Date(shoot.shootDate).getTime() - now;
  const isSoon = shoot.status === "scheduled" && msUntil > 0 && msUntil <= 24 * 60 * 60_000;

  const statusTone =
    shoot.status === "scheduled"
      ? "border-sky-500/30 bg-sky-500/5"
      : shoot.status === "done"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : shoot.status === "postponed"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-zinc-700 bg-zinc-900/40 opacity-70";

  const statusBadge: Record<string, string> = {
    scheduled: "bg-sky-500/10 text-sky-400",
    done: "bg-emerald-500/10 text-emerald-400",
    cancelled: "bg-zinc-700/40 text-zinc-400",
    postponed: "bg-amber-500/10 text-amber-400",
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        statusTone,
        isSoon && "ring-1 ring-amber-500/30"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Link
              href={`/shoots/${shoot.id}`}
              className="text-base font-semibold text-zinc-100 transition hover:underline"
              style={{ textDecorationColor: "var(--color-brand)" }}
            >
              {shoot.title}
            </Link>
            {shoot.project && (
              <Link
                href={`/projects/${shoot.project.id}`}
                className="text-xs text-sky-400 hover:underline"
              >
                📁 {shoot.project.title}
              </Link>
            )}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px]",
                statusBadge[shoot.status] ?? "bg-zinc-700/40 text-zinc-400"
              )}
            >
              {t(`shoots.status.${shoot.status}`)}
            </span>
            {isSoon && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                ⚡ {t("shoots.soon")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {shoot.shootDate.toLocaleString(
                locale === "en" ? "en-US" : "en",
                {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                }
              )}
            </span>
            <span>⏱ {shoot.durationHours}{t("shoots.hoursShort")}</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {shoot.location}
            </span>
            {shoot.mapUrl && (
              <a
                href={shoot.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-zinc-200"
                style={{ color: "var(--color-accent)" }}
              >
                <ExternalLink className="h-3 w-3" />
                {t("shoots.openMap")}
              </a>
            )}
            <Link
              href={`/shoots/${shoot.id}`}
              className="flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800"
            >
              {t("shoots.viewDetails")}
            </Link>
          </div>
          {shoot.locationNotes && (
            <div className="mt-1 text-[11px] text-zinc-500">
              📍 {shoot.locationNotes}
            </div>
          )}
          {shoot.clientContact && (
            <div className="mt-1 text-[11px] text-zinc-500">
              📞 {shoot.clientContact}
            </div>
          )}

          {/* Crew chips */}
          {shoot.crew.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Users className="h-3 w-3" />
              </span>
              {shoot.crew.map((c) => (
                <span
                  key={c.user.id}
                  className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-[10px] text-zinc-300"
                >
                  {displayName(c.user)}
                </span>
              ))}
            </div>
          )}
          {/* Equipment chips */}
          {shoot.equipment.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Package className="h-3 w-3" />
              </span>
              {shoot.equipment.map((e) => (
                <span
                  key={e.equipment.id}
                  className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-[10px] text-zinc-300"
                >
                  {e.equipment.name}
                </span>
              ))}
            </div>
          )}

          {shoot.shotList && (
            <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">
                📋 {t("shoots.field.shotList")}:
              </span>{" "}
              {shoot.shotList}
            </div>
          )}
          {shoot.referenceUrl && (
            <div className="mt-1.5">
              <a
                href={shoot.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px]"
                style={{ color: "var(--color-accent)" }}
              >
                <ExternalLink className="h-3 w-3" />
                {t("shoots.openReference")}
              </a>
            </div>
          )}
        </div>

        {canManage && (
          <ShootActions
            shoot={shoot}
            users={users}
            projects={projects}
            equipment={equipment}
          />
        )}
      </div>
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
  tone: "brand" | "positive" | "muted" | "accent";
}) {
  const style =
    tone === "brand"
      ? { color: "var(--color-brand)" }
      : tone === "positive"
      ? { color: "#34d399" }
      : tone === "accent"
      ? { color: "var(--color-accent)" }
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

interface Conflict {
  userName: string;
  shootA: string;
  shootB: string;
}

/**
 * Two shoots conflict for a crew member if they overlap in time.
 * Overlap check: A starts before B ends, and B starts before A ends.
 */
function detectConflicts(
  shoots: {
    title: string;
    shootDate: Date;
    durationHours: number;
    crew: { user: { id: string; name: string } }[];
  }[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < shoots.length; i++) {
    for (let j = i + 1; j < shoots.length; j++) {
      const a = shoots[i];
      const b = shoots[j];
      const aStart = a.shootDate.getTime();
      const aEnd = aStart + a.durationHours * 3600_000;
      const bStart = b.shootDate.getTime();
      const bEnd = bStart + b.durationHours * 3600_000;
      if (aStart < bEnd && bStart < aEnd) {
        const aUsers = new Map(a.crew.map((c) => [c.user.id, displayName(c.user)]));
        for (const c of b.crew) {
          if (aUsers.has(c.user.id)) {
            conflicts.push({
              userName: aUsers.get(c.user.id)!,
              shootA: a.title,
              shootB: b.title,
            });
          }
        }
      }
    }
  }
  return conflicts;
}
