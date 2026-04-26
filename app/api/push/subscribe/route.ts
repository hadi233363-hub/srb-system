// Stores a Web Push subscription against the signed-in user. The browser
// hands us { endpoint, keys: { p256dh, auth } } after the user grants
// notification permission and `pushManager.subscribe()` succeeds.
//
// Idempotent — if the same endpoint comes in again (same user same device),
// we update the keys instead of creating a duplicate row.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

interface SubscribeBody {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sub = body.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth_ = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth_) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Trim wildly long fields so a misbehaving client can't dump 10MB into
  // the table. Real values are well under 1KB.
  if (endpoint.length > 1000 || p256dh.length > 200 || auth_.length > 200) {
    return NextResponse.json({ error: "field_too_long" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? null;

  // upsert by endpoint — same device returning means we just refresh the keys.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh,
      auth: auth_,
      userId: session.user.id,
      userAgent,
    },
    update: {
      p256dh,
      auth: auth_,
      userId: session.user.id,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}
