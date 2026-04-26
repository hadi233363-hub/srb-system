import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Clock,
  MapPin,
  Users,
  Package,
  ExternalLink,
  Briefcase,
  FileText,
  Phone,
  Calendar as CalIcon,
  Download,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";
import { ShootActions } from "../shoot-actions";
import { isDeptLeadOrAbove } from "@/lib/auth/roles";

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-zinc-700/40 text-zinc-400 border-zinc-700",
  postponed: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const CONDITION_STYLE: Record<string, string> = {
  new: "text-emerald-400",
  good: "text-sky-400",
  fair: "text-amber-400",
  needs_repair: "text-orange-400",
  broken: "text-rose-400",
};

/**
 * Turn a Google Maps URL into an embeddable iframe src.
 * We keep it simple: if it's a maps.google.com or maps.app.goo.gl link with a
 * place or `q=` param, we fall back to the generic "q=<encoded location>" embed.
 * Otherwise we just return null and the UI shows a button link.
 */
function buildMapEmbed(rawLocation: string, mapUrl: string | null): string {
  // Use the text location as a search query — reliable across all Google links.
  const q = encodeURIComponent(rawLocation);
  return `https://www.google.com/maps?q=${q}&output=embed`;
}

export default async function ShootDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const user = session?.user;
  if (!user) return null;
  const canManage = isDeptLeadOrAbove(user.role);

  const shoot = await prisma.photoShoot.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true } },
      crew: {
        include: {
          user: {
            select: { id: true, name: true, email: true, jobTitle: true, role: true },
          },
        },
      },
      equipment: {
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
              category: true,
              brand: true,
              model: true,
              condition: true,
            },
          },
        },
      },
    },
  });

  if (!shoot) notFound();

  const now = new Date();
  const msUntil = shoot.shootDate.getTime() - now.getTime();
  const isUpcoming = shoot.status === "scheduled" && msUntil > 0;
  const isToday =
    shoot.shootDate.getDate() === now.getDate() &&
    shoot.shootDate.getMonth() === now.getMonth() &&
    shoot.shootDate.getFullYear() === now.getFullYear();

  const [users, projects, equipment] = canManage
    ? await Promise.all([
        prisma.user.findMany({
          where: { active: true },
          select: { id: true, name: true },
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
      ])
    : [[], [], []];

  const mapSrc = buildMapEmbed(shoot.location, shoot.mapUrl);
  const endsAt = new Date(
    shoot.shootDate.getTime() + shoot.durationHours * 3600_000
  );

  return (
    <div className="space-y-5">
      <Link
        href="/shoots"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowRight className="h-3 w-3" />
        {t("shoots.backToAll")}
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Camera
                className="h-4 w-4"
                style={{ color: "var(--color-brand)" }}
              />
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  STATUS_STYLE[shoot.status] ?? "border-zinc-700 text-zinc-400"
                )}
              >
                {t(`shoots.status.${shoot.status}`)}
              </span>
              {isToday && isUpcoming && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  ⚡ {t("shoots.today")}
                </span>
              )}
              {shoot.project && (
                <Link
                  href={`/projects/${shoot.project.id}`}
                  className="flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-sky-400 hover:bg-zinc-800"
                >
                  <Briefcase className="h-2.5 w-2.5" />
                  {shoot.project.title}
                </Link>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-zinc-100">
              {shoot.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/shoots/${shoot.id}/ics`}
              download={`shoot-${shoot.id}.ics`}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5" />
              {t("shoots.addToCalendar")}
            </a>
            {canManage && (
              <ShootActions
                shoot={{
                  id: shoot.id,
                  title: shoot.title,
                  projectId: shoot.projectId,
                  shootDate: shoot.shootDate,
                  durationHours: shoot.durationHours,
                  location: shoot.location,
                  locationNotes: shoot.locationNotes,
                  mapUrl: shoot.mapUrl,
                  clientContact: shoot.clientContact,
                  shotList: shoot.shotList,
                  referenceUrl: shoot.referenceUrl,
                  notes: shoot.notes,
                  status: shoot.status,
                  crew: shoot.crew.map((c) => ({
                    user: { id: c.user.id, name: c.user.name },
                  })),
                  equipment: shoot.equipment.map((e) => ({
                    equipment: {
                      id: e.equipment.id,
                      name: e.equipment.name,
                      category: e.equipment.category,
                    },
                  })),
                }}
                users={users}
                projects={projects}
                equipment={equipment}
              />
            )}
          </div>
        </div>

        {/* Key stats row */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-800 pt-4 md:grid-cols-3">
          <InfoBlock
            icon={CalIcon}
            label={t("shoots.field.date")}
            primary={shoot.shootDate.toLocaleString(
              locale === "en" ? "en-US" : "en",
              {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }
            )}
            secondary={`⏱ ${shoot.durationHours}${t(
              "shoots.hoursShort"
            )} · ${t("shoots.endsAt")} ${endsAt.toLocaleTimeString(
              locale === "en" ? "en-US" : "en",
              { hour: "2-digit", minute: "2-digit", hour12: true }
            )}`}
          />
          <InfoBlock
            icon={Users}
            label={t("shoots.field.crew")}
            primary={`${shoot.crew.length} ${t("shoots.crewCount")}`}
            secondary={
              shoot.crew.length > 0
                ? shoot.crew.map((c) => c.user.name).join(" · ")
                : t("shoots.noCrew")
            }
          />
          <InfoBlock
            icon={Package}
            label={t("shoots.field.equipment")}
            primary={`${shoot.equipment.length} ${t("shoots.itemsCount")}`}
            secondary={
              shoot.equipment.length > 0
                ? shoot.equipment.map((e) => e.equipment.name).join(" · ")
                : t("shoots.noEquipment")
            }
          />
        </div>
      </div>

      {/* Location + Map */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <MapPin
                className="h-4 w-4"
                style={{ color: "var(--color-brand)" }}
              />
              {t("shoots.field.location")}
            </div>
            <div className="text-lg font-semibold text-zinc-100">
              {shoot.location}
            </div>
            {shoot.locationNotes && (
              <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
                📍 {shoot.locationNotes}
              </div>
            )}
            {shoot.clientContact && (
              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
                <Phone
                  className="h-3 w-3"
                  style={{ color: "var(--color-accent)" }}
                />
                {shoot.clientContact}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {shoot.mapUrl && (
                <a
                  href={shoot.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:opacity-90"
                  style={{ background: "var(--color-brand)" }}
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("shoots.openInMaps")}
                </a>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  shoot.location
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                <MapPin className="h-3 w-3" />
                {t("shoots.getDirections")}
              </a>
            </div>
          </div>
        </div>

        {/* Embedded map — uses text location as search query (works without an API key) */}
        <div className="lg:col-span-3">
          <div className="h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <iframe
              title="Map"
              src={mapSrc}
              className="h-full min-h-[240px] w-full"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>

      {/* Crew detail */}
      {shoot.crew.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Users
              className="h-4 w-4"
              style={{ color: "var(--color-brand)" }}
            />
            {t("shoots.field.crew")} · {shoot.crew.length}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shoot.crew.map((c) => (
              <Link
                key={c.user.id}
                href={`/team/${c.user.id}`}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                  {c.user.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-100">
                    {c.user.name}
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {c.user.jobTitle ?? t(`role.${c.user.role}`)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Equipment detail */}
      {shoot.equipment.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Package
              className="h-4 w-4"
              style={{ color: "var(--color-brand)" }}
            />
            {t("shoots.field.equipment")} · {shoot.equipment.length}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shoot.equipment.map((e) => (
              <div
                key={e.equipment.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-100">
                      {e.equipment.name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      {[e.equipment.brand, e.equipment.model]
                        .filter(Boolean)
                        .join(" · ") || t(`equipment.category.${e.equipment.category}`)}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[10px]",
                      CONDITION_STYLE[e.equipment.condition] ?? "text-zinc-500"
                    )}
                  >
                    {t(`equipment.condition.${e.equipment.condition}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shot list */}
      {shoot.shotList && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <FileText
              className="h-4 w-4"
              style={{ color: "var(--color-brand)" }}
            />
            {t("shoots.field.shotList")}
          </div>
          <div className="whitespace-pre-wrap text-sm text-zinc-300">
            {shoot.shotList}
          </div>
        </section>
      )}

      {/* Reference */}
      {shoot.referenceUrl && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-2 text-sm font-semibold text-zinc-200">
            {t("shoots.openReference")}
          </div>
          <a
            href={shoot.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: "var(--color-accent)" }}
          >
            <ExternalLink className="h-4 w-4" />
            {shoot.referenceUrl}
          </a>
        </section>
      )}

      {/* Notes */}
      {shoot.notes && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-2 text-sm font-semibold text-zinc-200">
            {t("shoots.field.notes")}
          </div>
          <div className="whitespace-pre-wrap text-sm text-zinc-300">
            {shoot.notes}
          </div>
        </section>
      )}

      {/* Reminder status */}
      {shoot.status === "scheduled" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 text-sm font-semibold text-zinc-200">
            {t("shoots.reminders.title")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReminderStatus
              label={t("shoots.reminders.dayBefore")}
              sentAt={shoot.reminderDayBeforeSentAt}
              t={t}
              locale={locale}
            />
            <ReminderStatus
              label={t("shoots.reminders.hourBefore")}
              sentAt={shoot.reminderHourBeforeSentAt}
              t={t}
              locale={locale}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  primary,
  secondary,
}: {
  icon: typeof Clock;
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{primary}</div>
      {secondary && (
        <div className="mt-0.5 text-[11px] text-zinc-500">{secondary}</div>
      )}
    </div>
  );
}

function ReminderStatus({
  label,
  sentAt,
  t,
  locale,
}: {
  label: string;
  sentAt: Date | null;
  t: (k: string) => string;
  locale: "ar" | "en";
}) {
  if (sentAt) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-emerald-300">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="text-xs font-semibold">{label}</div>
          <div className="text-[11px] opacity-80">
            {t("shoots.reminders.sentAt")}{" "}
            {new Date(sentAt).toLocaleString(
              locale === "en" ? "en-US" : "en",
              { hour: "2-digit", minute: "2-digit", hour12: true, day: "numeric", month: "short" }
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-400">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-[11px] text-zinc-500">
          {t("shoots.reminders.pending")}
        </div>
      </div>
    </div>
  );
}
