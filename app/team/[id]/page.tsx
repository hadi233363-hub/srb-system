import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  DollarSign,
  KanbanSquare,
  Mail,
  Phone,
} from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";
import {
  PROJECT_STATUS_COLOR,
  formatDate,
  formatQar,
  isOverdue,
} from "@/lib/db/helpers";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { displayName } from "@/lib/display";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

export default async function EmployeeDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const isAdmin = session?.user.role === "admin";

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          project: {
            select: {
              id: true,
              title: true,
              status: true,
              deadlineAt: true,
              progressPct: true,
              clientId: true,
              client: { select: { name: true } },
            },
          },
        },
      },
      tasksAssigned: {
        include: {
          assignee: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
          collaborators: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      },
      taskCollaborations: {
        include: {
          task: {
            include: {
              assignee: { select: { id: true, name: true } },
              project: { select: { id: true, title: true } },
              collaborators: {
                include: { user: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      badges: {
        include: { badge: true },
        orderBy: { badge: { sortOrder: "asc" } },
      },
    },
  });

  if (!user) notFound();

  const allUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, nickname: true },
    orderBy: { name: "asc" },
  });

  const allProjects = await prisma.project.findMany({
    where: { status: { in: ["active", "on_hold"] } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  // Combine tasks where user is primary assignee + tasks where user is a collaborator.
  // Dedupe by task id (a task could have user as primary AND collaborator in theory).
  const tasksMap = new Map<string, (typeof user.tasksAssigned)[number]>();
  for (const t of user.tasksAssigned) tasksMap.set(t.id, t);
  for (const c of user.taskCollaborations) {
    if (!tasksMap.has(c.task.id)) {
      tasksMap.set(c.task.id, c.task as (typeof user.tasksAssigned)[number]);
    }
  }
  const allTasks = Array.from(tasksMap.values());

  const openTasks = allTasks.filter(
    (t) => t.status !== "done" && t.status !== "blocked"
  );
  const overdueTasks = allTasks.filter((t) => isOverdue(t.dueAt, t.status));
  const doneTasks = allTasks.filter((t) => t.status === "done");

  const totalEstimated = allTasks.reduce(
    (s, t) => s + (t.estimatedHours ?? 0),
    0
  );

  const activeProjects = user.memberships.filter(
    (m) => m.project.status === "active" || m.project.status === "on_hold"
  );

  const roleColor =
    user.role === "admin"
      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
      : user.role === "manager"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : user.role === "department_head"
      ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

  return (
    <div className="space-y-6">
      <Link
        href="/team"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowRight className="h-3 w-3" />
        {t("team.allTeam")}
      </Link>

      {/* Profile */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-2xl font-bold text-zinc-100">
            {displayName(user)[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-100">{displayName(user)}</h1>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", roleColor)}>
                {t(`role.${user.role}`) ?? user.role}
              </span>
              {!user.active && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                  {t("team.label.disabled")}
                </span>
              )}
            </div>
            {user.jobTitle && (
              <div className="mt-1 text-sm text-zinc-400">{user.jobTitle}</div>
            )}
            {user.department && (
              <div className="text-xs text-zinc-500">{user.department}</div>
            )}
            {user.badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.badges.map((ub) => (
                  <span
                    key={ub.badgeId}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
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
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
              {/* Real email is president-only. */}
              {isAdmin && (
                <span className="flex items-center gap-1.5" dir="ltr">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </span>
              )}
              {user.phone && (
                <span className="flex items-center gap-1.5" dir="ltr">
                  <Phone className="h-3 w-3" />
                  {user.phone}
                </span>
              )}
              {user.hiredAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {t("team.hiredLabel")}: {formatDate(user.hiredAt, locale)}
                </span>
              )}
              {isAdmin && user.salaryQar && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <DollarSign className="h-3 w-3" />
                  {formatQar(user.salaryQar, { locale })}
                  {t("team.salarySuffix.ar")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 md:grid-cols-4">
          <Stat icon={Briefcase} label={t("kpi.activeProjects")} value={String(activeProjects.length)} />
          <Stat
            icon={KanbanSquare}
            label={t("kpi.openTasks")}
            value={String(openTasks.length)}
          />
          <Stat
            icon={AlertCircle}
            label={t("kpi.overdueTasks")}
            value={String(overdueTasks.length)}
            tone={overdueTasks.length > 0 ? "danger" : undefined}
          />
          <Stat
            label={t("team.estimatedHours")}
            value={`${totalEstimated}h`}
            subtext={t("team.completedCount").replace("{n}", String(doneTasks.length))}
          />
        </div>
      </div>

      {/* Projects the user is in */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          {t("team.projectsCount").replace("{n}", String(user.memberships.length))}
        </h2>
        {user.memberships.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
            {t("team.noMemberAssigned")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {user.memberships.map((m) => (
              <Link
                key={m.projectId}
                href={`/projects/${m.projectId}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 transition hover:border-emerald-500/40 hover:bg-zinc-900/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {m.project.title}
                    </div>
                    {m.project.client && (
                      <div className="truncate text-xs text-zinc-500">
                        {m.project.client.name}
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                      PROJECT_STATUS_COLOR[m.project.status]
                    )}
                  >
                    {t(`projectStatus.${m.project.status}`)}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-zinc-500">
                  {t("team.member.role")}: {m.role || t("team.member.default")}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-sky-500"
                    style={{ width: `${m.project.progressPct}%` }}
                  />
                </div>
                {m.project.deadlineAt && (
                  <div className="mt-1 text-[10px] text-zinc-600 tabular-nums">
                    {t("projects.deadline")}: {formatDate(m.project.deadlineAt, locale)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Tasks Kanban */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("team.tasksCount").replace("{n}", String(allTasks.length))}
          </h2>
          <div className="text-xs text-zinc-500">
            {t("team.tasks.hint")}
          </div>
        </div>
        {allTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
            {t("team.tasks.none")}
          </div>
        ) : (
          <KanbanBoard
            tasks={allTasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              dueAt: t.dueAt,
              assignee: t.assignee,
              project: t.project,
              estimatedHours: t.estimatedHours,
              collaborators: t.collaborators,
            }))}
            users={allUsers}
            projects={allProjects}
            allowProjectChange
          />
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  subtext,
  tone,
}: {
  icon?: typeof Briefcase;
  label: string;
  value: string;
  subtext?: string;
  tone?: "danger";
}) {
  const color = tone === "danger" ? "text-rose-400" : "text-zinc-100";
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", color)}>
        {value}
      </div>
      {subtext && <div className="text-[10px] text-zinc-600">{subtext}</div>}
    </div>
  );
}
