"use client";

import { useState } from "react";
import {
  CircleDollarSign,
  Gift,
  PartyPopper,
  Pause,
  Play,
  UserPlus,
  Zap,
} from "lucide-react";
import { useSim } from "../sim-provider";
import { cn } from "@/lib/cn";

interface Props {
  /** Called when the user wants to open the Hire analysis dialog. */
  onOpenHire: () => void;
}

export function ManualActions({ onOpenHire }: Props) {
  const { state, action, spawn } = useSim();
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const flashMessage = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  };

  const doAction = async (type: string, params?: Record<string, unknown>) => {
    setBusy(type);
    const res = await action(type, params);
    setBusy(null);
    flashMessage(res.message);
  };

  const doSpawn = async (templateId: string) => {
    setBusy(templateId);
    await spawn(templateId);
    setBusy(null);
    flashMessage("تم توليد سيناريو جديد");
  };

  if (!state) return null;

  const hiringPaused = state.settings.hiringPaused;

  return (
    <div className="space-y-4">
      {flash && (
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-sm text-emerald-400">
          {flash}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <ActionButton
          label="تحليل وتوظيف"
          sublabel="مع impact preview"
          icon={UserPlus}
          onClick={onOpenHire}
          disabled={hiringPaused}
          color="emerald"
        />
        <ActionButton
          label="بونص جماعي"
          sublabel="−10% من الرواتب"
          icon={Gift}
          onClick={() => doAction("bonus")}
          busy={busy === "bonus"}
          color="blue"
        />
        <ActionButton
          label="يوم ترفيهي"
          sublabel="−20,000 ر.ق"
          icon={PartyPopper}
          onClick={() => doAction("retreat")}
          busy={busy === "retreat"}
          color="purple"
        />
        <ActionButton
          label={hiringPaused ? "استئناف التوظيف" : "إيقاف التوظيف"}
          icon={hiringPaused ? Play : Pause}
          onClick={() => doAction("hiring_pause", { paused: !hiringPaused })}
          busy={busy === "hiring_pause"}
          color="amber"
        />
        <ActionButton
          label="فرصة مبيعات"
          sublabel="توليد سيناريو"
          icon={CircleDollarSign}
          onClick={() => doSpawn("sales_lead")}
          busy={busy === "sales_lead"}
          color="emerald"
        />
        <ActionButton
          label="عرض خارجي"
          sublabel="لموظف عشوائي"
          icon={Zap}
          onClick={() => doSpawn("external_offer")}
          busy={busy === "external_offer"}
          color="rose"
        />
      </div>

    </div>
  );
}

interface ABProps {
  label: string;
  sublabel?: string;
  icon: typeof UserPlus;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  color: "emerald" | "blue" | "purple" | "amber" | "rose";
}

const colorMap = {
  emerald: "hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400",
  blue: "hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400",
  purple: "hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-400",
  amber: "hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400",
  rose: "hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400",
};

function ActionButton({ label, sublabel, icon: Icon, onClick, disabled, busy, color }: ABProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-right transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        !disabled && !busy && colorMap[color]
      )}
    >
      <Icon className="h-4 w-4 text-zinc-400" />
      <div className="text-sm font-medium text-zinc-200">
        {busy ? "..." : label}
      </div>
      {sublabel && (
        <div className="text-[10px] text-zinc-500">{sublabel}</div>
      )}
    </button>
  );
}
