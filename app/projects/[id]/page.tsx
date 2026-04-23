import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  DollarSign,
  Users as UsersIcon,
} from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";
import {
  PRIORITY_COLOR,
  PROJECT_STATUS_COLOR,
  formatDate,
  formatQar,
  isOverdue,
} from "@/lib/db/helpers";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { ProjectMembersManager } from "./members-manager";
import { ProjectActionsMenu } from "./project-actions-menu";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { InvoiceBadge } from "@/components/projects/invoice-badge";

export default async function ProjectDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const canManage =
    session?.user.role === "admin" || session?.user.role === "manager";

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      lead: { select: { id: true, name: true, email: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              jobTitle: true,
              department: true,
            },
          },
        },
      },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
          collaborators: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      },
    },
  });

  if (!project) notFound();

  const allUsers = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
      department: true,
    },
    orderBy: { name: "asc" },
  });

  const overdue = isOverdue(project.deadlineAt, project.status);
  const tasksOverdue = project.tasks.filter(
    (t) => t.dueAt && t.dueAt.getTime() < Date.now() && t.status !== "done"
  ).length;
  const tasksDone = project.tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowRight className="h-3 w-3" />
        {t("projects.allProjects")}
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-emerald-400" />
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  PROJECT_STATUS_COLOR[project.status]
                )}
              >
                {t(`projectStatus.${project.status}`)}
              </span>
              <span className={cn("text-[11px]", PRIORITY_COLOR[project.priority])}>
                ● {t("projects.priorityPrefix")} {t(`priority.${project.priority}`)}
              </span>
              {project.type && (
                <span className="text-[11px] text-zinc-500">
                  {t(`projectType.${project.type}`)}
                </span>
              )}
              {project.billingType === "monthly" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
                  🔁 {t("billing.monthly")}
                </span>
              ) : (
                <span className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-500">
                  {t("billing.one_time")}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-zinc-100">{project.title}</h1>
            {project.client && (
              <div className="mt-1 text-sm text-zinc-400">
                {t("projects.field.client")}: {project.client.name}
              </div>
            )}
            {project.description && (
              <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                {project.description}
              </p>
            )}
          </div>
          {canManage && (
            <ProjectActionsMenu
              projectId={project.id}
              currentStatus={project.status}
              currentPriority={project.priority}
              currentTitle={project.title}
              currentBudget={project.budgetQar}
              currentDeadline={project.deadlineAt}
              currentProgress={project.progressPct}
              currentDescription={project.description}
              currentBillingType={project.billingType}
            />
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3 md:grid-cols-4">
          <Stat
            icon={DollarSign}
            label={project.billingType === "monthly" ? t("projects.monthlyBudget") : t("projects.budget")}
            value={formatQar(project.budgetQar, { locale })}
            subtext={project.billingType === "monthly" ? t("projects.perMonthSubtext") : undefined}
          />
          <Stat
            icon={Calendar}
            label={t("projects.deadline")}
            value={formatDate(project.deadlineAt, locale)}
            tone={overdue ? "danger" : undefined}
          />
          <Stat
            icon={UsersIcon}
            label={t("kpi.teamSize")}
            value={`${project.members.length} ${t("common.activeEmployees")}`}
          />
          <Stat
            label={t("projects.progressLabel")}
            value={`${project.progressPct}%`}
            subtext={`${tasksDone}/${project.tasks.length} ${t("tasks.tasksCompletedShort")}`}
            tone={tasksOverdue > 0 ? "danger" : undefined}
          />
        </div>
        {tasksOverdue > 0 && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-xs text-rose-400">
            ⚠ {tasksOverdue} {t("projects.overdueTasksMsg")}
          </div>
        )}

        {project.billingType === "monthly" && project.nextInvoiceDueAt && (
          <div className="mt-3">
            <InvoiceBadge
              projectId={project.id}
              budgetQar={project.budgetQar}
              nextInvoiceDueAt={project.nextInvoiceDueAt}
              locale={locale}
              size="full"
            />
          </div>
        )}
      </div>

      {/* Members */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("kpi.teamSize")} ({project.members.length})
          </h2>
          {canManage && (
            <ProjectMembersManager
              projectId={project.id}
              currentMembers={project.members.map((m) => ({
                userId: m.userId,
                role: m.role,
                user: m.user,
              }))}
              allUsers={allUsers}
            />
          )}
        </div>
        {project.members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
            {t("projects.noMembers")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {project.members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                  {m.user.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-100">{m.user.name}</div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {m.role ? m.role : m.user.jobTitle || m.user.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tasks Kanban */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("page.tasks.title")} ({project.tasks.length})
          </h2>
          <NewTaskButton
            users={allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
            defaultProjectId={project.id}
            label={t("projects.addTaskToProject")}
          />
        </div>
        {project.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
            {t("projects.noTasksYet")}
          </div>
        ) : (
          <KanbanBoard
            tasks={project.tasks.map((t) => ({
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
            users={allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
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
      <div className={cn("mt-1 text-sm font-semibold tabular-nums", color)}>
        {value}
      </div>
      {subtext && <div className="text-[10px] text-zinc-600">{subtext}</div>}
    </div>
  );
}
