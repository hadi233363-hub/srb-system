"use client";

import { cn } from "@/lib/cn";
import { useSim } from "./sim-provider";
import { ARCHETYPE_LABELS, ROLE_LABELS } from "@/lib/sim/data";
import type { Agent, AgentStatus } from "@/lib/sim/types";

const statusMeta: Record<AgentStatus, { label: string; dot: string }> = {
  working: { label: "شغّال", dot: "bg-emerald-500 animate-pulse" },
  idle: { label: "فاضي", dot: "bg-zinc-600" },
  blocked: { label: "عالق", dot: "bg-amber-500" },
  absent: { label: "غايب", dot: "bg-amber-500" },
};

function deriveStatus(a: Agent): { label: string; dot: string } {
  if (!a.active) return { label: "استقال", dot: "bg-zinc-700" };
  if (a.status === "absent") return { label: "غايب", dot: "bg-amber-500" };
  if (a.morale < 25) return { label: "محبط", dot: "bg-rose-500" };
  if (a.status === "working") {
    const total = a.stats.tasksCompleted + a.stats.tasksFailed;
    if (total >= 3 && a.stats.tasksFailed / total > 0.5) {
      return { label: "محمّل زيادة", dot: "bg-rose-500" };
    }
    return statusMeta.working;
  }
  return statusMeta[a.status];
}

function moraleColor(morale: number): string {
  if (morale >= 70) return "bg-emerald-500";
  if (morale >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function findCurrentTask(
  projects: { tasks: { id: string; title: string; remainingHours: number }[] }[],
  taskId: string | null
): { title: string; remainingHours: number } | null {
  if (!taskId) return null;
  for (const p of projects) {
    const t = p.tasks.find((x) => x.id === taskId);
    if (t) return t;
  }
  return null;
}

export function LiveAgentGrid() {
  const { state } = useSim();

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <h3 className="text-sm font-semibold">الفريق</h3>
        {state && (
          <span className="text-xs text-zinc-500">
            {state.agents.filter((a) => a.active).length} نشط
            {state.counters.agentsQuit > 0 && (
              <span className="mr-1 text-rose-500">
                · {state.counters.agentsQuit} استقال
              </span>
            )}
          </span>
        )}
      </div>
      <ul className="divide-y divide-zinc-800/60">
        {!state && (
          <li className="px-5 py-8 text-center text-sm text-zinc-600">...</li>
        )}
        {state?.agents.map((a) => {
          const meta = deriveStatus(a);
          const currentTask = findCurrentTask(state.projects, a.currentTaskId);
          const dimmed = !a.active || a.status === "absent";
          return (
            <li
              key={a.id}
              className={cn(
                "px-5 py-3 transition",
                dimmed && "opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium">
                    {a.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-200">{a.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <span>{ROLE_LABELS[a.role]}</span>
                      <span className="text-zinc-700">·</span>
                      <span
                        className={cn(
                          a.archetype === "efficient" && "text-emerald-500/80",
                          a.archetype === "lazy" && "text-amber-500/80",
                          a.archetype === "perfectionist" && "text-blue-400/80",
                          a.archetype === "burnout_prone" && "text-rose-400/80",
                          a.archetype === "rookie" && "text-zinc-400",
                          a.archetype === "inconsistent" && "text-purple-400/80"
                        )}
                      >
                        {ARCHETYPE_LABELS[a.archetype]}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                  <span className="text-xs text-zinc-400">{meta.label}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-500">
                <span className="shrink-0">معنويات</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={cn("h-full transition-all duration-500", moraleColor(a.morale))}
                    style={{ width: `${a.morale}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 tabular-nums">{a.morale}</span>
              </div>

              {currentTask && (
                <div className="mt-1.5 truncate text-[11px] text-zinc-500">
                  ← {currentTask.title}
                  <span className="mx-1 text-zinc-700">·</span>
                  <span className="tabular-nums text-zinc-600">
                    {currentTask.remainingHours}س متبقية
                  </span>
                </div>
              )}

              {(a.stats.tasksCompleted > 0 || a.stats.tasksFailed > 0) && (
                <div className="mt-1 flex gap-2 text-[10px] text-zinc-600 tabular-nums">
                  <span className="text-emerald-500/70">✓ {a.stats.tasksCompleted}</span>
                  {a.stats.tasksFailed > 0 && (
                    <span className="text-rose-500/70">✗ {a.stats.tasksFailed}</span>
                  )}
                  {a.stats.tasksReworked > 0 && (
                    <span className="text-amber-500/70">↺ {a.stats.tasksReworked}</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
