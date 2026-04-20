import { prisma } from "@/lib/db/prisma";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { KanbanSquare } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

export default async function TasksPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(key, locale);

  const [tasks, users, projects] = await Promise.all([
    prisma.task.findMany({
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
        collaborators: {
          include: { user: { select: { id: true, name: true } } },
        },
        _count: { select: { comments: true } },
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { status: { in: ["active", "on_hold"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const overdueCount = tasks.filter(
    (t) =>
      t.dueAt &&
      t.dueAt.getTime() < Date.now() &&
      t.status !== "done" &&
      t.status !== "cancelled"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("page.tasks.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {tasks.length} {t("tasks.count")}
            {overdueCount > 0 && (
              <span className="mx-1 text-rose-400">
                ·{" "}
                <span className="font-semibold">
                  {overdueCount} {t("tasks.overdue")}
                </span>
              </span>
            )}
            <span className="mx-2 text-zinc-600">· {t("tasks.clickToEdit")}</span>
          </p>
        </div>
        <NewTaskButton users={users} projects={projects} />
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <KanbanSquare className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("tasks.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">
            {t("tasks.empty.desc.full")}
          </p>
        </div>
      ) : (
        <KanbanBoard
          tasks={tasks.map((t) => ({
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
          users={users}
          projects={projects}
          allowProjectChange
        />
      )}
    </div>
  );
}
