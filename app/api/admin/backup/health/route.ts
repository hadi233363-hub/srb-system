// Backup health endpoint — admin-only.
// Returns a traffic-light status (healthy / warning / critical) plus the most
// recent successful backup, the most recent failure (if any), and scheduler
// runtime info. Used by the BackupHealthWidget on the dashboard.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getSchedulerStatus } from "@/lib/db/backup-scheduler";

const HOUR_MS = 60 * 60 * 1000;
const WARNING_AGE_HOURS = 12;
const CRITICAL_AGE_HOURS = 24;

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [lastSuccess, lastFailure] = await Promise.all([
    prisma.backupRun.findFirst({
      where: { status: { in: ["success", "verified"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.backupRun.findFirst({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const now = Date.now();
  const ageMs = lastSuccess ? now - lastSuccess.createdAt.getTime() : Infinity;
  const ageHours = ageMs / HOUR_MS;

  // Failure is "fresh" if it happened after the last successful backup.
  const failureIsFresh =
    lastFailure !== null &&
    (lastSuccess === null || lastFailure.createdAt > lastSuccess.createdAt);

  let level: "healthy" | "warning" | "critical";
  if (!lastSuccess) {
    level = "critical";
  } else if (ageHours >= CRITICAL_AGE_HOURS) {
    level = "critical";
  } else if (failureIsFresh) {
    level = "warning";
  } else if (ageHours >= WARNING_AGE_HOURS) {
    level = "warning";
  } else {
    level = "healthy";
  }

  return NextResponse.json({
    level,
    lastSuccess: lastSuccess
      ? {
          id: lastSuccess.id,
          createdAt: lastSuccess.createdAt.toISOString(),
          sizeBytes: lastSuccess.sizeBytes,
          trigger: lastSuccess.trigger,
          reason: lastSuccess.reason,
          verified: lastSuccess.verifiedAt !== null,
          ageMs,
        }
      : null,
    lastFailure: failureIsFresh && lastFailure
      ? {
          id: lastFailure.id,
          createdAt: lastFailure.createdAt.toISOString(),
          errorMessage: lastFailure.errorMessage,
          trigger: lastFailure.trigger,
        }
      : null,
    scheduler: getSchedulerStatus(),
  });
}
