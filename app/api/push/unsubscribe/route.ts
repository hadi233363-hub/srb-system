// Remove a Web Push subscription — called when the user turns off
// notifications in the UI (or clicks Unsubscribe in their account).
// Only the owner of the subscription (or an owner-tier admin) can delete.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { isOwner } from "@/lib/auth/roles";

interface UnsubscribeBody {
  endpoint?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: UnsubscribeBody;
  try {
    body = (await req.json()) as UnsubscribeBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const endpoint = body.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "missing_endpoint" }, { status: 400 });
  }

  const sub = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (!sub) return NextResponse.json({ ok: true }); // already gone

  if (sub.userId !== session.user.id && !isOwner(session.user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.pushSubscription.delete({ where: { endpoint } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
