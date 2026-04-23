"use client";

// Global background poller — checks every 30s for upcoming events and fires
// desktop notifications + sound at the appropriate windows:
//   * Client meetings: 1 hour before.
//   * Photo shoots: 24 hours before AND 1 hour before (crew needs prep time).
//
// Reliability notes:
// - Polling (not push) because the app is Windows-local, not deployed with a worker.
// - Reminders are tracked server-side (reminderSentAt columns) so a second tab
//   doesn't double-fire. After showing the notification we POST back to mark it.
// - localStorage also tracks fired IDs per-browser + window so even if the server
//   is slow to persist, we don't re-alert for the same event in the same session.

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { markReminderSentAction } from "@/app/meetings/actions";
import {
  markShootDayReminderSentAction,
  markShootHourReminderSentAction,
} from "@/app/shoots/actions";

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const REMIND_MINUTES_BEFORE = 60; // 1 hour
const SHOOT_DAY_BEFORE_MINUTES = 24 * 60;
const LOCAL_STORAGE_KEY = "srb_fired_reminders";

interface UpcomingMeeting {
  id: string;
  clientName: string;
  companyName: string | null;
  meetingAt: string;
  durationMin: number;
  location: string | null;
  meetingLink: string | null;
  owner: { id: string; name: string } | null;
}

interface UpcomingShoot {
  id: string;
  title: string;
  shootDate: string;
  durationHours: number;
  location: string;
  locationNotes: string | null;
  mapUrl: string | null;
  reminderDayBeforeSentAt: string | null;
  reminderHourBeforeSentAt: string | null;
  crew: { user: { id: string; name: string } }[];
}

/** Small helper: play a short beep so the alert is audible even if notifications are muted. */
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
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    osc.onended = () => ctx.close();
  } catch {
    // Best-effort — silence failures.
  }
}

function getFired(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function addFired(id: string) {
  try {
    const s = getFired();
    s.add(id);
    // Cap at 200 to avoid unbounded growth
    const arr = Array.from(s).slice(-200);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export function MeetingReminder() {
  const t = useT();
  const [permissionRequested, setPermissionRequested] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fire = useCallback(
    (m: UpcomingMeeting) => {
      const minsAway = Math.max(
        0,
        Math.round((new Date(m.meetingAt).getTime() - Date.now()) / 60_000)
      );
      const title = `${t("meetings.reminder.title")} · ${m.clientName}`;
      const companySuffix = m.companyName ? ` (${m.companyName})` : "";
      const body = `${t("meetings.reminder.in")} ${minsAway} ${t(
        "meetings.reminder.minutes"
      )}${companySuffix}${m.location ? ` · ${m.location}` : ""}`;

      // Desktop notification (best-effort)
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(title, {
            body,
            icon: "/srb-logo-white.png",
            tag: `meeting-${m.id}`,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            window.location.href = "/meetings";
            n.close();
          };
        } catch {
          // some browsers throw on certain configs
        }
      }

      playBeep();
      addFired(m.id);

      // Tell the server so other browsers/tabs don't re-alert.
      void markReminderSentAction(m.id).catch(() => {});
    },
    [t]
  );

  const fireShoot = useCallback(
    (s: UpcomingShoot, when: "day" | "hour") => {
      const minsAway = Math.max(
        0,
        Math.round((new Date(s.shootDate).getTime() - Date.now()) / 60_000)
      );
      const title =
        when === "day"
          ? `📸 ${t("shoots.reminder.titleDay")} · ${s.title}`
          : `📸 ${t("shoots.reminder.titleHour")} · ${s.title}`;
      const body = `${t("shoots.reminder.in")} ${
        when === "day"
          ? Math.round(minsAway / 60) + " " + t("shoots.reminder.hours")
          : minsAway + " " + t("shoots.reminder.minutes")
      } · ${s.location}`;

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(title, {
            body,
            icon: "/srb-logo-white.png",
            tag: `shoot-${s.id}-${when}`,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            window.location.href = "/shoots";
            n.close();
          };
        } catch {
          // ignore
        }
      }

      playBeep();
      addFired(`shoot-${s.id}-${when}`);

      void (when === "day"
        ? markShootDayReminderSentAction(s.id).catch(() => {})
        : markShootHourReminderSentAction(s.id).catch(() => {}));
    },
    [t]
  );

  const poll = useCallback(async () => {
    const now = Date.now();
    const fired = getFired();

    // Meetings: 1h before
    try {
      const res = await fetch("/api/meetings/upcoming", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { meetings: UpcomingMeeting[] };
        const threshold = REMIND_MINUTES_BEFORE * 60 * 1000;
        for (const m of data.meetings) {
          if (fired.has(m.id)) continue;
          const msUntil = new Date(m.meetingAt).getTime() - now;
          if (msUntil <= threshold && msUntil > -60_000) {
            fire(m);
          }
        }
      }
    } catch {
      // ignore
    }

    // Shoots: 24h before + 1h before
    try {
      const res = await fetch("/api/shoots/upcoming", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { shoots: UpcomingShoot[] };
        const hourThreshold = REMIND_MINUTES_BEFORE * 60 * 1000;
        const dayThreshold = SHOOT_DAY_BEFORE_MINUTES * 60 * 1000;
        for (const s of data.shoots) {
          const msUntil = new Date(s.shootDate).getTime() - now;
          if (msUntil <= 0 && msUntil > -60_000) continue;

          // 24h-before window — fire once when between 23.5h and 24.5h before.
          const dayKey = `shoot-${s.id}-day`;
          if (
            !s.reminderDayBeforeSentAt &&
            !fired.has(dayKey) &&
            msUntil <= dayThreshold &&
            msUntil > dayThreshold - 60 * 60 * 1000 // inside the 1-hour slot around the 24h mark
          ) {
            fireShoot(s, "day");
          }

          // 1h-before window
          const hourKey = `shoot-${s.id}-hour`;
          if (
            !s.reminderHourBeforeSentAt &&
            !fired.has(hourKey) &&
            msUntil <= hourThreshold &&
            msUntil > -60_000
          ) {
            fireShoot(s, "hour");
          }
        }
      }
    } catch {
      // ignore
    }
  }, [fire, fireShoot]);

  useEffect(() => {
    // Ask for notification permission once (non-blocking).
    if (
      !permissionRequested &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().finally(() => setPermissionRequested(true));
    }

    // Poll immediately, then on interval.
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll, permissionRequested]);

  // Renders nothing visible — it's a background runner.
  return null;
}
