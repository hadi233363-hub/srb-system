// Smart backup scheduler.
//
// Runs inside the Next.js process via instrumentation.ts. Wakes every CHECK_INTERVAL_MS
// and decides whether enough has changed (or enough time has passed) to warrant a
// fresh backup. Self-throttles via globalThis singleton so HMR / multiple imports
// don't spawn duplicate timers.
//
// Triggers (any one fires a run):
//   - No previous backup exists.
//   - 6+ hours since last successful backup.
//   - 5+ new transactions since last successful backup.
//   - 1+ new project since last successful backup.
//   - 1+ new user since last successful backup.
//
// Hard floor: never run more than once per hour, even if all triggers fire.

import { prisma } from "./prisma";
import { runBackup, pruneOldBackups, getBackupRetention } from "./backup";

const SCHEDULER_KEY = "__srb_backup_scheduler_v1__";
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour hard floor
const MAX_BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hour soft cap

const ACTIVITY_THRESHOLDS = {
  transactions: 5,
  projects: 1,
  users: 1,
};

interface SchedulerState {
  intervalId: NodeJS.Timeout | null;
  initialTimeoutId: NodeJS.Timeout | null;
  inProgress: boolean;
  startedAt: number;
  lastCheckAt: number;
  lastRunAt: number;
  lastRunOk: boolean;
  lastRunReason: string | null;
}

function getState(): SchedulerState {
  const g = globalThis as unknown as Record<string, SchedulerState>;
  if (!g[SCHEDULER_KEY]) {
    g[SCHEDULER_KEY] = {
      intervalId: null,
      initialTimeoutId: null,
      inProgress: false,
      startedAt: 0,
      lastCheckAt: 0,
      lastRunAt: 0,
      lastRunOk: true,
      lastRunReason: null,
    };
  }
  return g[SCHEDULER_KEY];
}

export function getSchedulerStatus() {
  const s = getState();
  return {
    running: s.intervalId !== null,
    startedAt: s.startedAt || null,
    lastCheckAt: s.lastCheckAt || null,
    lastRunAt: s.lastRunAt || null,
    lastRunOk: s.lastRunOk,
    lastRunReason: s.lastRunReason,
    inProgress: s.inProgress,
    checkIntervalMs: CHECK_INTERVAL_MS,
    maxBackupIntervalMs: MAX_BACKUP_INTERVAL_MS,
  };
}

/**
 * Decide whether to run a backup right now. Looks at the last successful backup
 * and counts activity since then. Returns the reason a backup should fire, or null.
 */
async function shouldBackupNow(): Promise<string | null> {
  const last = await prisma.backupRun.findFirst({
    where: { status: { in: ["success", "verified"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!last) return "first backup";

  const elapsed = Date.now() - last.createdAt.getTime();

  // Hard floor — never more than once per hour.
  if (elapsed < MIN_BACKUP_INTERVAL_MS) return null;

  // Soft cap — at least once every 6 hours regardless of activity.
  if (elapsed >= MAX_BACKUP_INTERVAL_MS) {
    const hours = Math.round(elapsed / (60 * 60 * 1000));
    return `${hours}h elapsed`;
  }

  // Activity-based triggers.
  const since = last.createdAt;
  const [txCount, projCount, userCount] = await Promise.all([
    prisma.transaction.count({ where: { createdAt: { gt: since } } }),
    prisma.project.count({ where: { createdAt: { gt: since } } }),
    prisma.user.count({ where: { createdAt: { gt: since } } }),
  ]);

  if (txCount >= ACTIVITY_THRESHOLDS.transactions) {
    return `${txCount} new transactions`;
  }
  if (projCount >= ACTIVITY_THRESHOLDS.projects) {
    return `${projCount} new project${projCount > 1 ? "s" : ""}`;
  }
  if (userCount >= ACTIVITY_THRESHOLDS.users) {
    return `${userCount} new user${userCount > 1 ? "s" : ""}`;
  }

  return null;
}

async function tick() {
  const s = getState();
  if (s.inProgress) return;
  s.lastCheckAt = Date.now();

  let reason: string | null = null;
  try {
    reason = await shouldBackupNow();
  } catch (err) {
    console.error("[backup-scheduler] shouldBackupNow failed:", err);
    return;
  }
  if (!reason) return;

  s.inProgress = true;
  console.log(`[backup-scheduler] running auto backup — reason: ${reason}`);

  try {
    const result = await runBackup({ trigger: "auto", reason });
    s.lastRunAt = Date.now();
    s.lastRunOk = result.ok;
    s.lastRunReason = reason;

    if (result.ok) {
      console.log(
        `[backup-scheduler] ok — file=${result.filePath} size=${result.sizeBytes}B verified=${result.verified}`
      );
      // Best-effort cleanup of old files.
      try {
        const pruned = await pruneOldBackups(getBackupRetention());
        if (pruned > 0) {
          console.log(`[backup-scheduler] pruned ${pruned} old backup(s)`);
        }
      } catch (err) {
        console.error("[backup-scheduler] prune failed:", err);
      }
    } else {
      console.error(`[backup-scheduler] FAILED — ${result.error}`);
    }
  } catch (err) {
    s.lastRunAt = Date.now();
    s.lastRunOk = false;
    console.error("[backup-scheduler] uncaught:", err);
  } finally {
    s.inProgress = false;
  }
}

/**
 * Start the smart scheduler. Idempotent — multiple calls are no-ops.
 * First check fires after 60s (gives the app time to settle), then every 5min.
 */
export function startScheduler() {
  const s = getState();
  if (s.intervalId) return;

  s.startedAt = Date.now();
  s.initialTimeoutId = setTimeout(() => {
    void tick();
  }, 60 * 1000);
  s.intervalId = setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);

  console.log(
    `[backup-scheduler] started — first check in 60s, then every ${CHECK_INTERVAL_MS / 1000}s`
  );
}

/** Stop the scheduler. Useful for tests; not normally called in prod. */
export function stopScheduler() {
  const s = getState();
  if (s.intervalId) {
    clearInterval(s.intervalId);
    s.intervalId = null;
  }
  if (s.initialTimeoutId) {
    clearTimeout(s.initialTimeoutId);
    s.initialTimeoutId = null;
  }
}
