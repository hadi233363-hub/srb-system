// Service-worker calls this when the browser rotates the subscription
// (pushsubscriptionchange event). We replace the old endpoint with the
// new one, keeping the same user binding.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

interface ResubBody {
  oldEndpoint?: string;
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

  let body: ResubBody;
  try {
    body = (await req.json()) as ResubBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const newEndpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth_ = body.subscription?.keys?.auth;
  if (!newEndpoint || !p256dh || !auth_) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Drop the old row if we know what it was (and it belonged to this user).
  if (body.oldEndpoint) {
    await prisma.pushSubscription
      .deleteMany({
        where: { endpoint: body.oldEndpoint, userId: session.user.id },
      })
      .catch(() => null);
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: newEndpoint },
    create: {
      endpoint: newEndpoint,
      p256dh,
      auth: auth_,
      userId: session.user.id,
    },
    update: {
      p256dh,
      auth: auth_,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
