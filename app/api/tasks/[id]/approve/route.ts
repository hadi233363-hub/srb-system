// Owner approves the latest submission on a task.
//   - Status flips to `done`, completedAt stamped.
//   - Latest TaskSubmission row marked approved.
//   - Submitter (assignee) gets an in-app + Web Push notification.
// Owner-only (role admin).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { isOwner } from "@/lib/auth/roles";
import { createNotification } from "@/lib/db/notifications";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isOwner(session.user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true } },
      submissions: {
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!task) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Allow approve when there is a submitted snapshot OR a pending history
  // row. The status check is loose so the owner can approve whatever is
  // currently in_review.
  if (task.status !== "in_review" && task.submissions.length === 0) {
    return NextResponse.json(
      { error: "ما فيه تسليم بانتظار المراجعة" },
      { status: 400 }
    );
  }

  const now = new Date();
  const submission = task.submissions[0] ?? null;

  await prisma.$transaction([
    prisma.task.update({
      where: { id },
      data: {
        status: "done",
        completedAt: now,
        reviewedAt: now,
        // Keep submissionUrl/fileUrl on the row as the deliverable record.
      },
    }),
    ...(submission
      ? [
          prisma.taskSubmission.update({
            where: { id: submission.id },
            data: {
              status: "approved",
              reviewerId: session.user.id,
              reviewedAt: now,
            },
          }),
        ]
      : []),
    prisma.taskUpdate.create({
      data: {
        taskId: id,
        actorId: session.user.id,
        type: "status_change",
        fromValue: task.status,
        toValue: "done",
      },
    }),
  ]);

  // Notify the submitter (the assignee — or the prior submitter if known).
  const recipientId = submission?.submitterId ?? task.assigneeId;
  if (recipientId && recipientId !== session.user.id) {
    await createNotification({
      recipientId,
      kind: "task.approved",
      severity: "success",
      title: `تمت الموافقة على "${task.title}"`,
      body: "شغلك انعتمد ✅",
      linkUrl: task.projectId ? `/projects/${task.projectId}` : "/tasks",
      refType: "task",
      refId: id,
    }).catch(() => null);
  }

  await logAudit({
    action: "task.update",
    target: { type: "task", id, label: task.title },
    metadata: { event: "submission.approved" },
  });

  return NextResponse.json({ ok: true });
}
