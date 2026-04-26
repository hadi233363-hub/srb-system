// Web Push delivery — wraps the `web-push` library so the rest of the code
// can call `pushToUser(userId, payload)` and ignore the cryptography.
//
// VAPID keys (the proof-of-identity the browser asks for) come from env vars.
// They're generated once with: `npx web-push generate-vapid-keys`. The public
// key is shipped to the page (so the browser can subscribe); the private key
// stays on the server.
//
// Failure model:
//   • 404 / 410 from the push service = the subscription expired or the user
//     unsubscribed → we delete the row.
//   • Anything else = transient → we keep the row and log.

import webpush from "web-push";
import { prisma } from "@/lib/db/prisma";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@srb.network";
  if (!publicKey || !privateKey) {
    return false; // not configured — caller decides what to do
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  severity?: "info" | "warning" | "danger" | "success";
  // Free-form data — passed through to the SW. Useful for click handlers.
  data?: Record<string, unknown>;
}

/**
 * Push a payload to every device registered for `userId`. Returns the count
 * of successful deliveries. Subscriptions that the push service tells us
 * are gone (404 / 410) are deleted automatically.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/",
    tag: payload.tag ?? `srb-${Date.now()}`,
    severity: payload.severity ?? "info",
    data: payload.data ?? {},
  });

  let delivered = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json,
          { TTL: 60 * 60 } // hold for up to 1h if device offline
        );
        delivered += 1;
        await prisma.pushSubscription
          .update({
            where: { endpoint: sub.endpoint },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => null);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode ?? 0;
        if (status === 404 || status === 410) {
          // Subscription is gone — clean it up.
          await prisma.pushSubscription
            .delete({ where: { endpoint: sub.endpoint } })
            .catch(() => null);
        } else {
          // eslint-disable-next-line no-console
          console.error("[push] send failed", { endpoint: sub.endpoint.slice(0, 60), status });
        }
      }
    })
  );
  return delivered;
}

/**
 * Push to multiple users in parallel. Used when a single event (e.g. a
 * project deadline) needs to alert every assigned member.
 */
export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  const counts = await Promise.all(userIds.map((id) => pushToUser(id, payload)));
  return counts.reduce((a, b) => a + b, 0);
}
