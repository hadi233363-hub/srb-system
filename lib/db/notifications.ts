// Per-user notification helpers. The bell icon in the topbar polls
// /api/notifications/recent every 30s; server actions and reminder fires
// drop new rows here. We deliberately keep titles + bodies pre-localized
// so we can avoid round-tripping through i18n at render time — the writer
// uses the SAME locale resolver as the rest of the app.

import { prisma } from "./prisma";

export type NotificationSeverity = "info" | "success" | "warning" | "danger";

export interface CreateNotificationInput {
  recipientId: string;
  kind: string;
  title: string;
  body?: string | null;
  severity?: NotificationSeverity;
  linkUrl?: string | null;
  refType?: string | null;
  refId?: string | null;
  // Dedupe key — when given, we skip creating a new row if one already exists
  // for the same recipient + kind + refId. Prevents flooding the inbox if
  // a poller fires twice for the same condition.
  dedupeKey?: { kind: string; refType: string; refId: string };
}

export async function createNotification(input: CreateNotificationInput) {
  if (input.dedupeKey) {
    const existing = await prisma.notification.findFirst({
      where: {
        recipientId: input.recipientId,
        kind: input.dedupeKey.kind,
        refType: input.dedupeKey.refType,
        refId: input.dedupeKey.refId,
      },
      select: { id: true },
    });
    if (existing) return existing;
  }

  return prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      severity: input.severity ?? "info",
      linkUrl: input.linkUrl ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
    },
  });
}

/**
 * Same as createNotification but for many recipients at once. Used when a single
 * event (e.g. a project deadline approaching) needs to alert every assigned
 * member. Failures are swallowed per-recipient so one bad row doesn't block
 * the rest.
 */
export async function createNotificationMany(
  recipientIds: string[],
  input: Omit<CreateNotificationInput, "recipientId">
) {
  await Promise.all(
    recipientIds.map((recipientId) =>
      createNotification({ ...input, recipientId }).catch(() => null)
    )
  );
}

export async function listForUser(
  recipientId: string,
  options?: { limit?: number; unreadOnly?: boolean }
) {
  return prisma.notification.findMany({
    where: {
      recipientId,
      ...(options?.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 30,
  });
}

export async function unreadCount(recipientId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientId, readAt: null },
  });
}

export async function markRead(recipientId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: {
      recipientId,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}
