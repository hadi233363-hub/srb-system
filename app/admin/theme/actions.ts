"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth-guards";

function assertValidHex(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error("Invalid color");
}

export async function saveThemeAction(input: {
  brandColor: string;
  accentColor: string;
}) {
  await requireAdmin();
  assertValidHex(input.brandColor);
  assertValidHex(input.accentColor);

  await prisma.appSetting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      brandColor: input.brandColor,
      accentColor: input.accentColor,
    },
    update: {
      brandColor: input.brandColor,
      accentColor: input.accentColor,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/svg+xml", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadLogoAction(formData: FormData) {
  await requireAdmin();

  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return { ok: false, error: "no file" };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: "unsupported format" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "file too large (max 5MB)" };
  }

  const ext =
    file.type === "image/png"
      ? ".png"
      : file.type === "image/svg+xml"
      ? ".svg"
      : file.type === "image/webp"
      ? ".webp"
      : ".jpg";

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `srb-logo-${Date.now()}${ext}`;
  const publicDir = path.join(process.cwd(), "public");
  await mkdir(publicDir, { recursive: true });
  const fullPath = path.join(publicDir, fileName);
  await writeFile(fullPath, buffer);

  const webPath = `/${fileName}`;
  await prisma.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1, logoPath: webPath },
    update: { logoPath: webPath },
  });

  revalidatePath("/", "layout");
  return { ok: true, logoPath: webPath };
}
