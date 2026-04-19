"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSim } from "./sim-provider";
import { formatSimClock, formatSimDay } from "@/lib/format";

const speeds = [1, 10, 100, 1000];

export function LiveTopbar() {
  const { state, pause, play, setSpeed, reset, connected } = useSim();

  if (!state) {
    return (
      <header className="flex items-center border-b border-zinc-800 bg-zinc-900/30 px-6 py-3 text-sm text-zinc-500">
        <span className="animate-pulse">يتصل بالمحاكاة...</span>
      </header>
    );
  }

  const running = !state.paused && connected;

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/30 px-6 py-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-60",
              running ? "animate-ping bg-emerald-500" : "bg-amber-500"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              running ? "bg-emerald-500" : "bg-amber-500"
            )}
          />
        </span>
        <span className="text-zinc-300">
          {state.paused ? "متوقف مؤقتاً" : "وضع المحاكاة"}
        </span>
        <span className="text-zinc-700">·</span>
        <span className="tabular-nums text-zinc-500">
          {formatSimDay(state.startedAt, state.simTime)}
        </span>
        <span className="text-zinc-700">·</span>
        <span className="tabular-nums text-zinc-500">
          {formatSimClock(state.simTime)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          aria-label={state.paused ? "تشغيل" : "إيقاف مؤقت"}
          onClick={() => (state.paused ? play() : pause())}
          className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          {state.paused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </button>
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs tabular-nums transition",
              state.speedMultiplier === s && !state.paused
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            )}
          >
            {s}×
          </button>
        ))}
        <button
          aria-label="إعادة"
          onClick={() => {
            if (confirm("تبي تعيد المحاكاة من الصفر؟")) reset();
          }}
          className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
