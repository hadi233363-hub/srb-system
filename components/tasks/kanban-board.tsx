"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Clock, User as UserIcon, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  TASK_STATUS_COLOR,
  PRIORITY_COLOR,
  isOverdue,
  daysUntil,
} from "@/lib/db/helpers";
import { updateTaskStatusAction } from "@/app/tasks/actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { TaskDetailModal, type TaskDetail, type UserLite, type ProjectLite } from "./task-detail-modal";
import type { SubmissionLite } from "./task-submission-section";

export interface KanbanTask extends TaskDetail {
  _count?: { comments: number };
}

const COLUMNS = ["todo", "in_progress", "in_review", "done"] as const;

interface Viewer {
  id: string;
  isOwner: boolean;
}

interface Props {
  tasks: KanbanTask[];
  users: UserLite[];
  projects?: ProjectLite[];
  allowProjectChange?: boolean;
  viewer?: Viewer;
}

export function KanbanBoard({ tasks, users, projects, allowProjectChange, viewer }: Props) {
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<KanbanTask | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionLite[]>([]);
  const t = useT();
  const { locale } = useLocale();

  const openTaskId = openTask?.id;
  useEffect(() => {
    if (!openTaskId) return;
    const ctrl = new AbortController();
    fetch(`/api/tasks/${openTaskId}/submissions`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setSubmissions(data.items ?? []))
      .catch(() => {
        // Aborted or network failure — leave the list as-is.
      });
    return () => ctrl.abort();
  }, [openTaskId]);

  const grouped: Record<string, KanbanTask[]> = {
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
    blocked: [],
  };
  for (const t of tasks) {
    (grouped[t.status] ??= []).push(t);
  }

  const moveTo = (taskId: string, newStatus: string) => {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, newStatus);
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = grouped[col] ?? [];
          const overdueCount = items.filter((t) =>
            isOverdue(t.dueAt, t.status)
          ).length;
          return (
            <div
              key={col}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging) {
                  moveTo(dragging, col);
                  setDragging(null);
                }
              }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      col === "todo"
                        ? "bg-zinc-500"
                        : col === "in_progress"
                        ? "bg-sky-500"
                        : col === "in_review"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    )}
                  />
                  <h3 className="text-sm font-semibold text-zinc-200">
                    {t(`taskStatus.${col}`)}
                  </h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {items.length}
                  </span>
                </div>
                {overdueCount > 0 && (
                  <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400">
                    {overdueCount} {t("tasks.overdue")}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-[11px] text-zinc-600">
                    {t("tasks.kanban.empty")}
                  </div>
                ) : (
                  items.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => setOpenTask(task)}
                      t={t}
                      locale={locale}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openTask && (
        <TaskDetailModal
          task={openTask}
          users={users}
          projects={projects}
          allowProjectChange={allowProjectChange}
          onClose={() => setOpenTask(null)}
          viewer={viewer}
          submissions={submissions}
        />
      )}
    </>
  );
}

function TaskCard({
  task,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
  t,
  locale,
}: {
  task: KanbanTask;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onClick?: () => void;
  t: (key: string) => string;
  locale: "ar" | "en";
}) {
  const overdue = isOverdue(task.dueAt, task.status);
  const days = daysUntil(task.dueAt);
  const collaboratorCount = task.collaborators?.length ?? 0;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border-2 bg-zinc-950/40 p-3 transition hover:bg-zinc-900/60",
        overdue
          ? "border-rose-500/60 bg-rose-500/5 shadow-[0_0_0_1px_rgba(244,63,94,0.15)]"
          : TASK_STATUS_COLOR[task.status]
      )}
    >
      {overdue && (
        <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-rose-400">
          <AlertCircle className="h-3 w-3" />
          {t("tasks.overdueByDays").replace("{n}", String(Math.abs(days ?? 0)))}
        </div>
      )}
      <div className="mb-1 text-sm font-medium text-zinc-100">{task.title}</div>
      {task.description && (
        <div className="mb-2 line-clamp-2 text-[11px] text-zinc-500">
          {task.description}
        </div>
      )}
      {task.project && (
        <div className="mb-2 truncate text-[10px] text-sky-400">
          📁 {task.project.title}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          {task.assignee ? (
            <span className="flex items-center gap-1 text-zinc-400">
              <UserIcon className="h-3 w-3" />
              {task.assignee.name}
            </span>
          ) : (
            <span className="text-zinc-600">{t("tasks.unassigned")}</span>
          )}
          {collaboratorCount > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-400">
              <Users className="h-2.5 w-2.5" />
              +{collaboratorCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("tabular-nums", PRIORITY_COLOR[task.priority])}>
            ●
          </span>
          {task.dueAt && (
            <span
              className={cn(
                "flex items-center gap-0.5 tabular-nums",
                overdue ? "text-rose-400 font-semibold" : "text-zinc-500"
              )}
            >
              <Clock className="h-3 w-3" />
              {new Date(task.dueAt).toLocaleDateString(
                locale === "en" ? "en-US" : "en",
                { month: "short", day: "numeric" }
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
