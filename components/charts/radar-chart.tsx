"use client";

export interface RadarPoint {
  label: string;
  value: number;
}

interface Props {
  data: RadarPoint[];
  size?: number;
  color?: string;
}

export function RadarChart({ data, size = 180, color = "rgb(16 185 129)" }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;
  const n = data.length;

  const pos = (i: number, scale: number) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * r * scale,
      y: cy + Math.sin(angle) * r * scale,
    };
  };

  const polyPts = data
    .map((d, i) => {
      const p = pos(i, Math.max(0.02, d.value / 100));
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto">
      {[0.33, 0.66, 1].map((scale, i) => {
        const ringPts = Array.from({ length: n }, (_, k) => pos(k, scale))
          .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
          .join(" ");
        return (
          <polygon
            key={i}
            points={ringPts}
            fill="none"
            stroke="rgb(39 39 42)"
            strokeWidth="1"
          />
        );
      })}
      {data.map((_, i) => {
        const end = pos(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="rgb(39 39 42)"
            strokeWidth="1"
          />
        );
      })}
      <polygon points={polyPts} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      {data.map((d, i) => {
        const lp = pos(i, 1.22);
        return (
          <g key={i}>
            <text
              x={lp.x}
              y={lp.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgb(113 113 122)"
              fontSize="10"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
