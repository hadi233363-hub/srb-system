"use client";

interface Props {
  values: number[];
  height?: number;
}

export function PnlBars({ values, height = 140 }: Props) {
  if (values.length === 0) return null;

  const max = Math.max(...values.map(Math.abs), 1);
  const w = 600;
  const pad = 14;
  const barW = (w - pad * 2) / values.length - 2;
  const zeroY = height / 2;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      style={{ height }}
    >
      <line
        x1={pad}
        x2={w - pad}
        y1={zeroY}
        y2={zeroY}
        stroke="rgb(63 63 70)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      {values.map((v, i) => {
        const x = pad + i * ((w - pad * 2) / values.length);
        const h = (Math.abs(v) / max) * ((height - pad * 2) / 2);
        const y = v >= 0 ? zeroY - h : zeroY;
        const color = v >= 0 ? "rgb(16 185 129)" : "rgb(244 63 94)";
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={Math.max(barW, 2)}
            height={Math.max(h, 1)}
            fill={color}
            fillOpacity="0.75"
            rx="1"
          />
        );
      })}
    </svg>
  );
}
