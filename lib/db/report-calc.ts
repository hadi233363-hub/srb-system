// Monthly report calculations from real Prisma data.
// Unlike finance-calc.ts (which uses sliding periods), this operates on a
// specific calendar month so reports can be archived and navigated historically.

import type { Project, Task, Transaction } from "@prisma/client";

export interface MonthRange {
  start: Date;
  end: Date; // first millisecond of next month
  year: number;
  month: number; // 1..12
  label: string; // e.g. "April 2026"
}

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** Build a month range. Month is 1..12. */
export function getMonthRange(
  year: number,
  month: number,
  locale: "ar" | "en" = "ar"
): MonthRange {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  const names = locale === "en" ? MONTH_NAMES_EN : MONTH_NAMES_AR;
  return {
    start,
    end,
    year,
    month,
    label: `${names[month - 1]} ${year}`,
  };
}

/** Month range for today. */
export function currentMonth(locale: "ar" | "en" = "ar"): MonthRange {
  const now = new Date();
  return getMonthRange(now.getFullYear(), now.getMonth() + 1, locale);
}

/** Prev/next month. */
export function shiftMonth(range: MonthRange, delta: number, locale: "ar" | "en" = "ar"): MonthRange {
  const d = new Date(range.start);
  d.setMonth(d.getMonth() + delta);
  return getMonthRange(d.getFullYear(), d.getMonth() + 1, locale);
}

export interface MonthReport {
  range: MonthRange;

  // Financials
  oneTimeIncome: number;
  recurringIncome: number; // recurring transactions billing this month
  monthlyProjectIncome: number; // monthly-billed projects active this month
  totalIncome: number;

  oneTimeExpense: number;
  recurringExpense: number;
  totalExpense: number;

  netProfit: number;
  marginPct: number;

  // Counts
  transactionCount: number; // transactions occurring in this month (one-time + first month of recurring)

  // Projects
  projectsStartedCount: number;
  projectsCompletedCount: number;
  projectsActiveAtMonthEnd: number; // active/on_hold whose startedAt <= end and (completedAt is null or > end)

  // Tasks
  tasksCreatedCount: number;
  tasksCompletedCount: number;
  tasksOpenAtMonthEnd: number; // created by end AND (not done OR completed after end)

  // Transactions for listing
  transactions: (Transaction & {
    project: { id: string; title: string } | null;
  })[];
}

/** Does a recurring transaction bill during [start, end)? */
function recurringBillsInMonth(
  txStart: Date,
  txEnd: Date | null,
  monthStart: Date,
  monthEnd: Date
): boolean {
  if (txStart >= monthEnd) return false; // starts after month
  if (txEnd && txEnd < monthStart) return false; // ended before month
  return true;
}

/** Does a monthly-billed project bill during [start, end)? */
function monthlyProjectBillsInMonth(
  p: Project,
  monthStart: Date,
  monthEnd: Date
): boolean {
  if (p.billingType !== "monthly") return false;
  if (p.status === "cancelled") return false;
  if (p.startedAt >= monthEnd) return false;
  if (p.completedAt && p.completedAt < monthStart) return false;
  return true;
}

export function computeMonthReport(args: {
  transactions: (Transaction & { project: { id: string; title: string } | null })[];
  projects: Project[];
  tasks: Task[];
  range: MonthRange;
}): MonthReport {
  const { range, transactions, projects, tasks } = args;
  const { start: monthStart, end: monthEnd } = range;

  let oneTimeIncome = 0;
  let recurringIncome = 0;
  let oneTimeExpense = 0;
  let recurringExpense = 0;

  const monthTransactions: MonthReport["transactions"] = [];

  for (const tx of transactions) {
    const rec = tx.recurrence ?? "none";
    if (rec === "none") {
      // Count if occurredAt is within this month
      if (tx.occurredAt >= monthStart && tx.occurredAt < monthEnd) {
        if (tx.kind === "income") oneTimeIncome += tx.amountQar;
        else oneTimeExpense += tx.amountQar;
        monthTransactions.push(tx);
      }
    } else if (rec === "monthly") {
      const bills = recurringBillsInMonth(
        tx.occurredAt,
        tx.recurrenceEndsAt ?? null,
        monthStart,
        monthEnd
      );
      if (bills) {
        if (tx.kind === "income") recurringIncome += tx.amountQar;
        else recurringExpense += tx.amountQar;
        // List the original tx row only in the month it started
        if (tx.occurredAt >= monthStart && tx.occurredAt < monthEnd) {
          monthTransactions.push(tx);
        }
      }
    }
  }

  let monthlyProjectIncome = 0;
  for (const p of projects) {
    if (monthlyProjectBillsInMonth(p, monthStart, monthEnd)) {
      monthlyProjectIncome += p.budgetQar;
    }
  }
  // Also count one-time project budgets if the project completed this month
  // (they're expected to be booked via a transaction, but provide a fallback signal)

  const totalIncome = oneTimeIncome + recurringIncome + monthlyProjectIncome;
  const totalExpense = oneTimeExpense + recurringExpense;
  const netProfit = totalIncome - totalExpense;
  const marginPct = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Projects
  const projectsStartedCount = projects.filter(
    (p) => p.startedAt >= monthStart && p.startedAt < monthEnd
  ).length;
  const projectsCompletedCount = projects.filter(
    (p) =>
      p.status === "completed" &&
      p.completedAt &&
      p.completedAt >= monthStart &&
      p.completedAt < monthEnd
  ).length;
  const projectsActiveAtMonthEnd = projects.filter(
    (p) =>
      p.status !== "cancelled" &&
      p.startedAt < monthEnd &&
      (!p.completedAt || p.completedAt >= monthEnd)
  ).length;

  // Tasks
  const tasksCreatedCount = tasks.filter(
    (t) => t.createdAt >= monthStart && t.createdAt < monthEnd
  ).length;
  const tasksCompletedCount = tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completedAt &&
      t.completedAt >= monthStart &&
      t.completedAt < monthEnd
  ).length;
  const tasksOpenAtMonthEnd = tasks.filter((t) => {
    if (t.createdAt >= monthEnd) return false; // didn't exist yet
    // Open if not done at all, or done but completed after this month
    if (t.status !== "done") return true;
    if (t.completedAt && t.completedAt >= monthEnd) return true;
    return false;
  }).length;

  return {
    range,
    oneTimeIncome,
    recurringIncome,
    monthlyProjectIncome,
    totalIncome,
    oneTimeExpense,
    recurringExpense,
    totalExpense,
    netProfit,
    marginPct,
    transactionCount: monthTransactions.length,
    projectsStartedCount,
    projectsCompletedCount,
    projectsActiveAtMonthEnd,
    tasksCreatedCount,
    tasksCompletedCount,
    tasksOpenAtMonthEnd,
    transactions: monthTransactions.sort(
      (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
    ),
  };
}

/** Build a chronological list of months that had any activity (transactions/projects/tasks), oldest → newest. */
export function monthsWithActivity(args: {
  transactions: Transaction[];
  projects: Project[];
  tasks: Task[];
  locale?: "ar" | "en";
}): MonthRange[] {
  const seen = new Set<string>();
  const months: MonthRange[] = [];
  const locale = args.locale ?? "ar";

  const addFromDate = (d: Date | null | undefined) => {
    if (!d) return;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${m}`;
    if (seen.has(key)) return;
    seen.add(key);
    months.push(getMonthRange(y, m, locale));
  };

  for (const tx of args.transactions) addFromDate(tx.occurredAt);
  for (const p of args.projects) {
    addFromDate(p.startedAt);
    addFromDate(p.completedAt);
  }
  for (const t of args.tasks) {
    addFromDate(t.createdAt);
    addFromDate(t.completedAt);
  }

  // Always include current month
  const now = new Date();
  const curKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  if (!seen.has(curKey)) {
    months.push(getMonthRange(now.getFullYear(), now.getMonth() + 1, locale));
  }

  months.sort((a, b) => a.start.getTime() - b.start.getTime());
  return months;
}
