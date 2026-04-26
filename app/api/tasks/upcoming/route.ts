// Polled by the in-app reminder bar to find tasks that are about to be due,
// or are already overdue, for the signed-in user. Returns at most two windows:
//
//   1. Due-soon: dueAt within the next 60 minutes, reminderBeforeSentAt is null,
//      task is still open (todo / in_progress / in_review), and the user is the
//      assignee or a collaborator.
//
//   2. Overdue-with-slack: dueAt has passed, the task is still open, and the
//      project deadlineAt is either null OR still in the future (i.e. there's
//      still slack to recover). reminderOverdueSentAt must be null. Surfaces
//      the situation the owner specifically called out: a TASK passed its
//      internal deadline but the CLIENT delivery date is still salvageable.
//
// Returns an array per window so the client can fire one notification per task
// per window with idempotent server-side flags.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

const DUE_SOON_WINDOW_MIN = 70; // 70m so polling drift doesn't miss the 60m mark

const OPEN_STATUSES = ["todo", "in_progress", "in_review"];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const soonWindowEnd = new Date(now.getTime() + DUE_SOON_WINDOW_MIN * 60 * 1000);

  // Tasks the user is responsible for: assignee OR collaborator.
  const baseFilter = {
    status: { in: OPEN_STATUSES },
    OR: [
      { assigneeId: userId },
      { collaborators: { some: { userId } } },
    ],
  };

  const [dueSoon, overdue] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...baseFilter,
        dueAt: { gte: now, lte: soonWindowEnd },
        reminderBeforeSentAt: null,
      },
      orderBy: { dueAt: "asc" },
      select: {
        id: true,
        title: true,
        dueAt: true,
        priority: true,
        project: { select: { id: true, title: true, deadlineAt: true } },
      },
      take: 20,
    }),
    prisma.task.findMany({
      where: {
        ...baseFilter,
        dueAt: { lt: now },
        reminderOverdueSentAt: null,
        // Project still recoverable: no project deadline OR deadline in future.
        OR: [
          { projectId: null },
          { project: { deadlineAt: null } },
          { project: { deadlineAt: { gte: now } } },
        ],
      },
      orderBy: { dueAt: "asc" },
      select: {
        id: true,
        title: true,
        dueAt: true,
        priority: true,
        project: { select: { id: true, title: true, deadlineAt: true } },
      },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    dueSoon,
    overdue,
    now: now.toISOString(),
  });
}
