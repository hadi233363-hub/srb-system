// Employee submits work for a task. Accepts JSON or multipart/form-data with
// optional `linkUrl`, optional `fileUrl` (already uploaded via
// /api/tasks/upload), `fileName`, `fileType`, and an optional `note`.
//
// Side effects:
//   1. Writes the latest submission fields onto the Task row (flat snapshot).
//   2. Appends a TaskSubmission history row.
//   3. Flips the task status to `in_review` (NOT done).
//   4. Notifies every active owner via in-app + Web Push.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/db/audit";
import { isOwner } from "@/lib/auth/roles";
import { createNotificationMany } from "@/lib/db/notifications";
import { sanitizeLinkUrl, saveUploadedFile } from "@/lib/uploads";
import { safeString, MAX_LONG_TEXT, MAX_NAME_LEN } from "@/lib/input-limits";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      collaborators: { select: { userId: true } },
      project: { select: { id: true, title: true } },
    },
  });
  if (!task) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Assignee + collaborators can submit. Admin (the owner of the system)
  // can also submit on behalf — they manage every project end-to-end.
  const me = session.user.id;
  const isAssignee = task.assigneeId === me;
  const isCollab = task.collaborators.some((c) => c.userId === me);
  const isAdmin = isOwner(session.user.role);
  if (!isAssignee && !isCollab && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Accept either JSON or multipart so the client can do a one-shot file +
  // link submit, or upload first via /api/tasks/upload and then send JSON.
  let linkUrl: string | null = null;
  let fileUrl: string | null = null;
  let fileName: string | null = null;
  let fileType: string | null = null;
  let note: string | null = null;

  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.toLowerCase().includes("multipart/form-data")) {
      const form = await req.formData();
      linkUrl = sanitizeLinkUrl(form.get("linkUrl"));
      note = safeString(form.get("note"), MAX_LONG_TEXT);
      const fileEntry = form.get("file");
      if (fileEntry && typeof fileEntry !== "string") {
        const f = fileEntry as File;
        if (f.size > 0) {
          const saved = await saveUploadedFile(f, "tasks");
          fileUrl = saved.url;
          fileName = saved.fileName;
          fileType = saved.fileType;
        }
      }
      // Allow client-side pre-upload: pass the URL straight through.
      if (!fileUrl) {
        const passedUrl = safeString(form.get("fileUrl"), 2000);
        if (passedUrl) fileUrl = passedUrl;
        fileName = safeString(form.get("fileName"), MAX_NAME_LEN);
        fileType = safeString(form.get("fileType"), 100);
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      linkUrl = sanitizeLinkUrl(body.linkUrl);
      note = safeString(body.note, MAX_LONG_TEXT);
      const passedUrl = safeString(body.fileUrl, 2000);
      if (passedUrl) {
        // Force same-origin /uploads paths — never trust an absolute URL.
        if (!passedUrl.startsWith("/uploads/")) {
          return NextResponse.json(
            { error: "fileUrl must reference /uploads/" },
            { status: 400 }
          );
        }
        fileUrl = passedUrl;
        fileName = safeString(body.fileName, MAX_NAME_LEN);
        fileType = safeString(body.fileType, 100);
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "إدخال غير صحيح" },
      { status: 400 }
    );
  }

  if (!linkUrl && !fileUrl) {
    return NextResponse.json(
      { error: "أرفق رابط أو ملف على الأقل" },
      { status: 400 }
    );
  }

  const now = new Date();

  await prisma.$transaction([
    // Latest snapshot on the Task row.
    prisma.task.update({
      where: { id },
      data: {
        status: "in_review",
        submissionUrl: linkUrl,
        submissionFileUrl: fileUrl,
        submissionFileName: fileName,
        submissionFileType: fileType,
        submissionNote: note,
        submittedAt: now,
        // Clear any prior review note — this is a fresh submission.
        reviewNote: null,
        reviewedAt: null,
        ...(task.startedAt ? {} : { startedAt: now }),
      },
    }),
    // Append-only history row.
    prisma.taskSubmission.create({
      data: {
        taskId: id,
        submitterId: me,
        linkUrl: linkUrl,
        fileUrl: fileUrl,
        fileName: fileName,
        fileType: fileType,
        note: note,
        status: "pending",
      },
    }),
    prisma.taskUpdate.create({
      data: {
        taskId: id,
        actorId: me,
        type: "status_change",
        fromValue: task.status,
        toValue: "in_review",
      },
    }),
  ]);

  // Notify every active owner (admin = الرئيس).
  const owners = await prisma.user.findMany({
    where: { role: "admin", active: true },
    select: { id: true },
  });
  if (owners.length > 0) {
    await createNotificationMany(
      owners.map((o) => o.id),
      {
        kind: "task.submitted",
        severity: "info",
        title: `${session.user.name ?? "موظف"} سلّم مهمة "${task.title}" — راجعها`,
        body: task.project ? `المشروع: ${task.project.title}` : null,
        linkUrl: task.projectId ? `/projects/${task.projectId}` : "/tasks",
        refType: "task",
        refId: id,
      }
    );
  }

  await logAudit({
    action: "task.update",
    target: { type: "task", id, label: task.title },
    metadata: {
      event: "submission.created",
      hasLink: !!linkUrl,
      hasFile: !!fileUrl,
    },
  });

  return NextResponse.json({ ok: true });
}
