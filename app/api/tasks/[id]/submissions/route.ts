// Per-task submission history. The task-detail modal pulls this lazily when
// it opens so we don't ship every submission row over the kanban payload.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!task) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const submissions = await prisma.taskSubmission.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      submitter: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ items: submissions });
}
