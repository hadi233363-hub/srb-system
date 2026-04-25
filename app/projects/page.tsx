import Link from "next/link";
import { AlertCircle, Briefcase, Repeat, Users } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import {
  PRIORITY_COLOR,
  PROJECT_STATUS_COLOR,
  formatDate,
  formatQar,
  isOverdue,
} from "@/lib/db/helpers";
import { cn } from "@/lib/cn";
import { NewProjectButton } from "./new-project-button";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { InvoiceBadge } from "@/components/projects/invoice-badge";

export default async function ProjectsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const canManage =
    session?.user.role === "admin" || session?.user.role === "manager";

  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      include: {
        client: true,
        lead: { select: { id: true, name: true, nickname: true } },
        _count: {
          select: { members: true, tasks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, nickname: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("page.projects.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {projects.length} {t("projects.count")} · {t("projects.subtitle")}
          </p>
        </div>
        {canManage && <NewProjectButton users={users} />}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Briefcase className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("projects.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">
            {t("projects.empty.desc.full")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const overdue = isOverdue(p.deadlineAt, p.status);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className={cn(
                  "group rounded-xl border bg-zinc-900/40 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-900/60",
                  overdue ? "border-rose-500/50" : "border-zinc-800"
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {p.title}
                    </div>
                    {p.client && (
                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                        {p.client.name}
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                      PROJECT_STATUS_COLOR[p.status]
                    )}
                  >
                    {t(`projectStatus.${p.status}`)}
                  </span>
                </div>

                {p.description && (
                  <p className="mb-3 line-clamp-2 text-xs text-zinc-400">
                    {p.description}
                  </p>
                )}

                {/* Progress */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{t("projects.progress")}</span>
                    <span className="tabular-nums">{p.progressPct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={cn(
                        "h-full transition-all",
                        p.progressPct >= 100
                          ? "bg-emerald-500"
                          : overdue
                          ? "bg-rose-500"
                          : "bg-sky-500"
                      )}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-[11px] text-zinc-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {p._count.members}
                    </span>
                    <span>
                      {p._count.tasks} {t("projects.taskWord")}
                    </span>
                  </div>
                  <div className="text-start">
                    {p.type && (
                      <span className="text-zinc-600">
                        {t(`projectType.${p.type}`)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={cn("tabular-nums", PRIORITY_COLOR[p.priority])}>
                    {t("projects.priorityPrefix")} {t(`priority.${p.priority}`)}
                  </span>
                  {p.deadlineAt && (
                    <span
                      className={cn(
                        "flex items-center gap-1 tabular-nums",
                        overdue ? "text-rose-400" : "text-zinc-500"
                      )}
                    >
                      {overdue && <AlertCircle className="h-3 w-3" />}
                      {formatDate(p.deadlineAt, locale)}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  {p.budgetQar > 0 && (
                    <span className="tabular-nums text-emerald-400">
                      {formatQar(p.budgetQar, { locale })}
                      {p.billingType === "monthly" && (
                        <span className="opacity-70">{t("projects.perMonth")}</span>
                      )}
                    </span>
                  )}
                  {p.billingType === "monthly" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
                      <Repeat className="h-2.5 w-2.5" />
                      {t("projects.monthly")}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-600">
                      {t("projects.oneTime")}
                    </span>
                  )}
                </div>

                {p.billingType === "monthly" && p.nextInvoiceDueAt && (
                  <div className="mt-2 flex justify-end">
                    <InvoiceBadge
                      projectId={p.id}
                      budgetQar={p.budgetQar}
                      nextInvoiceDueAt={p.nextInvoiceDueAt}
                      locale={locale}
                      size="compact"
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
