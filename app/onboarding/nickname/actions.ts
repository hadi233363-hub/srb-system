"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireActiveUser } from "@/lib/auth-guards";

const NICK_RE = /^[A-Za-z0-9_-]{2,24}$/;

export async function saveNicknameAction(
  nickname: string
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "taken" }> {
  const user = await requireActiveUser();
  const trimmed = nickname.trim();
  if (!NICK_RE.test(trimmed)) {
    return { ok: false, reason: "invalid" };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { nickname: trimmed },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, reason: "taken" };
    }
    throw e;
  }

  revalidatePath("/", "layout");
  redirect("/");
}
