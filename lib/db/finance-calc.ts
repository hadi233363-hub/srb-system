// Finance period calculations with support for recurring transactions + monthly-billed projects.

import type { Project, Transaction } from "@prisma/client";

export type Period = "week" | "month" | "quarter" | "year";

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
  months: number; // how many months in the period (fractional for week)
}

/** Return a [start, end] range for the requested period, ending now. */
export function getPeriodRange(period: Period, now: Date = new Date()): PeriodRange {
  const end = now;
  let start: Date;
  let label: string;
  let months: number;

  switch (period) {
    case "week":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      label = "آخر 7 أيام";
      months = 7 / 30.4375;
      break;
    case "quarter":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      label = "آخر 90 يوم";
      months = 3;
      break;
    case "year":
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      label = "آخر سنة";
      months = 12;
      break;
    case "month":
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      label = "آخر 30 يوم";
      months = 1;
      break;
  }

  return { start, end, label, months };
}

/**
 * Billing-cycle count for a monthly item inside [rangeStart, rangeEnd].
 *
 * Rule: if the item is active at any point in the range, it bills for the
 * whole period (periodMonths). This matches accounting intuition — a
 * 7,000 ر.ق/شهر salary counts as 7,000 once per month regardless of when
 * in the month it started. For short periods (<1 month) we prorate.
 */
export function monthlyOccurrencesInRange(
  txStart: Date,
  txEnd: Date | null,
  rangeStart: Date,
  rangeEnd: Date,
  periodMonths: number = 1
): number {
  const itemEnd = txEnd ?? new Date(8_640_000_000_000_000);

  // Not active at all during the period
  if (txStart > rangeEnd) return 0;
  if (itemEnd < rangeStart) return 0;

  // Short periods (<1 month) → prorate by fraction of period covered.
  if (periodMonths < 1) {
    const activeStart = new Date(Math.max(txStart.getTime(), rangeStart.getTime()));
    const activeEnd = new Date(Math.min(itemEnd.getTime(), rangeEnd.getTime()));
    const activeMs = activeEnd.getTime() - activeStart.getTime();
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    if (totalMs <= 0) return 0;
    return periodMonths * (activeMs / totalMs);
  }

  // For month+: count calendar-months active during the intersection.
  const effectiveStart = new Date(Math.max(txStart.getTime(), rangeStart.getTime()));
  const effectiveEnd = new Date(Math.min(itemEnd.getTime(), rangeEnd.getTime()));
  let months = 0;
  const cursor = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
  const stop = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1);
  while (cursor <= stop) {
    months++;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  // Safety: at least 1 billing if active at all in the period.
  return Math.max(1, months);
}

export interface FinanceSummary {
  period: PeriodRange;
  // Incomes
  oneTimeIncome: number;
  recurringIncome: number; // from recurring income transactions
  projectMonthlyIncome: number; // from "monthly" projects active in the range
  totalIncome: number;
  // Expenses
  oneTimeExpense: number;
  recurringExpense: number;
  totalExpense: number;
  // Derived
  netProfit: number;
  marginPct: number; // netProfit / totalIncome × 100
  // Monthly fixed commitments (for dashboards)
  monthlyRecurringIncome: number;
  monthlyRecurringExpense: number;
  monthlyProjectIncome: number;
  // Diagnostics
  upcomingOneTimeCount: number; // future-dated one-time transactions (not in current period)
  upcomingOneTimeAmount: number; // absolute value of upcoming expenses
}

export interface MonthlyBreakdown {
  monthlyIncomeBaseline: number;
  monthlyExpenseBaseline: number;
  monthlyNetBaseline: number;
}

export function computeFinanceSummary(args: {
  transactions: Transaction[];
  projects: Project[];
  period: Period;
  now?: Date;
}): FinanceSummary {
  const now = args.now ?? new Date();
  const period = getPeriodRange(args.period, now);
  const { start, end, months: periodMonths } = period;

  let oneTimeIncome = 0;
  let recurringIncome = 0;
  let oneTimeExpense = 0;
  let recurringExpense = 0;
  let monthlyRecurringIncome = 0;
  let monthlyRecurringExpense = 0;
  let upcomingOneTimeCount = 0;
  let upcomingOneTimeAmount = 0;

  for (const tx of args.transactions) {
    const rec = tx.recurrence ?? "none";
    const isInRange = tx.occurredAt >= start && tx.occurredAt <= end;
    const isFuture = tx.occurredAt > end;

    if (rec === "none") {
      if (isFuture) {
        upcomingOneTimeCount += 1;
        upcomingOneTimeAmount += tx.amountQar;
        continue;
      }
      if (!isInRange) continue;
      if (tx.kind === "income") oneTimeIncome += tx.amountQar;
      else oneTimeExpense += tx.amountQar;
    } else if (rec === "monthly") {
      const occurrences = monthlyOccurrencesInRange(
        tx.occurredAt,
        tx.recurrenceEndsAt ?? null,
        start,
        end,
        periodMonths
      );
      const total = tx.amountQar * occurrences;
      if (tx.kind === "income") {
        recurringIncome += total;
        monthlyRecurringIncome += tx.amountQar;
      } else {
        recurringExpense += total;
        monthlyRecurringExpense += tx.amountQar;
      }
    }
  }

  // Monthly-billed projects contribute their budget each active month.
  let projectMonthlyIncome = 0;
  let monthlyProjectIncome = 0;
  for (const p of args.projects) {
    if (p.billingType !== "monthly") continue;
    if (p.status === "cancelled") continue;
    const projStart = p.startedAt;
    const projEnd = p.completedAt ?? end;
    const occurrences = monthlyOccurrencesInRange(
      projStart,
      projEnd,
      start,
      end,
      periodMonths
    );
    projectMonthlyIncome += p.budgetQar * occurrences;
    if (p.status === "active" || p.status === "on_hold") {
      monthlyProjectIncome += p.budgetQar;
    }
  }

  const totalIncome = oneTimeIncome + recurringIncome + projectMonthlyIncome;
  const totalExpense = oneTimeExpense + recurringExpense;
  const netProfit = totalIncome - totalExpense;
  const marginPct = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  return {
    period,
    oneTimeIncome,
    recurringIncome,
    projectMonthlyIncome,
    totalIncome,
    oneTimeExpense,
    recurringExpense,
    totalExpense,
    netProfit,
    marginPct,
    monthlyRecurringIncome,
    monthlyRecurringExpense,
    monthlyProjectIncome,
    upcomingOneTimeCount,
    upcomingOneTimeAmount,
  };
}

export function computeMonthlyBaseline(args: {
  transactions: Transaction[];
  projects: Project[];
  now?: Date;
}): MonthlyBreakdown {
  const now = args.now ?? new Date();
  let incomeBaseline = 0;
  let expenseBaseline = 0;

  for (const tx of args.transactions) {
    if ((tx.recurrence ?? "none") !== "monthly") continue;
    if (tx.recurrenceEndsAt && tx.recurrenceEndsAt < now) continue;
    // Count even future-starting recurring as "planned baseline"
    if (tx.kind === "income") incomeBaseline += tx.amountQar;
    else expenseBaseline += tx.amountQar;
  }

  for (const p of args.projects) {
    if (p.billingType !== "monthly") continue;
    if (p.status !== "active" && p.status !== "on_hold") continue;
    incomeBaseline += p.budgetQar;
  }

  return {
    monthlyIncomeBaseline: incomeBaseline,
    monthlyExpenseBaseline: expenseBaseline,
    monthlyNetBaseline: incomeBaseline - expenseBaseline,
  };
}
