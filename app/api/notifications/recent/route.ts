// Bell-icon poller. Returns the recent notifications for the signed-in user
// plus the unread count. Cheap query — kept tight (last 30 entries) so the
// 30-second poll stays light.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listForUser, unreadCount } from "@/lib/db/notifications";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [items, unread] = await Promise.all([
    listForUser(session.user.id, { limit: 30 }),
    unreadCount(session.user.id),
  ]);

  return NextResponse.json({
    items,
    unread,
    now: new Date().toISOString(),
  });
}
