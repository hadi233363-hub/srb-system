"use client";

// Tiny button + status pill that lets the user opt into Web Push for THIS
// device. Shown next to the notification bell in the topbar. The flow:
//   1. Check if browser supports Notifications + ServiceWorker + PushManager.
//   2. Register /sw.js if not already registered.
//   3. On click, ask for Notification permission.
//   4. Subscribe to PushManager with the VAPID public key from the server.
//   5. POST the subscription to /api/push/subscribe so we can target it later.
//
// State machine: unsupported → off → enabling → on → error
//
// On iOS, push only works when the app is installed to the home screen
// (Add to Home Screen). We detect that and show a friendly hint.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

type State = "unknown" | "unsupported" | "off" | "enabling" | "on" | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS exposes standalone via navigator; everywhere else uses display-mode.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosStandalone = (window.navigator as any).standalone === true;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return Boolean(iosStandalone || mediaStandalone);
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PushEnableButton() {
  const t = useT();
  const [state, setState] = useState<State>("unknown");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const initialised = useRef(false);

  // Probe browser capabilities + existing subscription on mount.
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    (async () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) {
        setState("unsupported");
        return;
      }

      // iOS Safari: push only works when installed as PWA — show a hint instead
      // of letting the user fail.
      if (isIOS() && !isStandalone()) {
        setState("unsupported");
        return;
      }

      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = reg ? await reg.pushManager.getSubscription() : null;
        setState(existing ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  const enable = useCallback(async () => {
    setErrorMsg(null);
    setState("enabling");
    try {
      // 1. Make sure the SW is registered. Re-register is a no-op if same script.
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ??
        (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;

      // 2. Permission gate.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("off");
        setErrorMsg(t("push.error.permission"));
        return;
      }

      // 3. Public key from server.
      const keyRes = await fetch("/api/push/public-key", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const keyData = (await keyRes.json()) as {
        publicKey: string | null;
        configured: boolean;
      };
      if (!keyData.configured || !keyData.publicKey) {
        setState("error");
        setErrorMsg(t("push.error.notConfigured"));
        return;
      }

      // 4. Subscribe. Cast to BufferSource — TS's lib.dom Uint8Array generic
      // doesn't perfectly match what the WebPush API actually accepts.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          keyData.publicKey
        ) as unknown as BufferSource,
      });

      // 5. Tell the server.
      const csrfToken =
        document.cookie
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("csrf-token="))
          ?.split("=")[1] ?? "";

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        credentials: "same-origin",
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        setState("error");
        setErrorMsg(t("push.error.serverReject"));
        return;
      }

      setState("on");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : t("push.error.generic"));
    }
  }, [t]);

  const disable = useCallback(async () => {
    setErrorMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const csrfToken =
          document.cookie
            .split(";")
            .map((c) => c.trim())
            .find((c) => c.startsWith("csrf-token="))
            ?.split("=")[1] ?? "";
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          credentials: "same-origin",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : t("push.error.generic"));
    }
  }, [t]);

  if (state === "unknown") {
    return null;
  }

  if (state === "unsupported") {
    const iosNeedsInstall = isIOS() && !isStandalone();
    return (
      <div className="relative">
        <button
          onClick={() => setShowHint((v) => !v)}
          className="flex h-9 items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 text-[10px] text-zinc-500 hover:border-zinc-700"
          aria-label={t("push.unsupported.label")}
        >
          <BellOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("push.unsupported.label")}</span>
        </button>
        {showHint && (
          <div className="absolute end-0 top-11 z-50 w-72 max-w-[92vw] rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 text-[11px] text-zinc-300 shadow-2xl shadow-black/60">
            {iosNeedsInstall ? (
              <div className="space-y-1.5">
                <div className="font-semibold text-amber-300">
                  {t("push.iosHint.title")}
                </div>
                <ol className="list-inside list-decimal space-y-1 text-zinc-400">
                  <li>{t("push.iosHint.step1")}</li>
                  <li>{t("push.iosHint.step2")}</li>
                  <li>{t("push.iosHint.step3")}</li>
                </ol>
              </div>
            ) : (
              t("push.unsupported.desc")
            )}
          </div>
        )}
      </div>
    );
  }

  const onClick = state === "on" ? disable : enable;
  const Icon = state === "on" ? BellRing : state === "enabling" ? Loader2 : Bell;
  const label =
    state === "on"
      ? t("push.on")
      : state === "enabling"
      ? t("push.enabling")
      : t("push.off");
  const tone =
    state === "on"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
      : state === "error"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
      : "border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:border-zinc-700";

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={state === "enabling"}
        className={cn(
          "flex h-9 items-center gap-1 rounded-full border px-2.5 text-[10px] transition disabled:opacity-60",
          tone
        )}
        aria-label={label}
        title={errorMsg ?? label}
      >
        <Icon className={cn("h-3.5 w-3.5", state === "enabling" && "animate-spin")} />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </div>
  );
}
