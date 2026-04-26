"use client";

// Bell icon for the topbar. Polls /api/notifications/recent every 30s to keep
// the unread badge fresh, and pops a panel showing the latest 30 entries when
// clicked. Marks-as-read on open so the badge clears as soon as the user
// acknowledges them.
//
// Permission gate: every authed user sees the bell. Notifications are scoped
// per recipient at the DB layer so an employee never sees the owner's
// finance-threshold alerts.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { markNotificationsReadAction } from "@/app/notifications/actions";

const POLL_INTERVAL_MS = 30_000;

interface Notif {
  id: string;
  kind: string;
  severity: "info" | "success" | "warning" | "danger";
  title: string;
  body: string | null;
  linkUrl: string | null;
  refType: string | null;
  refId: string | null;
  readAt: string | null;
  createdAt: string;
}

const SEVERITY_TONE: Record<Notif["severity"], string> = {
  info: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  danger: "border-rose-500/30 bg-rose-500/5 text-rose-300",
};

export function NotificationBell() {
  const t = useT();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/recent", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Notif[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // ignore — next poll will retry
    }
  }, []);

  useEffect(() => {
    // Defer the first call to the next microtask so we don't trigger a
    // setState during the effect body (avoids React's set-state-in-effect lint
    // warning and keeps the initial render cheap).
    void Promise.resolve().then(refresh);
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Click-outside to close the panel.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && unread > 0) {
        // Optimistic clear, then sync server.
        setUnread(0);
        setItems((items) =>
          items.map((it) => (it.readAt ? it : { ...it, readAt: new Date().toISOString() }))
        );
        void markNotificationsReadAction().catch(() => {});
      }
      return next;
    });
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/70 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
        aria-label={t("notifications.title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute end-0 top-11 z-50 w-80 max-w-[92vw] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Inbox className="h-3.5 w-3.5" />
              {t("notifications.title")}
            </div>
            {items.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <CheckCheck className="h-3 w-3" />
                {t("notifications.allRead")}
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-zinc-500">
                <Inbox className="h-6 w-6 text-zinc-700" />
                {t("notifications.empty")}
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/60">
                {items.map((n) => (
                  <li key={n.id}>
                    <a
                      href={n.linkUrl ?? "#"}
                      onClick={() => n.linkUrl && setOpen(false)}
                      className={cn(
                        "block px-4 py-2.5 transition hover:bg-zinc-900/70",
                        !n.readAt && "bg-zinc-900/40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                            n.severity === "danger" && "bg-rose-500",
                            n.severity === "warning" && "bg-amber-500",
                            n.severity === "success" && "bg-emerald-500",
                            n.severity === "info" && "bg-sky-500"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-zinc-100">
                            {n.title}
                          </div>
                          {n.body && (
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              {n.body}
                            </div>
                          )}
                          <div className="mt-1 text-[10px] text-zinc-600">
                            {new Date(n.createdAt).toLocaleString("ar")}
                          </div>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export severity tone constants in case other surfaces (e.g. a future
// /notifications full page) want the same color palette.
export { SEVERITY_TONE };
