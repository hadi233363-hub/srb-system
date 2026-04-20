import Link from "next/link";
import {
  Briefcase,
  DollarSign,
  KanbanSquare,
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/cn";
import { getLocale } from "@/lib/i18n/server";
import { translate, type Locale } from "@/lib/i18n/dict";

const MS_30D = 30 * 24 * 60 * 60 * 1000;

export default async function OverviewPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const userName = session?.user?.name ?? t("overview.userFallback");
  const isAdmin = session?.user.role === "admin";

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - MS_30D);

  // Non-admins don't see the money KPIs — skip those queries entirely.
  const [
    activeProjects,
    allTasks,
    openTasks,
    overdueTasks,
    teamSize,
    last30dIncome,
    last30dExpense,
  ] = await Promise.all([
    prisma.project.count({ where: { status: "active" } }),
    prisma.task.count(),
    prisma.task.count({
      where: { status: { in: ["todo", "in_progress", "in_review"] } },
    }),
    prisma.task.count({
      where: {
        status: { in: ["todo", "in_progress", "in_review"] },
        dueAt: { lt: now },
      },
    }),
    prisma.user.count({ where: { active: true } }),
    isAdmin
      ? prisma.transaction.aggregate({
          where: { kind: "income", occurredAt: { gte: thirtyAgo } },
          _sum: { amountQar: true },
        })
      : Promise.resolve({ _sum: { amountQar: 0 } as { amountQar: number | null } }),
    isAdmin
      ? prisma.transaction.aggregate({
          where: { kind: "expense", occurredAt: { gte: thirtyAgo } },
          _sum: { amountQar: true },
        })
      : Promise.resolve({ _sum: { amountQar: 0 } as { amountQar: number | null } }),
  ]);

  const revenue = last30dIncome._sum.amountQar ?? 0;
  const expenses = last30dExpense._sum.amountQar ?? 0;
  const net = revenue - expenses;
  const isEmpty = activeProjects === 0 && allTasks === 0 && teamSize <= 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("page.overview.greeting")} {userName} 👋
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isEmpty
            ? t("page.overview.subtitleFresh")
            : t("page.overview.subtitle")}
        </p>
      </div>

      {/* KPI strip — money KPIs visible to admin only */}
      <div
        className={cn(
          "grid grid-cols-2 gap-4 sm:grid-cols-3",
          isAdmin ? "lg:grid-cols-6" : "lg:grid-cols-4"
        )}
      >
        <KpiCard
          label={t("kpi.activeProjects")}
          value={String(activeProjects)}
          icon={Briefcase}
        />
        <KpiCard
          label={t("kpi.openTasks")}
          value={String(openTasks)}
          sub={overdueTasks > 0 ? `${overdueTasks} ${t("tasks.overdue")}` : undefined}
          tone={overdueTasks > 0 ? "danger" : "default"}
          icon={KanbanSquare}
        />
        <KpiCard
          label={t("kpi.overdueTasks")}
          value={String(overdueTasks)}
          tone={overdueTasks > 0 ? "danger" : "default"}
          icon={KanbanSquare}
        />
        <KpiCard
          label={t("kpi.teamSize")}
          value={String(teamSize)}
          sub={t("common.activeEmployees")}
          icon={Users}
        />
        {isAdmin && (
          <>
            <KpiCard
              label={t("kpi.revenue30")}
              value={formatQar(revenue, locale)}
              tone={revenue > 0 ? "positive" : "default"}
              icon={TrendingUp}
            />
            <KpiCard
              label={t("kpi.net30")}
              value={formatQar(net, locale, true)}
              tone={net > 0 ? "positive" : net < 0 ? "danger" : "default"}
              sub={`${t("common.expensesLabel")} ${formatQar(expenses, locale)}`}
              icon={DollarSign}
            />
          </>
        )}
      </div>

      {isEmpty && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              🚀
            </span>
            <h2 className="text-lg font-semibold text-zinc-100">
              {t("common.setupStart")}
            </h2>
          </div>
          <p className="mb-4 text-sm text-zinc-400">{t("common.setupDesc")}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SetupCard
              step={1}
              title={t("overview.setup.team.title")}
              description={t("overview.setup.team.desc")}
              href="/admin/users"
              cta={t("overview.setup.team.cta")}
              locale={locale}
            />
            <SetupCard
              step={2}
              title={t("overview.setup.project.title")}
              description={t("overview.setup.project.desc")}
              href="/projects"
              cta={t("overview.setup.project.cta")}
              locale={locale}
            />
            <SetupCard
              step={3}
              title={t("overview.setup.tasks.title")}
              description={t("overview.setup.tasks.desc")}
              href="/tasks"
              cta={t("overview.setup.tasks.cta")}
              locale={locale}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("common.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/projects" icon={Plus} label={t("action.newProject")} />
          <QuickAction href="/tasks" icon={Plus} label={t("action.newTask")} />
          <QuickAction
            href="/finance"
            icon={DollarSign}
            label={t("action.recordTransaction")}
          />
          {isAdmin && (
            <QuickAction
              href="/admin/users"
              icon={Users}
              label={t("action.addEmployee")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "danger"
      ? "text-rose-400"
      : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      <div className={cn("text-xl font-bold tabular-nums", toneClass)}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function SetupCard({
  step,
  title,
  description,
  href,
  cta,
  locale,
}: {
  step: number;
  title: string;
  description: string;
  href: string;
  cta: string;
  locale: Locale;
}) {
  const arrow = locale === "ar" ? "←" : "→";
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-900"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
          {step}
        </span>
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
      </div>
      <p className="text-[11px] text-zinc-500">{description}</p>
      <div className="mt-3 text-[11px] text-emerald-400 group-hover:text-emerald-300">
        {cta} {arrow}
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function formatQar(n: number, locale: Locale, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  const abs = Math.abs(Math.round(n));
  const currency = locale === "ar" ? "ر.ق" : "QAR";
  return `${n < 0 ? "−" : sign}${abs.toLocaleString("en")} ${currency}`;
}
