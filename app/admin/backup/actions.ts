"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runBackup } from "@/lib/db/backup";
import { logAudit } from "@/lib/db/audit";

export async function runBackupAction() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "unauthorized" };
  }

  const result = await runBackup({ trigger: "manual" });

  if (result.ok) {
    await logAudit({
      action: "backup.run",
      target: { type: "backup", label: result.filePath ?? null },
      metadata: { trigger: "manual", sizeBytes: result.sizeBytes ?? 0 },
    });
  }

  revalidatePath("/admin/backup");
  return result;
}
