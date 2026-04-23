"use client";

// Background poller for monthly-invoice reminders. Same pattern as
// meeting-reminder.tsx: polls every 30s, fires desktop notifications + a
// short beep, marks the server-side flag so other tabs don't double-fire,
// and stores fired IDs in localStorage as a second line of defence.
//
// Three alert windows per cycle:
//   * 3 days before due (soft)
//   * due today (action)
//   * overdue by >= 1 day (follow-up)

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { markInvoiceReminderSentAction } from "@/app/projects/actions";

const POLL_INTERVAL_MS = 30_000;
const LOCAL_STORAGE_KEY = "srb_fired_invoice_reminders";

interface InvoiceCandidate {
  id: string;
  title: string;
  budgetQar: number;
  billingCycleDays: number;
  nextInvoiceDueAt: string;
  client: { name: string } | null;
}

interface BillingDueResponse {
  before: InvoiceCandidate[];
  due: InvoiceCandidate[];
  overdue: InvoiceCandidate[];
  now: string;
}

function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 760;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    osc.onended = () => ctx.close();
  } catch {
    // best-effort
  }
}

function getFired(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function addFired(id: string) {
  try {
    const s = getFired();
    s.add(id);
    const arr = Array.from(s).slice(-200);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function formatQar(n: number): string {
  return `${Math.round(n).toLocaleString("en")} ر.ق`;
}

export function InvoiceReminder() {
  const t = useT();
  const [permissionRequested, setPermissionRequested] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fire = useCallback(
    (p: InvoiceCandidate, which: "before" | "due" | "overdue") => {
      const clientName = p.client?.name || p.title;
      const amount = formatQar(p.budgetQar);

      const titleKey = `invoice.reminder.${which}.title`;
      const bodyKey = `invoice.reminder.${which}.body`;
      const title = t(titleKey).replace("{client}", clientName);
      let body = t(bodyKey)
        .replace("{client}", clientName)
        .replace("{amount}", amount);

      if (which === "overdue") {
        const daysLate = Math.max(
          1,
          Math.floor(
            (Date.now() - new Date(p.nextInvoiceDueAt).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        );
        body = body.replace("{days}", String(daysLate));
      }

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(title, {
            body,
            icon: "/srb-logo-white.png",
            tag: `invoice-${p.id}-${which}`,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            window.location.href = `/projects/${p.id}`;
            n.close();
          };
        } catch {
          // ignore
        }
      }

      playBeep();
      addFired(`invoice-${p.id}-${which}`);
      void markInvoiceReminderSentAction(p.id, which).catch(() => {});
    },
    [t]
  );

  const poll = useCallback(async () => {
    const fired = getFired();
    try {
      const res = await fetch("/api/projects/billing-due", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as BillingDueResponse;

      for (const p of data.before) {
        const key = `invoice-${p.id}-before`;
        if (!fired.has(key)) fire(p, "before");
      }
      for (const p of data.due) {
        const key = `invoice-${p.id}-due`;
        if (!fired.has(key)) fire(p, "due");
      }
      for (const p of data.overdue) {
        const key = `invoice-${p.id}-overdue`;
        if (!fired.has(key)) fire(p, "overdue");
      }
    } catch {
      // ignore
    }
  }, [fire]);

  useEffect(() => {
    if (
      !permissionRequested &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().finally(() =>
        setPermissionRequested(true)
      );
    }
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll, permissionRequested]);

  return null;
}
