// Owner requests changes on a task.
//   - Owner provides a reason in the JSON body { reason: string }.
//   - Status flips back to `in_progress`.
//   - reviewNote stored on the Task row + the latest TaskSubmission row.
//   - Submitter (assignee) gets an in-app + Web Push notification with the
//     reason so they know what to fix.
// Owner-only.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { isOwner } from "@/lib/auth/roles";
import { createNotification } from "@/lib/db/notifications";
import { safeString, MAX_LONG_TEXT } from "@/lib/input-limits";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isOwner(session.user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let reason: string | null;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.toLowerCase().includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      reason = safeString(body.reason ?? body.reviewNote, MAX_LONG_TEXT);
    } else {
      const form = await req.formData();
      reason = safeString(
        form.get("reason") ?? form.get("reviewNote"),
        MAX_LONG_TEXT
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "إدخال غير صحيح" },
      { status: 400 }
    );
  }

  if (!reason) {
    return NextResponse.json(
      { error: "اكتب سبب طلب التعديل" },
      { status: 400 }
    );
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

  const submission = task.submissions[0] ?? null;
  const now = new Date();

  await prisma.$transaction([
    prisma.task.update({
      where: { id },
      data: {
        status: "in_progress",
        reviewNote: reason,
        reviewedAt: now,
      },
    }),
    ...(submission
      ? [
          prisma.taskSubmission.update({
            where: { id: submission.id },
            data: {
              status: "changes_requested",
              reviewerId: session.user.id,
              reviewedAt: now,
              reviewNotes: reason,
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
        toValue: "in_progress",
      },
    }),
  ]);

  const recipientId = submission?.submitterId ?? task.assigneeId;
  if (recipientId && recipientId !== session.user.id) {
    await createNotification({
      recipientId,
      kind: "task.changes_requested",
      severity: "warning",
      title: `طُلب تعديل على "${task.title}"`,
      body: reason,
      linkUrl: task.projectId ? `/projects/${task.projectId}` : "/tasks",
      refType: "task",
      refId: id,
    }).catch(() => null);
  }

  await logAudit({
    action: "task.update",
    target: { type: "task", id, label: task.title },
    metadata: { event: "submission.changes_requested" },
  });

  return NextResponse.json({ ok: true });
}
