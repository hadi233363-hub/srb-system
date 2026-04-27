// Creative Command Center — at-a-glance ops panel for owner / manager / head.
// Shows: urgent tasks, overdue tasks, upcoming shoots (next 7 days), and
// at-risk projects (deadline within a week or already overdue).
//
// Pure presentation. The page that renders it computes the rows server-side
// from Prisma so it ships zero extra client JS.

import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Camera,
  Flame,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/db/helpers";

interface UrgentTask {
  id: string;
  title: string;
  dueAt: Date | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; title: string } | null;
}

interface OverdueTask {
  id: string;
  title: string;
  dueAt: Date | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; title: string } | null;
  hoursOverdue: number;
}

interface UpcomingShoot {
  id: string;
  title: string;
  shootDate: Date;
  location: string;
  status: string;
}

interface AtRiskProject {
  id: string;
  title: string;
  deadlineAt: Date | null;
  daysToDeadline: number;
  openTasks: number;
  overdueTasks: number;
  briefStage: string;
}

interface Props {
  urgentTasks: UrgentTask[];
  overdueTasks: OverdueTask[];
  upcomingShoots: UpcomingShoot[];
  atRiskProjects: AtRiskProject[];
  locale: "ar" | "en";
}

export function CreativeCommandCenter({
  urgentTasks,
  overdueTasks,
  upcomingShoots,
  atRiskProjects,
  locale,
}: Props) {
  const isAr = locale === "ar";

  const empty =
    urgentTasks.length === 0 &&
    overdueTasks.length === 0 &&
    upcomingShoots.length === 0 &&
    atRiskProjects.length === 0;

  if (empty) return null;

  return (
    <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-violet-300" />
          <h2 className="text-sm font-semibold text-violet-200">
            {isAr ? "مركز القيادة الإبداعي" : "Creative Command Center"}
          </h2>
        </div>
        <span className="text-[10px] text-violet-300/70">
          {isAr
            ? "نظرة سريعة على ما يحتاج اهتمامك الآن"
            : "What needs your attention right now"}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* Urgent */}
        <Card
          icon={Flame}
          tone="rose"
          title={isAr ? "عاجل" : "Urgent"}
          count={urgentTasks.length}
        >
          {urgentTasks.length === 0 ? (
            <Empty isAr={isAr} kind="urgent" />
          ) : (
            <ul className="space-y-1.5">
              {urgentTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link
                    href={t.project ? `/projects/${t.project.id}` : "/tasks"}
                    className="block rounded-md border border-rose-500/20 bg-rose-500/5 p-2 text-[11px] hover:border-rose-400/40"
                  >
                    <div className="line-clamp-1 font-medium text-zinc-100">
                      {t.title}
                    </div>
                    <div className="line-clamp-1 text-[10px] text-zinc-500">
                      {t.assignee?.name ?? (isAr ? "غير مُسنَدة" : "Unassigned")}
                      {t.project && ` · ${t.project.title}`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Overdue */}
        <Card
          icon={AlertTriangle}
          tone="amber"
          title={isAr ? "متأخّرة" : "Overdue"}
          count={overdueTasks.length}
        >
          {overdueTasks.length === 0 ? (
            <Empty isAr={isAr} kind="overdue" />
          ) : (
            <ul className="space-y-1.5">
              {overdueTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link
                    href={t.project ? `/projects/${t.project.id}` : "/tasks"}
                    className="block rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] hover:border-amber-400/40"
                  >
                    <div className="line-clamp-1 font-medium text-zinc-100">
                      {t.title}
                    </div>
                    <div className="text-[10px] text-amber-300/80 tabular-nums">
                      {isAr
                        ? `متأخّر ${formatDuration(t.hoursOverdue, "ar")}`
                        : `${formatDuration(t.hoursOverdue, "en")} overdue`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming shoots */}
        <Card
          icon={Camera}
          tone="sky"
          title={isAr ? "تصوير قريب" : "Upcoming shoots"}
          count={upcomingShoots.length}
        >
          {upcomingShoots.length === 0 ? (
            <Empty isAr={isAr} kind="shoots" />
          ) : (
            <ul className="space-y-1.5">
              {upcomingShoots.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/shoots/${s.id}`}
                    className="block rounded-md border border-sky-500/20 bg-sky-500/5 p-2 text-[11px] hover:border-sky-400/40"
                  >
                    <div className="line-clamp-1 font-medium text-zinc-100">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      <Calendar className="me-0.5 inline h-2.5 w-2.5" />
                      {formatDate(s.shootDate, locale)} · {s.location}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* At risk */}
        <Card
          icon={Briefcase}
          tone="emerald"
          title={isAr ? "مشاريع تحت المراقبة" : "Projects at risk"}
          count={atRiskProjects.length}
        >
          {atRiskProjects.length === 0 ? (
            <Empty isAr={isAr} kind="risk" />
          ) : (
            <ul className="space-y-1.5">
              {atRiskProjects.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className={cn(
                      "block rounded-md border p-2 text-[11px]",
                      p.daysToDeadline < 0
                        ? "border-rose-500/30 bg-rose-500/5 hover:border-rose-400/50"
                        : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/40"
                    )}
                  >
                    <div className="line-clamp-1 font-medium text-zinc-100">
                      {p.title}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {p.daysToDeadline < 0
                        ? isAr
                          ? `تجاوز الموعد بـ ${Math.abs(p.daysToDeadline)} يوم`
                          : `${Math.abs(p.daysToDeadline)}d past deadline`
                        : isAr
                        ? `${p.daysToDeadline} يوم متبقي · ${p.overdueTasks} مهمة متأخّرة`
                        : `${p.daysToDeadline}d left · ${p.overdueTasks} overdue tasks`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

function Card({
  icon: Icon,
  tone,
  title,
  count,
  children,
}: {
  icon: typeof Flame;
  tone: "rose" | "amber" | "sky" | "emerald";
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const toneStyles: Record<string, { border: string; chip: string; head: string }> = {
    rose: {
      border: "border-rose-500/30",
      chip: "bg-rose-500/10 text-rose-300",
      head: "text-rose-200",
    },
    amber: {
      border: "border-amber-500/30",
      chip: "bg-amber-500/10 text-amber-300",
      head: "text-amber-200",
    },
    sky: {
      border: "border-sky-500/30",
      chip: "bg-sky-500/10 text-sky-300",
      head: "text-sky-200",
    },
    emerald: {
      border: "border-emerald-500/30",
      chip: "bg-emerald-500/10 text-emerald-300",
      head: "text-emerald-200",
    },
  };
  const style = toneStyles[tone];
  return (
    <div className={cn("rounded-lg border bg-zinc-900/40 p-3", style.border)}>
      <div className="mb-2 flex items-center justify-between">
        <div className={cn("flex items-center gap-1.5 text-[11px] font-semibold", style.head)}>
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
            style.chip
          )}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function Empty({
  isAr,
  kind,
}: {
  isAr: boolean;
  kind: "urgent" | "overdue" | "shoots" | "risk";
}) {
  const ar: Record<string, string> = {
    urgent: "ما فيه شي عاجل ✓",
    overdue: "ما فيه متأخر ✓",
    shoots: "ما فيه تصوير هذا الأسبوع",
    risk: "كل المشاريع على المسار ✓",
  };
  const en: Record<string, string> = {
    urgent: "Nothing urgent ✓",
    overdue: "Nothing overdue ✓",
    shoots: "No shoots this week",
    risk: "All projects on track ✓",
  };
  return (
    <div className="rounded-md border border-dashed border-zinc-800 px-2 py-3 text-center text-[10px] text-zinc-600">
      {(isAr ? ar : en)[kind]}
    </div>
  );
}

function formatDuration(hours: number, locale: "ar" | "en"): string {
  if (hours < 24) {
    return locale === "ar" ? `${Math.round(hours)} ساعة` : `${Math.round(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  return locale === "ar" ? `${days} يوم` : `${days}d`;
}
