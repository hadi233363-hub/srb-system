// Task work-delivery uploads. Receives a multipart/form-data body with a
// single `file` field, validates type + size, and saves to
// /public/uploads/tasks/. Returns the public URL the client can submit
// alongside (or instead of) a link via /api/tasks/[id]/submit.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveUploadedFile } from "@/lib/uploads";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !session.user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad form body" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "ملف مفقود" }, { status: 400 });
  }

  try {
    const saved = await saveUploadedFile(file as File, "tasks");
    return NextResponse.json({
      ok: true,
      url: saved.url,
      fileName: saved.fileName,
      fileType: saved.fileType,
      fileSize: saved.fileSize,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل رفع الملف" },
      { status: 400 }
    );
  }
}
