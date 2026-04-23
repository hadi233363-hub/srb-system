// Endpoint polled by the client-side ReminderPoller to find meetings that are
// about to start. Returns only meetings where the reminder hasn't been sent yet
// AND the meeting is within the next ~1h10m window, so the client-side code can
// fire a desktop notification and sound at the 1-hour mark.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

const WINDOW_MINUTES = 70; // look up to 70 minutes ahead — gives slack for polling drift

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000);

  const meetings = await prisma.clientMeeting.findMany({
    where: {
      status: "scheduled",
      meetingAt: { gte: now, lte: windowEnd },
      reminderSentAt: null,
    },
    orderBy: { meetingAt: "asc" },
    select: {
      id: true,
      clientName: true,
      companyName: true,
      meetingAt: true,
      durationMin: true,
      location: true,
      meetingLink: true,
      owner: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ meetings, now: now.toISOString() });
}
