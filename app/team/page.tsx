import Link from "next/link";
import { AlertCircle, ChevronLeft, ChevronRight, Mail, Phone, Users } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { formatQar, isOverdue } from "@/lib/db/helpers";
import { cn } from "@/lib/cn";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

export default async function TeamPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const Chevron = locale === "ar" ? ChevronLeft : ChevronRight;
  const isAdmin = session?.user.role === "admin";

  const users = await prisma.user.findMany({
    where: { active: true },
    include: {
      memberships: {
        include: {
          project: {
            select: { id: true, title: true, status: true },
          },
        },
      },
      tasksAssigned: {
        where: { status: { in: ["todo", "in_progress", "in_review"] } },
        select: { id: true, status: true, dueAt: true, title: true },
      },
      badges: {
        include: { badge: true },
        orderBy: { badge: { sortOrder: "asc" } },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("page.team.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {users.length} {t("team.count")} · {t("page.team.subtitle")}
        </p>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Users className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("team.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">{t("team.empty.desc")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((u) => {
            const activeProjects = u.memberships.filter(
              (m) => m.project.status === "active" || m.project.status === "on_hold"
            );
            const openTasks = u.tasksAssigned.length;
            const overdueTasks = u.tasksAssigned.filter((t) =>
              isOverdue(t.dueAt, t.status)
            ).length;

            const roleColor =
              u.role === "admin"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : u.role === "manager"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

            return (
              <Link
                key={u.id}
                href={`/team/${u.id}`}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-900/60"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-lg font-semibold text-zinc-200">
                      {u.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-zinc-100">
                        {u.name}
                      </div>
                      {u.jobTitle && (
                        <div className="text-[11px] text-zinc-500">
                          {u.jobTitle}
                        </div>
                      )}
                      {u.department && (
                        <div className="text-[10px] text-zinc-600">
                          {u.department}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", roleColor)}>
                    {t(`role.${u.role}`)}
                  </span>
                </div>

                <div className="mb-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500" dir="ltr">
                    <Mail className="h-3 w-3" />
                    {u.email}
                  </div>
                  {u.phone && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500" dir="ltr">
                      <Phone className="h-3 w-3" />
                      {u.phone}
                    </div>
                  )}
                </div>

                {u.badges.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {u.badges.map((ub) => (
                      <span
                        key={ub.badgeId}
                        className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px]"
                        style={{
                          borderColor: ub.badge.colorHex + "55",
                          backgroundColor: ub.badge.colorHex + "15",
                          color: ub.badge.colorHex,
                        }}
                      >
                        <span>{ub.badge.icon}</span>
                        <span>
                          {locale === "ar" ? ub.badge.labelAr : ub.badge.labelEn}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Workload */}
                <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
                  <StatMini label={t("team.stats.projects")} value={String(activeProjects.length)} />
                  <StatMini
                    label={t("team.stats.openTasks")}
                    value={String(openTasks)}
                    tone={openTasks > 10 ? "warn" : "default"}
                  />
                  <StatMini
                    label={t("team.stats.overdue")}
                    value={String(overdueTasks)}
                    tone={overdueTasks > 0 ? "danger" : "default"}
                  />
                </div>

                {isAdmin && u.salaryQar && (
                  <div className="mt-2 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500 tabular-nums">
                    {t("team.salary")}: {formatQar(u.salaryQar, { locale })}/
                    {locale === "ar" ? "شهر" : "mo"}
                  </div>
                )}

                {overdueTasks > 0 && (
                  <div className="mt-3 flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[10px] text-rose-400">
                    <AlertCircle className="h-3 w-3" />
                    {overdueTasks} {t("team.overdueBadge")}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-end text-[11px] text-zinc-500 opacity-0 transition group-hover:opacity-100">
                  <span className="flex items-center gap-0.5 text-emerald-400">
                    <Chevron className="h-3 w-3" />
                    {t("team.viewDetails")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatMini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-rose-400"
      : tone === "warn"
      ? "text-amber-400"
      : "text-zinc-100";
  return (
    <div className="text-center">
      <div className={cn("text-lg font-bold tabular-nums", toneClass)}>{value}</div>
      <div className="text-[9px] text-zinc-500">{label}</div>
    </div>
  );
}
