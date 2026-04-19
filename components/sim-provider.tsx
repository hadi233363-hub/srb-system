"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ActivityEntry, Scenario, SimState } from "@/lib/sim/types";

interface SimContextValue {
  state: SimState | null;
  connected: boolean;
  setSpeed: (n: number) => void;
  pause: () => void;
  play: () => void;
  reset: () => void;
  decide: (scenarioId: string, choiceKey: string) => Promise<void>;
  spawn: (templateId: string) => Promise<{ ok: boolean; scenario?: Scenario; error?: string }>;
  action: (type: string, params?: Record<string, unknown>) => Promise<{ ok: boolean; message: string }>;
}

const SimContext = createContext<SimContextValue | null>(null);

export function useSim(): SimContextValue {
  const v = useContext(SimContext);
  if (!v) throw new Error("useSim must be used inside <SimProvider>");
  return v;
}

export function SimProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SimState | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/sim/stream");
    esRef.current = es;

    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as SimState;
        setState(data);
        setConnected(true);
      } catch {}
    });

    es.addEventListener("activity", (e) => {
      try {
        const entry = JSON.parse((e as MessageEvent).data) as ActivityEntry;
        setState((prev) => {
          if (!prev) return prev;
          const exists = prev.activityLog.some((a) => a.id === entry.id);
          if (exists) return prev;
          return {
            ...prev,
            activityLog: [entry, ...prev.activityLog].slice(0, 150),
          };
        });
      } catch {}
    });

    es.onerror = () => setConnected(false);
    es.onopen = () => setConnected(true);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  const control = async (action: string, value?: number) => {
    try {
      await fetch("/api/sim/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value }),
      });
    } catch {}
  };

  const decide = async (scenarioId: string, choiceKey: string) => {
    try {
      await fetch("/api/sim/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, choiceKey }),
      });
    } catch {}
  };

  const spawn = async (
    templateId: string
  ): Promise<{ ok: boolean; scenario?: Scenario; error?: string }> => {
    try {
      const res = await fetch("/api/sim/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      return (await res.json()) as { ok: boolean; scenario?: Scenario; error?: string };
    } catch {
      return { ok: false, error: "فشل الاتصال" };
    }
  };

  const action = async (
    type: string,
    params?: Record<string, unknown>
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await fetch("/api/sim/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, params }),
      });
      return (await res.json()) as { ok: boolean; message: string };
    } catch {
      return { ok: false, message: "فشل الاتصال" };
    }
  };

  return (
    <SimContext.Provider
      value={{
        state,
        connected,
        setSpeed: (n) => control("speed", n),
        pause: () => control("pause"),
        play: () => control("play"),
        reset: () => control("reset"),
        decide,
        spawn,
        action,
      }}
    >
      {children}
    </SimContext.Provider>
  );
}
