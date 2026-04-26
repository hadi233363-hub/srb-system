"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth-guards";
import { markRead } from "@/lib/db/notifications";

export async function markNotificationsReadAction(ids?: string[]) {
  const user = await requireActiveUser();
  await markRead(user.id, ids);
  revalidatePath("/");
  return { ok: true };
}
