"use client";

import { useSim } from "./sim-provider";
import { formatQAR } from "@/lib/format";
import { cn } from "@/lib/cn";

export function LiveAtRisk() {
  const { state } = useSim();

  if (!state) return null;

  const now = state.simTime;
  const atRisk = state.projects
    .filter((p) => p.status === "active" || p.status === "delayed")
    .map((p) => {
      const hoursToDeadline = (p.deadline - now) / (60 * 60 * 1000);
      const pending = p.tasks.filter(
        (t) => t.status !== "done" && t.status !== "failed"
      ).length;
      const failedTasks = p.tasks.filter((t) => t.status === "failed").length;
      const overrun = p.actualCost / Math.max(1, p.costEstimate);
      return { project: p, hoursToDeadline, pending, failedTasks, overrun };
    })
    .filter(
      (x) =>
        x.hoursToDeadline < 72 ||
        x.project.status === "delayed" ||
        x.failedTasks > 0 ||
        x.overrun > 1.1 ||
        x.project.crisisCount > 0 ||
        x.project.priority === "urgent"
    )
    .sort((a, b) => {
      const prio =
        (b.project.priority === "urgent" ? 1 : 0) -
        (a.project.priority === "urgent" ? 1 : 0);
      if (prio !== 0) return prio;
      return a.hoursToDeadline - b.hoursToDeadline;
    })
    .slice(0, 5);

  if (atRisk.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-5">
        <h3 className="mb-2 text-sm font-semibold text-emerald-400">
          كل شي تحت السيطرة
        </h3>
        <p className="text-xs text-zinc-500">ما فيه مشاريع في خطر الحين.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-5">
      <h3 className="mb-3 text-sm font-semibold text-rose-400">مشاريع في خطر</h3>
      <ul className="space-y-2.5 text-sm">
        {atRisk.map(({ project, hoursToDeadline, failedTasks, overrun }) => {
          const badges: { text: string; className: string }[] = [];
          if (project.priority === "urgent") {
            badges.push({ text: "عاجل ⚡", className: "text-rose-300" });
          }
          if (project.crisisCount > 0) {
            badges.push({
              text: `${project.crisisCount} أزمة`,
              className: "text-rose-400",
            });
          }
          if (project.scopeChanges > 0) {
            badges.push({
              text: `نطاق +${project.scopeChanges}`,
              className: "text-amber-400",
            });
          }
          if (project.clientRevisions > 0) {
            badges.push({
              text: `مراجعات ×${project.clientRevisions}`,
              className: "text-amber-400",
            });
          }
          if (failedTasks > 0) {
            badges.push({
              text: `${failedTasks} فشل`,
              className: "text-rose-500",
            });
          }
          if (overrun > 1.15) {
            badges.push({
              text: `تجاوز ${Math.round((overrun - 1) * 100)}%`,
              className: "text-rose-400",
            });
          }
          return (
            <li key={project.id} className="border-t border-rose-900/20 pt-2.5 first:border-t-0 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-zinc-200">{project.title}</div>
                  <div className="text-xs text-zinc-500">
                    {formatQAR(project.budget)}
                  </div>
                </div>
                <div className="shrink-0 text-left">
                  {project.status === "delayed" ? (
                    <span className="text-rose-400">متأخر</span>
                  ) : hoursToDeadline < 24 ? (
                    <span className="tabular-nums text-rose-400">
                      {Math.max(0, Math.floor(hoursToDeadline))}س
                    </span>
                  ) : (
                    <span className="tabular-nums text-amber-400">
                      {Math.floor(hoursToDeadline / 24)}ي
                    </span>
                  )}
                </div>
              </div>
              {badges.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                  {badges.map((b, i) => (
                    <span key={i} className={cn("rounded bg-zinc-800/60 px-1.5 py-0.5", b.className)}>
                      {b.text}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
