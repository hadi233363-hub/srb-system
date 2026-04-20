import { Construction, type LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  session: number;
  icon?: LucideIcon;
}

export function ComingSoon({ title, description, session, icon: Icon = Construction }: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
          <Icon className="h-7 w-7 text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold text-zinc-100">{title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{description}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-900/40 bg-emerald-950/20 px-3 py-1 text-[11px] text-emerald-400">
          <span>يُبنى في الجلسة {session}</span>
        </div>
      </div>
    </div>
  );
}
