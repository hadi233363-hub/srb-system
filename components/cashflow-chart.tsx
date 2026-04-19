"use client";

import { useSim } from "./sim-provider";
import { formatQAR } from "@/lib/format";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS = 30;

export function CashflowChart() {
  const { state } = useSim();

  if (!state) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
    );
  }

  const now = state.simTime;
  const start = now - DAYS * MS_PER_DAY;
  const dayNet: number[] = new Array(DAYS).fill(0);
  for (const tx of state.transactions) {
    if (tx.at < start || tx.at > now) continue;
    const idx = Math.min(DAYS - 1, Math.max(0, Math.floor((tx.at - start) / MS_PER_DAY)));
    dayNet[idx] += tx.amount;
  }
  const cumulative: number[] = [];
  let running = 0;
  for (const v of dayNet) {
    running += v;
    cumulative.push(running);
  }

  const max = Math.max(...cumulative, 1);
  const min = Math.min(...cumulative, 0);
  const range = max - min || 1;
  const w = 600;
  const h = 180;
  const pad = 16;

  const points = cumulative.map((v, i) => {
    const x = pad + (i / (cumulative.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return { x, y, v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${h - pad} L ${points[0].x.toFixed(1)} ${h - pad} Z`;

  const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2);
  const current = cumulative[cumulative.length - 1] ?? 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold">التدفق النقدي (30 يوم)</h3>
          <div className="mt-1 text-xs text-zinc-500">الرصيد التراكمي</div>
        </div>
        <div
          className={`text-xl font-bold tabular-nums ${
            current >= 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {formatQAR(current, true)}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-40 w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cashflow-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={pad}
          x2={w - pad}
          y1={zeroY}
          y2={zeroY}
          stroke="rgb(63 63 70)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <path d={areaPath} fill="url(#cashflow-grad)" />
        <path
          d={linePath}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3.5"
            fill="rgb(16 185 129)"
          />
        )}
      </svg>
    </div>
  );
}
