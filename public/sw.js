// SRB Service Worker — handles Web Push notifications + offline shell.
//
// Lives at /sw.js so its scope is the whole origin. When the browser receives
// a push from our backend (via /api/push/send → web-push library → FCM or APNs)
// it wakes the SW, runs the `push` listener, and shows the notification —
// even if the SRB tab is closed and the phone is locked. This is the only
// reliable way to deliver alerts on mobile when the user isn't looking at
// the page.
//
// Note: iOS Safari requires the user to first install the app to the home
// screen (Add to Home Screen) before push works. Android Chrome works
// directly from the browser.

const CACHE_NAME = "srb-v1";

// Skip waiting so a new SW activates as soon as it's installed — keeps
// production deploys from being stuck on a stale worker for the typical
// user lifetime.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------------------------
// Push handler — invoked by the browser when our server sends a Web Push.
// Payload format (JSON):
//   {
//     title: string
//     body?: string
//     url?: string         // where to navigate when the user taps
//     tag?: string         // dedupe key — same tag replaces previous notification
//     icon?: string        // override default icon
//     badge?: string       // small monochrome icon for status bar (Android)
//     severity?: "info"|"warning"|"danger"|"success"
//     vibrate?: number[]   // ms pattern
//   }
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    // Fallback for plain-text pushes
    payload = { title: "SRB", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "SRB";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/srb-logo.png",
    badge: payload.badge || "/srb-logo-white.png",
    tag: payload.tag || `srb-${Date.now()}`,
    data: { url: payload.url || "/" },
    requireInteraction: payload.severity === "danger",
    vibrate: payload.vibrate || [200, 100, 200],
    dir: "rtl",
    lang: "ar",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------------------------------------------------------------------------
// Click handler — focus an existing tab if one is open at the target URL,
// otherwise open a new one.
// ---------------------------------------------------------------------------

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Prefer reusing an open tab on the same origin.
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.origin === target.origin && "focus" in client) {
            await client.focus();
            // Navigate to the target route if we can.
            if ("navigate" in client) {
              await client.navigate(target.href);
            }
            return;
          }
        } catch {
          // bad URL — ignore and continue
        }
      }

      // No matching client — open a new window.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// ---------------------------------------------------------------------------
// Push subscription change — re-subscribe automatically if the browser
// invalidates the old subscription (this can happen after token rotation).
// We POST the new subscription back to the server so it can replace the
// stored row.
// ---------------------------------------------------------------------------

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
        // Refetch the public key the same way the page does, then resubscribe.
        const keyRes = await fetch("/api/push/public-key", { credentials: "same-origin" });
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        await fetch("/api/push/resubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            oldEndpoint,
            subscription: newSub.toJSON(),
          }),
        });
      } catch {
        // Best-effort — if we can't refresh, the next page load will reconcile.
      }
    })()
  );
});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
