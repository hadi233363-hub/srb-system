"use client";

import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { useSim } from "../sim-provider";
import { KpiCard } from "../kpi-card";
import { DualLineChart } from "../charts/dual-line-chart";
import { DonutChart } from "../charts/donut-chart";
import { PnlBars } from "../charts/pnl-bars";
import { formatQAR, formatRelativeSim } from "@/lib/format";
import type { TransactionKind } from "@/lib/sim/types";
import { cn } from "@/lib/cn";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS = 30;

const KIND_LABELS: Record<TransactionKind, string> = {
  income: "إيرادات",
  salary: "رواتب",
  overhead: "مصاريف عامة",
  tool: "أدوات",
  ad: "إعلانات",
  refund: "خسائر/ارتجاع",
  bonus: "مكافآت",
  hiring_cost: "تكاليف توظيف",
  severance: "تعويضات",
};

const KIND_COLORS: Record<TransactionKind, string> = {
  income: "rgb(16 185 129)",
  salary: "rgb(139 92 246)",
  overhead: "rgb(251 146 60)",
  tool: "rgb(59 130 246)",
  ad: "rgb(236 72 153)",
  refund: "rgb(244 63 94)",
  bonus: "rgb(234 179 8)",
  hiring_cost: "rgb(14 165 233)",
  severance: "rgb(220 38 38)",
};

export function FinancePage() {
  const { state } = useSim();

  const data = useMemo(() => {
    if (!state) return null;
    const now = state.simTime;
    const start = now - DAYS * MS_PER_DAY;
    const revenueDaily = new Array(DAYS).fill(0);
    const expensesDaily = new Array(DAYS).fill(0);
    const netDaily = new Array(DAYS).fill(0);
    const expenseByKind: Record<string, number> = {};
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const tx of state.transactions) {
      if (tx.at < start || tx.at > now) continue;
      const idx = Math.min(
        DAYS - 1,
        Math.max(0, Math.floor((tx.at - start) / MS_PER_DAY))
      );
      netDaily[idx] += tx.amount;
      if (tx.amount > 0) {
        revenueDaily[idx] += tx.amount;
        totalRevenue += tx.amount;
      } else {
        const abs = Math.abs(tx.amount);
        expensesDaily[idx] += abs;
        totalExpenses += abs;
        expenseByKind[tx.kind] = (expenseByKind[tx.kind] ?? 0) + abs;
      }
    }

    const net = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (net / totalRevenue) * 100 : 0;

    const prev30 = start - DAYS * MS_PER_DAY;
    let prevRevenue = 0;
    let prevExpenses = 0;
    for (const tx of state.transactions) {
      if (tx.at < prev30 || tx.at >= start) continue;
      if (tx.amount > 0) prevRevenue += tx.amount;
      else prevExpenses += Math.abs(tx.amount);
    }
    const revenueDelta = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const expenseDelta = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;

    const slices = Object.entries(expenseByKind)
      .filter(([, v]) => v > 0)
      .map(([kind, value]) => ({
        label: KIND_LABELS[kind as TransactionKind] ?? kind,
        value,
        color: KIND_COLORS[kind as TransactionKind] ?? "rgb(113 113 122)",
      }))
      .sort((a, b) => b.value - a.value);

    const recent = [...state.transactions]
      .sort((a, b) => b.at - a.at)
      .slice(0, 20);

    return {
      revenueDaily,
      expensesDaily,
      netDaily,
      totalRevenue,
      totalExpenses,
      net,
      margin,
      revenueDelta,
      expenseDelta,
      slices,
      recent,
    };
  }, [state]);

  if (!state || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">المالية</h1>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المالية</h1>
        <p className="mt-1 text-sm text-zinc-500">
          آخر 30 يوم محاكاة · يتحدث تلقائياً
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="الإيرادات"
          value={formatQAR(data.totalRevenue)}
          sublabel={
            data.revenueDelta !== 0
              ? `${data.revenueDelta >= 0 ? "+" : ""}${data.revenueDelta.toFixed(0)}% عن الفترة السابقة`
              : "لا مقارنة"
          }
          icon={TrendingUp}
          tone="positive"
        />
        <KpiCard
          label="المصروفات"
          value={formatQAR(data.totalExpenses)}
          sublabel={
            data.expenseDelta !== 0
              ? `${data.expenseDelta >= 0 ? "+" : ""}${data.expenseDelta.toFixed(0)}% عن الفترة السابقة`
              : "لا مقارنة"
          }
          icon={TrendingDown}
        />
        <KpiCard
          label="صافي الربح"
          value={formatQAR(data.net, true)}
          sublabel={`هامش ${data.margin.toFixed(0)}%`}
          icon={DollarSign}
          tone={data.net >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">الإيرادات مقابل المصروفات</h3>
          <p className="mt-1 text-xs text-zinc-500">آخر 30 يوم</p>
        </div>
        <DualLineChart
          seriesA={{
            label: "الإيرادات",
            color: "rgb(16 185 129)",
            values: data.revenueDaily,
          }}
          seriesB={{
            label: "المصروفات",
            color: "rgb(244 63 94)",
            values: data.expensesDaily,
          }}
          height={220}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">تفصيل المصروفات</h3>
          <DonutChart
            slices={data.slices}
            centerLabel="الإجمالي"
            centerValue={formatQAR(data.totalExpenses)}
          />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-3">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-semibold">الربح/الخسارة اليومي</h3>
              <p className="mt-1 text-xs text-zinc-500">صافي كل يوم (30 يوم)</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" /> ربح
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="h-2 w-2 rounded-sm bg-rose-500" /> خسارة
              </span>
            </div>
          </div>
          <PnlBars values={data.netDaily} height={180} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h3 className="text-sm font-semibold">آخر المعاملات</h3>
          <span className="text-xs text-zinc-500">{data.recent.length} معاملة</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/30 text-xs text-zinc-500">
              <tr>
                <th className="px-5 py-2.5 text-right font-medium">النوع</th>
                <th className="px-5 py-2.5 text-right font-medium">الوصف</th>
                <th className="px-5 py-2.5 text-left font-medium">المبلغ</th>
                <th className="px-5 py-2.5 text-left font-medium">الوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {data.recent.map((tx) => (
                <tr key={tx.id} className="transition hover:bg-zinc-800/20">
                  <td className="px-5 py-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs"
                      style={{ color: KIND_COLORS[tx.kind] }}
                    >
                      {tx.amount >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {KIND_LABELS[tx.kind]}
                    </span>
                  </td>
                  <td className="max-w-[360px] truncate px-5 py-2.5 text-zinc-400">
                    {tx.note ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-2.5 text-left tabular-nums font-medium",
                      tx.amount >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {formatQAR(tx.amount, true)}
                  </td>
                  <td className="px-5 py-2.5 text-left text-xs text-zinc-500">
                    {formatRelativeSim(tx.at, state.simTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
