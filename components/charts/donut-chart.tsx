"use client";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

export function DonutChart({ slices, centerLabel, centerValue, size = 180 }: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const inner = r * 0.62;

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border-[12px] border-zinc-800 text-xs text-zinc-600"
        style={{ width: size, height: size }}
      >
        لا بيانات
      </div>
    );
  }

  let current = -Math.PI / 2;
  const paths = slices
    .filter((s) => s.value > 0)
    .map((slice) => {
      const pct = slice.value / total;
      const angle = pct * Math.PI * 2;
      const start = current;
      const end = current + angle;
      current = end;

      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const x3 = cx + inner * Math.cos(end);
      const y3 = cy + inner * Math.sin(end);
      const x4 = cx + inner * Math.cos(start);
      const y4 = cy + inner * Math.sin(start);
      const largeArc = angle > Math.PI ? 1 : 0;

      const d = [
        `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
        `A ${inner} ${inner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
        "Z",
      ].join(" ");

      return { d, color: slice.color, label: slice.label, value: slice.value, pct };
    });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {paths.map((p, i) => (
            <path key={i} d={p.d} fill={p.color} />
          ))}
        </svg>
        {centerValue && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerLabel && (
              <div className="text-[11px] text-zinc-500">{centerLabel}</div>
            )}
            <div className="text-lg font-bold tabular-nums text-zinc-100">
              {centerValue}
            </div>
          </div>
        )}
      </div>
      <ul className="flex-1 space-y-2 text-sm">
        {slices.map((s) => {
          const pct = (s.value / total) * 100;
          return (
            <li key={s.label} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="min-w-0 flex-1 truncate text-zinc-400">{s.label}</span>
              <span className="w-10 shrink-0 text-left text-xs tabular-nums text-zinc-500">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
