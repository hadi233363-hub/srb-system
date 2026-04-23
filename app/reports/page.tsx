import {
  Briefcase,
  CheckCircle2,
  DollarSign,
  KanbanSquare,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";
import { formatDate, formatQar } from "@/lib/db/helpers";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import {
  computeMonthReport,
  currentMonth,
  getMonthRange,
  monthsWithActivity,
  shiftMonth,
  type MonthRange,
  type MonthReport,
} from "@/lib/db/report-calc";
import { MonthNavigator } from "./month-navigator";

export default async function ReportsPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const isAdmin = session?.user.role === "admin";

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("page.reports.title")}</h1>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <div className="text-sm text-zinc-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-xs text-zinc-500">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  const { month: monthParam } = await props.searchParams;
  const parsed = parseMonthParam(monthParam, locale);
  const range: MonthRange = parsed ?? currentMonth(locale);

  const [transactions, projects, tasks] = await Promise.all([
    prisma.transaction.findMany({
      include: { project: { select: { id: true, title: true } } },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.project.findMany(),
    prisma.task.findMany(),
  ]);

  const report = computeMonthReport({ transactions, projects, tasks, range });
  const prevRange = shiftMonth(range, -1, locale);
  const prevReport = computeMonthReport({ transactions, projects, tasks, range: prevRange });

  const availableMonths = monthsWithActivity({ transactions, projects, tasks, locale });
  // Ensure the currently-viewed month is in the list even if it's empty
  if (!availableMonths.some((m) => m.year === range.year && m.month === range.month)) {
    availableMonths.push(range);
    availableMonths.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  const now = new Date();
  const hasNext = new Date(range.year, range.month, 1) <= new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Last 12 months for the history strip
  const history: { range: MonthRange; report: MonthReport }[] = [];
  for (let i = 11; i >= 0; i--) {
    const r = shiftMonth(currentMonth(locale), -i, locale);
    history.push({ range: r, report: computeMonthReport({ transactions, projects, tasks, range: r }) });
  }

  const maxHistRevenue = Math.max(1, ...history.map((h) => h.report.totalIncome));

  const revenueDelta = pctDelta(report.totalIncome, prevReport.totalIncome);
  const expenseDelta = pctDelta(report.totalExpense, prevReport.totalExpense);
  const netDelta = pctDelta(report.netProfit, prevReport.netProfit);

  const isCurrentMonth = range.year === now.getFullYear() && range.month === now.getMonth() + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("page.reports.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("page.reports.subtitle")}</p>
        </div>
        <MonthNavigator
          year={range.year}
          month={range.month}
          label={range.label}
          hasNext={hasNext}
          availableMonths={availableMonths.map((m) => ({
            year: m.year,
            month: m.month,
            label: m.label,
          }))}
        />
      </div>

      {isCurrentMonth && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-xs text-emerald-400">
          {t("reports.currentMonth")}
        </div>
      )}

      {/* KPI cards */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("reports.section.financials")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={t("reports.kpi.revenue")}
            value={formatQar(report.totalIncome, { locale })}
            delta={revenueDelta}
            deltaSuffix={t("reports.vsPrev")}
            icon={TrendingUp}
            tone="positive"
          />
          <KpiCard
            label={t("reports.kpi.expenses")}
            value={formatQar(report.totalExpense, { locale })}
            delta={expenseDelta}
            deltaSuffix={t("reports.vsPrev")}
            invertDelta
            icon={TrendingDown}
          />
          <KpiCard
            label={t("reports.kpi.net")}
            value={formatQar(report.netProfit, { sign: true, locale })}
            delta={netDelta}
            deltaSuffix={t("reports.vsPrev")}
            icon={Wallet}
            tone={report.netProfit >= 0 ? "positive" : "danger"}
            subtext={`${t("reports.kpi.margin")}: ${report.marginPct.toFixed(1)}%`}
          />
          <KpiCard
            label={t("reports.kpi.txCount")}
            value={String(report.transactionCount)}
            icon={DollarSign}
          />
        </div>

        {/* Breakdowns */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <BreakdownCard
            title={t("reports.kpi.revenue")}
            tone="positive"
            items={[
              { label: t("reports.income.breakdown.oneTime"), value: report.oneTimeIncome },
              { label: t("reports.income.breakdown.recurring"), value: report.recurringIncome },
              { label: t("reports.income.breakdown.projects"), value: report.monthlyProjectIncome },
            ]}
            locale={locale}
          />
          <BreakdownCard
            title={t("reports.kpi.expenses")}
            tone="danger"
            items={[
              { label: t("reports.expense.breakdown.oneTime"), value: report.oneTimeExpense },
              { label: t("reports.expense.breakdown.recurring"), value: report.recurringExpense },
            ]}
            locale={locale}
          />
        </div>
      </section>

      {/* Project + Task stats */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <StatGroup
          title={t("reports.section.projects")}
          icon={Briefcase}
          stats={[
            { label: t("reports.projects.started"), value: report.projectsStartedCount },
            {
              label: t("reports.projects.completed"),
              value: report.projectsCompletedCount,
              tone: "positive",
            },
            { label: t("reports.projects.activeEnd"), value: report.projectsActiveAtMonthEnd },
          ]}
        />
        <StatGroup
          title={t("reports.section.tasks")}
          icon={KanbanSquare}
          stats={[
            { label: t("reports.tasks.created"), value: report.tasksCreatedCount },
            {
              label: t("reports.tasks.completed"),
              value: report.tasksCompletedCount,
              tone: "positive",
            },
            { label: t("reports.tasks.openEnd"), value: report.tasksOpenAtMonthEnd },
          ]}
        />
      </section>

      {/* Transactions list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("reports.section.transactions")}
        </h2>
        {report.transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
            {t("reports.empty.transactions")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-start font-normal">{t("table.date")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.type")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.category")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.description")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.project")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {report.transactions.map((tx) => {
                  const isIncome = tx.kind === "income";
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-2 text-xs text-zinc-400 tabular-nums">
                        {formatDate(tx.occurredAt, locale)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px]",
                            isIncome
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          )}
                        >
                          {isIncome ? t("tx.income") : t("tx.expense")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-400">
                        {t(`txCategory.${tx.category}`)}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-300">
                        {tx.description ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-sky-400">
                        {tx.project?.title ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-sm font-semibold tabular-nums",
                          isIncome ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {isIncome ? "+" : "−"}
                        {tx.amountQar.toLocaleString("en")} {locale === "en" ? "QAR" : "ر.ق"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* History strip */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-400">
            {t("reports.section.history")}
          </h2>
          <span className="text-[10px] text-zinc-600">{t("reports.history.hint")}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
          {history.map((h) => {
            const isSelected =
              h.range.year === range.year && h.range.month === range.month;
            const barPct = (h.report.totalIncome / maxHistRevenue) * 100;
            const mm = String(h.range.month).padStart(2, "0");
            return (
              <Link
                key={`${h.range.year}-${h.range.month}`}
                href={`/reports?month=${h.range.year}-${mm}`}
                className={cn(
                  "rounded-lg border p-2 transition hover:border-emerald-500/40",
                  isSelected
                    ? "border-emerald-500/60 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-900/40"
                )}
              >
                <div className="text-[10px] text-zinc-500">{h.range.label}</div>
                <div
                  className={cn(
                    "mt-1 text-xs font-semibold tabular-nums",
                    h.report.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {formatQar(h.report.netProfit, { sign: true, locale })}
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full bg-sky-500" style={{ width: `${barPct}%` }} />
                </div>
                <div className="mt-1 flex items-center gap-1 text-[9px] text-zinc-500">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {h.report.projectsCompletedCount} · {h.report.tasksCompletedCount}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function parseMonthParam(raw: string | undefined, locale: "ar" | "en"): MonthRange | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return getMonthRange(year, month, locale);
}

function pctDelta(curr: number, prev: number): number | undefined {
  if (prev === 0) return undefined;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function KpiCard({
  label,
  value,
  delta,
  invertDelta,
  subtext,
  icon: Icon,
  tone = "default",
  deltaSuffix,
}: {
  label: string;
  value: string;
  delta?: number;
  invertDelta?: boolean;
  subtext?: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "danger";
  deltaSuffix?: string;
}) {
  const valueTone =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "danger"
      ? "text-rose-400"
      : "text-zinc-100";

  let deltaTone = "text-zinc-500";
  if (delta !== undefined && delta !== 0) {
    const good = invertDelta ? delta < 0 : delta > 0;
    deltaTone = good ? "text-emerald-400" : "text-rose-400";
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      <div className={cn("mt-1.5 text-xl font-bold tabular-nums", valueTone)}>
        {value}
      </div>
      {delta !== undefined && delta !== 0 && deltaSuffix && (
        <div className={cn("text-[10px] tabular-nums", deltaTone)}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}% {deltaSuffix}
        </div>
      )}
      {subtext && <div className="text-[10px] text-zinc-600">{subtext}</div>}
    </div>
  );
}

function BreakdownCard({
  title,
  tone,
  items,
  locale,
}: {
  title: string;
  tone: "positive" | "danger";
  items: { label: string; value: number }[];
  locale: "ar" | "en";
}) {
  const total = items.reduce((s, it) => s + it.value, 0);
  const valueTone = tone === "positive" ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-400">{title}</span>
        <span className={cn("text-sm font-bold tabular-nums", valueTone)}>
          {formatQar(total, { locale })}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => {
          const pct = total > 0 ? (it.value / total) * 100 : 0;
          return (
            <li key={it.label} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">{it.label}</span>
                <span className="tabular-nums text-zinc-400">
                  {formatQar(it.value, { locale })}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn(
                    "h-full",
                    tone === "positive" ? "bg-emerald-500/60" : "bg-rose-500/60"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatGroup({
  title,
  icon: Icon,
  stats,
}: {
  title: string;
  icon: LucideIcon;
  stats: { label: string; value: number; tone?: "positive" }[];
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-400">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-[10px] text-zinc-500">{s.label}</div>
            <div
              className={cn(
                "mt-1 text-xl font-bold tabular-nums",
                s.tone === "positive" ? "text-emerald-400" : "text-zinc-100"
              )}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
