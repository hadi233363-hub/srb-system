import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import {
  AlertTriangle,
  DollarSign,
  Repeat,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { formatDate, formatQar } from "@/lib/db/helpers";
import { cn } from "@/lib/cn";
import {
  computeFinanceSummary,
  computeMonthlyBaseline,
  getPeriodRange,
  type Period,
} from "@/lib/db/finance-calc";
import { NewTransactionButton } from "./new-transaction-button";
import { DeleteTransactionButton } from "./delete-transaction-button";
import { PeriodSelector } from "./period-selector";
import { getLocale } from "@/lib/i18n/server";
import { translate, type Locale } from "@/lib/i18n/dict";

const VALID_PERIODS: Period[] = ["week", "month", "quarter", "year"];

export default async function FinancePage(props: {
  searchParams: Promise<{ period?: string }>;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const isAdmin = session?.user.role === "admin";

  const { period: periodRaw } = await props.searchParams;
  const period: Period = VALID_PERIODS.includes(periodRaw as Period)
    ? (periodRaw as Period)
    : "month";

  // Non-admins only need the list of active projects to tag their transactions.
  // We skip all the heavy aggregation queries for them.
  if (!isAdmin) {
    const activeProjectsForDropdown = await prisma.project.findMany({
      where: { status: { in: ["active", "on_hold"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("finance.employee.title")}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {t("finance.employee.subtitle")}
            </p>
          </div>
          <NewTransactionButton projects={activeProjectsForDropdown} />
        </div>
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          {t("finance.employee.cta")}
        </div>
      </div>
    );
  }

  const now = new Date();
  const range = getPeriodRange(period, now);
  const prevRangeEnd = new Date(range.start.getTime());

  const [transactions, allProjects, activeProjectsForDropdown] = await Promise.all([
    prisma.transaction.findMany({
      include: { project: { select: { id: true, title: true } } },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.project.findMany(),
    prisma.project.findMany({
      where: { status: { in: ["active", "on_hold"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const summary = computeFinanceSummary({
    transactions,
    projects: allProjects,
    period,
    now,
  });
  const prevSummary = computeFinanceSummary({
    transactions,
    projects: allProjects,
    period,
    now: prevRangeEnd,
  });
  const baseline = computeMonthlyBaseline({
    transactions,
    projects: allProjects,
    now,
  });

  const revenueDelta =
    prevSummary.totalIncome > 0
      ? ((summary.totalIncome - prevSummary.totalIncome) / prevSummary.totalIncome) * 100
      : 0;
  const expenseDelta =
    prevSummary.totalExpense > 0
      ? ((summary.totalExpense - prevSummary.totalExpense) / prevSummary.totalExpense) *
        100
      : 0;

  const risks = analyzeRisks(
    {
      totalIncome: summary.totalIncome,
      totalExpense: summary.totalExpense,
      net: summary.netProfit,
      prevIncome: prevSummary.totalIncome,
      prevExpense: prevSummary.totalExpense,
      transactionCount: transactions.length,
      monthlyExpenseBaseline: baseline.monthlyExpenseBaseline,
      monthlyIncomeBaseline: baseline.monthlyIncomeBaseline,
    },
    locale
  );

  // Localized period label for KPI titles
  const periodLabel = t(`finance.period.${period}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("page.finance.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.finance.subtitle")}
          </p>
        </div>
        <NewTransactionButton projects={activeProjectsForDropdown} />
      </div>

      {/* Period selector */}
      <PeriodSelector current={period} />

      {/* Monthly baseline (fixed commitments) */}
      <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-sky-400">
          <Repeat className="h-3.5 w-3.5" />
          {t("finance.commitments.title")}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <BaselineStat
            label={t("finance.commitments.income")}
            value={formatQar(baseline.monthlyIncomeBaseline, { locale })}
            sub={t("finance.commitments.incomeSub")}
            tone="positive"
          />
          <BaselineStat
            label={t("finance.commitments.expense")}
            value={formatQar(baseline.monthlyExpenseBaseline, { locale })}
            sub={t("finance.commitments.expenseSub")}
            tone="danger"
          />
          <BaselineStat
            label={t("finance.commitments.net")}
            value={formatQar(baseline.monthlyNetBaseline, { sign: true, locale })}
            sub={t("finance.commitments.netSub")}
            tone={baseline.monthlyNetBaseline >= 0 ? "positive" : "danger"}
          />
        </div>
      </div>

      {/* KPI strip for current period */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={`${t("finance.revenueLabel")} (${periodLabel})`}
          value={formatQar(summary.totalIncome, { locale })}
          delta={revenueDelta}
          icon={TrendingUp}
          tone="positive"
          deltaSuffix={t("finance.deltaVsPrev")}
          subtext={
            summary.projectMonthlyIncome > 0
              ? `${t("finance.ofWhich")} ${formatQar(summary.projectMonthlyIncome, {
                  locale,
                })} ${t("finance.fromMonthlyProjects")}`
              : undefined
          }
        />
        <KpiCard
          label={`${t("finance.expensesLabel")} (${periodLabel})`}
          value={formatQar(summary.totalExpense, { locale })}
          delta={expenseDelta}
          invertDelta
          icon={TrendingDown}
          deltaSuffix={t("finance.deltaVsPrev")}
          subtext={
            summary.recurringExpense > 0
              ? `${t("finance.ofWhich")} ${formatQar(summary.recurringExpense, {
                  locale,
                })} ${t("finance.recurring")}`
              : undefined
          }
        />
        <KpiCard
          label={t("finance.netProfit")}
          value={formatQar(summary.netProfit, { sign: true, locale })}
          subtext={`${t("finance.marginLabel")} ${summary.marginPct.toFixed(1)}%`}
          icon={Wallet}
          tone={summary.netProfit >= 0 ? "positive" : "danger"}
          deltaSuffix={t("finance.deltaVsPrev")}
        />
        <KpiCard
          label={t("finance.txCount")}
          value={String(transactions.length)}
          subtext={t("finance.inSystem")}
          icon={DollarSign}
          deltaSuffix={t("finance.deltaVsPrev")}
        />
      </div>

      {/* Upcoming one-time transactions callout */}
      {summary.upcomingOneTimeCount > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-amber-300">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {summary.upcomingOneTimeCount} {t("finance.upcomingCalloutSuffix")} (
            {formatQar(summary.upcomingOneTimeAmount, { locale })})
          </div>
          <div className="text-xs opacity-90">
            {t("finance.upcomingHint")}{" "}
            <span className="font-semibold">{t("finance.upcomingHintMark")}</span>{" "}
            {t("finance.upcomingHintTail")}
          </div>
        </div>
      )}

      {/* Risk analysis */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400">
            {t("finance.riskTitle")}
          </h2>
          {risks.map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm",
                r.severity === "danger"
                  ? "border-rose-500/40 bg-rose-500/5 text-rose-300"
                  : r.severity === "warn"
                  ? "border-amber-500/40 bg-amber-500/5 text-amber-300"
                  : "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
              )}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">{r.title}</div>
                <div className="mt-0.5 text-xs opacity-90">{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Monthly projects callout */}
      {summary.monthlyProjectIncome > 0 && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
            {t("finance.monthlyProjects.heading")}
          </div>
          <ul className="space-y-1.5 text-sm">
            {allProjects
              .filter(
                (p) =>
                  p.billingType === "monthly" &&
                  (p.status === "active" || p.status === "on_hold")
              )
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md bg-zinc-950/40 px-3 py-1.5"
                >
                  <span className="truncate text-zinc-300">{p.title}</span>
                  <span className="tabular-nums text-emerald-400">
                    {formatQar(p.budgetQar, { locale })}
                    {t("finance.monthlyProjects.perMonth")}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Transactions list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("finance.transactionsHeading")}
        </h2>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <DollarSign className="h-10 w-10 text-zinc-700" />
            <div className="text-sm text-zinc-400">{t("finance.empty.title")}</div>
            <p className="max-w-md text-xs text-zinc-500">
              {t("finance.empty.descFull")}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-start font-normal">{t("table.date")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.type")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.category")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.recurrence")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.description")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.project")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("table.amount")}</th>
                  <th className="w-10 px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {transactions.map((tx) => {
                  const isIncome = tx.kind === "income";
                  const isRecurring = tx.recurrence === "monthly";
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
                      <td className="px-4 py-2">
                        {isRecurring ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
                            <Repeat className="h-2.5 w-2.5" />
                            {t("recurrence.monthly")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-600">
                            {t("recurrence.none")}
                          </span>
                        )}
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
                        {isRecurring && (
                          <span className="mx-1 text-[10px] opacity-70">
                            {t("finance.monthlyProjects.perMonth")}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <DeleteTransactionButton id={tx.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
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
  deltaSuffix: string;
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
      {delta !== undefined && delta !== 0 && (
        <div className={cn("text-[10px] tabular-nums", deltaTone)}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}% {deltaSuffix}
        </div>
      )}
      {subtext && <div className="text-[10px] text-zinc-600">{subtext}</div>}
    </div>
  );
}

function BaselineStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "positive" | "danger" | "default";
}) {
  const valueTone =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "danger"
      ? "text-rose-400"
      : "text-zinc-100";
  return (
    <div>
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-lg font-bold tabular-nums", valueTone)}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-600">{sub}</div>}
    </div>
  );
}

interface Risk {
  severity: "ok" | "warn" | "danger";
  title: string;
  detail: string;
}

function analyzeRisks(
  stats: {
    totalIncome: number;
    totalExpense: number;
    net: number;
    prevIncome: number;
    prevExpense: number;
    transactionCount: number;
    monthlyExpenseBaseline: number;
    monthlyIncomeBaseline: number;
  },
  locale: Locale
): Risk[] {
  const t = (key: string) => translate(key, locale);
  const money = (n: number) => formatQar(n, { locale });
  const risks: Risk[] = [];
  if (stats.transactionCount === 0) return risks;

  if (stats.net < 0) {
    risks.push({
      severity: "danger",
      title: t("risk.loss.title"),
      detail: `${t("risk.loss.detailPrefix")} ${money(Math.abs(stats.net))}.`,
    });
  }

  if (stats.totalIncome > 0 && stats.net > 0) {
    const margin = stats.net / stats.totalIncome;
    if (margin < 0.1) {
      risks.push({
        severity: "warn",
        title: t("risk.lowMargin.title"),
        detail: `${t("risk.lowMargin.detailPrefix")} ${(margin * 100).toFixed(1)}% ${t(
          "risk.lowMargin.detailSuffix"
        )}`,
      });
    }
  }

  if (stats.prevIncome > 0) {
    const drop = (stats.totalIncome - stats.prevIncome) / stats.prevIncome;
    if (drop < -0.2) {
      risks.push({
        severity: "warn",
        title: t("risk.revenueDrop.title"),
        detail: `${t("risk.revenueDrop.detailPrefix")} ${Math.round(
          Math.abs(drop) * 100
        )}% ${t("risk.revenueDrop.detailSuffix")}`,
      });
    }
  }

  if (stats.prevExpense > 0) {
    const rise = (stats.totalExpense - stats.prevExpense) / stats.prevExpense;
    if (rise > 0.3) {
      risks.push({
        severity: "warn",
        title: t("risk.expenseRise.title"),
        detail: `${t("risk.expenseRise.detailPrefix")} ${Math.round(rise * 100)}% ${t(
          "risk.expenseRise.detailSuffix"
        )}`,
      });
    }
  }

  // Fixed expenses exceed fixed income
  if (
    stats.monthlyExpenseBaseline > 0 &&
    stats.monthlyIncomeBaseline < stats.monthlyExpenseBaseline
  ) {
    const gap = stats.monthlyExpenseBaseline - stats.monthlyIncomeBaseline;
    risks.push({
      severity: "danger",
      title: t("risk.fixedGap.title"),
      detail: `${t("risk.fixedGap.detailPrefix")} ${money(gap)} ${t(
        "risk.fixedGap.detailSuffix"
      )}`,
    });
  }

  if (stats.totalExpense > 0 && stats.totalIncome === 0) {
    risks.push({
      severity: "danger",
      title: t("risk.noIncome.title"),
      detail: `${t("risk.noIncome.detailPrefix")} ${money(stats.totalExpense)} ${t(
        "risk.noIncome.detailSuffix"
      )}`,
    });
  }

  if (risks.length === 0 && stats.net > 0) {
    risks.push({
      severity: "ok",
      title: t("risk.healthy.title"),
      detail: `${t("risk.healthy.detailPrefix")} ${money(stats.net)} ${t(
        "risk.healthy.detailMargin"
      )} ${((stats.net / Math.max(1, stats.totalIncome)) * 100).toFixed(1)}%.`,
    });
  }

  return risks;
}
