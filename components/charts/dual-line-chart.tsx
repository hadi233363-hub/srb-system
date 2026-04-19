"use client";

interface Series {
  label: string;
  color: string;
  values: number[];
}

interface Props {
  seriesA: Series;
  seriesB: Series;
  height?: number;
}

export function DualLineChart({ seriesA, seriesB, height = 180 }: Props) {
  const len = Math.max(seriesA.values.length, seriesB.values.length, 2);
  const max = Math.max(...seriesA.values, ...seriesB.values, 1);
  const w = 600;
  const pad = 14;

  const pathFor = (values: number[]) =>
    values
      .map((v, i) => {
        const x = pad + (i / (len - 1)) * (w - pad * 2);
        const y = height - pad - (v / max) * (height - pad * 2);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const areaFor = (values: number[]) => {
    const line = pathFor(values);
    const lastX = pad + ((values.length - 1) / (len - 1)) * (w - pad * 2);
    return `${line} L ${lastX.toFixed(1)} ${height - pad} L ${pad} ${height - pad} Z`;
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: seriesA.color }}
          />
          <span className="text-zinc-400">{seriesA.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: seriesB.color }}
          />
          <span className="text-zinc-400">{seriesB.label}</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height }}
      >
        <defs>
          <linearGradient id="grad-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={seriesA.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={seriesA.color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="grad-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={seriesB.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={seriesB.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line
            key={i}
            x1={pad}
            x2={w - pad}
            y1={height - pad - f * (height - pad * 2)}
            y2={height - pad - f * (height - pad * 2)}
            stroke="rgb(39 39 42)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        ))}
        <path d={areaFor(seriesA.values)} fill="url(#grad-a)" />
        <path d={areaFor(seriesB.values)} fill="url(#grad-b)" />
        <path
          d={pathFor(seriesB.values)}
          fill="none"
          stroke={seriesB.color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={pathFor(seriesA.values)}
          fill="none"
          stroke={seriesA.color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
