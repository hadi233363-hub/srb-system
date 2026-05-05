"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, BarChart2, Clock, User as UserIcon, Users, X } from "lucide-react";
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

interface EmployeeStats {
  userId: string;
  userName: string;
  completedThisWeek: number;
  completedThisMonth: number;
  overdue: number;
  total: number;
  completionRate: number;
}

function calcEmployeeStats(userId: string, userName: string, tasks: KanbanTask[]): EmployeeStats {
  const userTasks = tasks.filter((t) => t.assignee?.id === userId);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const completedThisWeek = userTasks.filter(
    (t) => t.status === "done" && t.completedAt && new Date(t.completedAt) >= weekAgo
  ).length;
  const completedThisMonth = userTasks.filter(
    (t) => t.status === "done" && t.completedAt && new Date(t.completedAt) >= monthAgo
  ).length;
  const overdueCount = userTasks.filter((t) => isOverdue(t.dueAt, t.status)).length;
  const total = userTasks.filter((t) => t.status !== "cancelled").length;
  const done = userTasks.filter((t) => t.status === "done").length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  return { userId, userName, completedThisWeek, completedThisMonth, overdue: overdueCount, total, completionRate };
}

export function KanbanBoard({ tasks, users, projects, allowProjectChange, viewer }: Props) {
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<KanbanTask | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionLite[]>([]);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [statsUserId, setStatsUserId] = useState<string | null>(null);
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

  const filteredTasks = filterUserId
    ? tasks.filter((t) => t.assignee?.id === filterUserId)
    : tasks;

  const grouped: Record<string, KanbanTask[]> = {
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
    blocked: [],
  };
  for (const task of filteredTasks) {
    (grouped[task.status] ??= []).push(task);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const threeDaysLater = new Date(todayStart.getTime() + 4 * 24 * 60 * 60 * 1000);

  const upcoming = filteredTasks
    .filter((t) => {
      if (!t.dueAt) return false;
      if (t.status === "done" || t.status === "cancelled") return false;
      const due = new Date(t.dueAt);
      return due >= todayStart && due < threeDaysLater;
    })
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());

  const moveTo = (taskId: string, newStatus: string) => {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, newStatus);
    });
  };

  const statsUser = statsUserId ? users.find((u) => u.id === statsUserId) : null;
  const stats = statsUser ? calcEmployeeStats(statsUser.id, statsUser.name, tasks) : null;

  return (
    <>
      {/* Employee filter bar */}
      {users.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
          <span className="text-xs text-zinc-500">{t("tasks.filter.label")}</span>
          <button
            onClick={() => setFilterUserId(null)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs transition",
              filterUserId === null
                ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                : "border border-zinc-700 text-zinc-400 hover:border-zinc-500"
            )}
          >
            {t("tasks.filter.all")}
          </button>
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-1">
              <button
                onClick={() => setFilterUserId(filterUserId === u.id ? null : u.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs transition",
                  filterUserId === u.id
                    ? "border border-sky-500/30 bg-sky-500/20 text-sky-300"
                    : "border border-zinc-700 text-zinc-400 hover:border-zinc-500"
                )}
              >
                {u.name}
              </button>
              <button
                onClick={() => setStatsUserId(u.id)}
                title={t("tasks.stats.viewFor").replace("{name}", u.name)}
                className="rounded-full p-1 text-zinc-600 transition hover:text-zinc-300"
              >
                <BarChart2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming deliveries */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">
              {t("tasks.upcoming.title")}
            </h3>
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
              {upcoming.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcoming.map((task) => {
              const due = new Date(task.dueAt!);
              const isToday = due.toDateString() === new Date().toDateString();
              const daysLeft = Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
              return (
                <button
                  key={task.id}
                  onClick={() => setOpenTask(task)}
                  className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] text-zinc-300 transition hover:border-amber-400/40"
                >
                  <span className="font-medium">{task.title}</span>
                  {task.assignee && (
                    <span className="text-zinc-500">· {task.assignee.name}</span>
                  )}
                  <span
                    className={cn(
                      "font-semibold",
                      isToday ? "text-rose-400" : "text-amber-400"
                    )}
                  >
                    {isToday
                      ? t("tasks.upcoming.today")
                      : locale === "ar"
                      ? `${daysLeft} أيام`
                      : `${daysLeft}d`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = grouped[col] ?? [];
          const overdueCount = items.filter((t) => isOverdue(t.dueAt, t.status)).length;
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
                  {col === "in_review" ? (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        col === "todo"
                          ? "bg-zinc-500"
                          : col === "in_progress"
                          ? "bg-sky-500"
                          : "bg-emerald-500"
                      )}
                    />
                  )}
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

      {/* Employee stats modal */}
      {stats && statsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-100">{statsUser.name}</h3>
                <p className="text-xs text-zinc-500">{t("tasks.stats.title")}</p>
              </div>
              <button
                onClick={() => setStatsUserId(null)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={t("tasks.stats.completedWeek")}
                value={stats.completedThisWeek}
                color="text-emerald-400"
              />
              <StatCard
                label={t("tasks.stats.completedMonth")}
                value={stats.completedThisMonth}
                color="text-sky-400"
              />
              <StatCard
                label={t("tasks.stats.overdue")}
                value={stats.overdue}
                color={stats.overdue > 0 ? "text-rose-400" : "text-zinc-400"}
              />
              <StatCard
                label={t("tasks.stats.completionRate")}
                value={`${stats.completionRate}%`}
                color="text-amber-400"
              />
            </div>
            <div className="mt-4 border-t border-zinc-800 pt-3">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{t("tasks.stats.totalTasks")}</span>
                <span className="text-zinc-300">{stats.total}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-center">
      <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
      <div className="mt-0.5 text-[10px] text-zinc-500">{label}</div>
    </div>
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
      {task.status === "in_review" && !overdue && (
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-amber-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          {t("submission.inReviewBadge")}
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
          <span className={cn("tabular-nums", PRIORITY_COLOR[task.priority])}>●</span>
          {task.dueAt && (
            <span
              className={cn(
                "flex items-center gap-0.5 tabular-nums",
                overdue ? "font-semibold text-rose-400" : "text-zinc-500"
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
