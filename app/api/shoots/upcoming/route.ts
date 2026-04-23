// Endpoint polled by the ShootReminder to find shoots that are about to happen.
// Returns shoots within the next 25 hours that haven't fired their notification
// for the current window (24h or 1h). The client filters for the actual window.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

const WINDOW_HOURS = 25;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  const shoots = await prisma.photoShoot.findMany({
    where: {
      status: "scheduled",
      shootDate: { gte: now, lte: windowEnd },
    },
    orderBy: { shootDate: "asc" },
    select: {
      id: true,
      title: true,
      shootDate: true,
      durationHours: true,
      location: true,
      locationNotes: true,
      mapUrl: true,
      reminderDayBeforeSentAt: true,
      reminderHourBeforeSentAt: true,
      crew: {
        select: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Only send shoots where the CURRENT user is on crew. This way each
  // photographer is alerted for their own shoots — not someone else's.
  const myShoots = shoots.filter((s) =>
    s.crew.some((c) => c.user.id === session.user.id)
  );

  return NextResponse.json({ shoots: myShoots, now: now.toISOString() });
}
