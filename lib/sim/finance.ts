import type { SimState } from "./types";
import { logActivity, postTransaction } from "./state";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function getLastPayrollAt(state: SimState): number | null {
  for (let i = state.transactions.length - 1; i >= 0; i--) {
    const tx = state.transactions[i];
    if (tx.kind === "salary") return tx.at;
  }
  return null;
}

function getLastOverheadDay(state: SimState): number | null {
  for (let i = state.transactions.length - 1; i >= 0; i--) {
    const tx = state.transactions[i];
    if (tx.kind === "overhead") return Math.floor(tx.at / MS_PER_DAY);
  }
  return null;
}

export function tickFinance(state: SimState) {
  const now = state.simTime;

  // Monthly payroll
  const lastPayroll = getLastPayrollAt(state);
  const daysSincePayroll = lastPayroll ? (now - lastPayroll) / MS_PER_DAY : Infinity;
  if (daysSincePayroll >= 30) {
    const total = state.agents.reduce((s, a) => s + a.salaryMonthly, 0);
    postTransaction({
      kind: "salary",
      amount: -total,
      note: "رواتب الشهر",
    });
    logActivity("النظام", `تم صرف الرواتب · −${total.toLocaleString("en-US")} ر.ق`, "warning");
  }

  // Daily overhead (once per sim day)
  const today = Math.floor(now / MS_PER_DAY);
  const lastOverheadDay = getLastOverheadDay(state);
  if (lastOverheadDay === null || today > lastOverheadDay) {
    const overhead = 450 + Math.round(Math.random() * 200);
    postTransaction({
      kind: "overhead",
      amount: -overhead,
      note: "مصاريف يومية (إيجار/أدوات)",
    });
  }
}

export interface FinanceSummary {
  revenue30d: number;
  expenses30d: number;
  net30d: number;
  cashflow: { dayOffset: number; net: number }[];
}

export function summarizeFinance(state: SimState): FinanceSummary {
  const now = state.simTime;
  const thirtyAgo = now - 30 * MS_PER_DAY;
  let revenue = 0;
  let expenses = 0;

  const dayBuckets = new Map<number, number>();
  for (const tx of state.transactions) {
    if (tx.at < thirtyAgo) continue;
    if (tx.amount > 0) revenue += tx.amount;
    else expenses += Math.abs(tx.amount);

    const dayOffset = Math.floor((tx.at - thirtyAgo) / MS_PER_DAY);
    dayBuckets.set(dayOffset, (dayBuckets.get(dayOffset) ?? 0) + tx.amount);
  }

  const cashflow: { dayOffset: number; net: number }[] = [];
  for (let d = 0; d < 30; d++) {
    cashflow.push({ dayOffset: d, net: dayBuckets.get(d) ?? 0 });
  }

  return {
    revenue30d: revenue,
    expenses30d: expenses,
    net30d: revenue - expenses,
    cashflow,
  };
}
