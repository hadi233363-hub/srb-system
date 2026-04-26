// Local file uploads for work-delivery attachments. Files land in
// `public/uploads/<scope>/<random>.ext` so they're served straight off the
// Next.js static handler — no signed-URL plumbing needed for an internal app.
//
// We accept JPG / PNG / GIF / PDF up to 10 MB. Anything else is rejected at
// the boundary (server action / API route) with a translated message.

import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_UPLOAD_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export interface SavedUpload {
  url: string; // public URL (/uploads/<scope>/<file>)
  fileName: string; // original name (sanitized)
  fileType: string; // mime
  fileSize: number; // bytes
}

/**
 * Persist a single uploaded File to /public/uploads/<scope>/. Validates size +
 * mime type. Returns metadata the caller can store on its model row.
 */
export async function saveUploadedFile(
  file: File,
  scope: string
): Promise<SavedUpload> {
  if (!file || typeof file === "string") {
    throw new Error("ملف غير صالح");
  }
  if (file.size <= 0) {
    throw new Error("الملف فاضي");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `حجم الملف أكبر من الحد (${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} ميجا)`
    );
  }
  const mime = (file.type || "").toLowerCase();
  const ext = ALLOWED_UPLOAD_MIME[mime];
  if (!ext) {
    throw new Error("نوع الملف غير مدعوم — استخدم JPG / PNG / GIF / PDF");
  }

  const safeScope = scope.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "misc";
  const dir = path.join(process.cwd(), "public", "uploads", safeScope);
  await mkdir(dir, { recursive: true });

  const id = randomBytes(12).toString("hex");
  const filename = `${Date.now()}-${id}.${ext}`;
  const fullPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  // Sanitize the original filename for display (no slashes / control chars).
  const safeOriginal =
    (typeof file.name === "string"
      ? file.name.replace(/[\\/]/g, "_").replace(/[\x00-\x1f]/g, "").slice(0, 200)
      : "") || `file.${ext}`;

  return {
    url: `/uploads/${safeScope}/${filename}`,
    fileName: safeOriginal,
    fileType: mime,
    fileSize: file.size,
  };
}

/** Validate that a free-form URL the user typed is a plausible HTTP(S) link. */
export function sanitizeLinkUrl(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > 2_000) {
    throw new Error("الرابط طويل جداً");
  }
  // Allow http(s) only — block javascript:, data:, file:, etc.
  if (!/^https?:\/\//i.test(s)) {
    throw new Error("الرابط لازم يبدأ بـ http:// أو https://");
  }
  try {
    // Round-trip through URL to normalize and catch obvious garbage.
    new URL(s);
  } catch {
    throw new Error("الرابط غير صحيح");
  }
  return s;
}
