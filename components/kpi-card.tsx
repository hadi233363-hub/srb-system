import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

type Tone = "default" | "positive" | "negative";

type Props = {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  tone?: Tone;
};

const toneClasses: Record<Tone, string> = {
  default: "text-zinc-100",
  positive: "text-emerald-500",
  negative: "text-rose-500",
};

export function KpiCard({ label, value, sublabel, icon: Icon, tone = "default" }: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-zinc-500">{label}</span>
        <Icon className="h-4 w-4 text-zinc-600" />
      </div>
      <div className={cn("text-2xl font-bold tabular-nums", toneClasses[tone])}>
        {value}
      </div>
      {sublabel && <div className="mt-1 text-xs text-zinc-500">{sublabel}</div>}
    </div>
  );
}
