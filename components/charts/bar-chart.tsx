"use client";

import { cn } from "@/lib/cn";

export interface BarRow {
  label: string;
  value: number;
  sublabel?: string;
  color?: string;
  accent?: boolean;
}

interface Props {
  rows: BarRow[];
  valueFormat?: (v: number) => string;
  maxOverride?: number;
}

export function BarChart({ rows, valueFormat, maxOverride }: Props) {
  const max = maxOverride ?? Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((r, i) => {
        const pct = (r.value / max) * 100;
        return (
          <li key={r.label + i}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className={cn("text-zinc-300", r.accent && "font-semibold text-zinc-100")}>
                {r.label}
              </span>
              <span className="tabular-nums text-zinc-400">
                {valueFormat ? valueFormat(r.value) : r.value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${Math.max(pct, 0)}%`,
                  background: r.color ?? "rgb(16 185 129)",
                }}
              />
            </div>
            {r.sublabel && (
              <div className="mt-1 text-[11px] text-zinc-600">{r.sublabel}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
