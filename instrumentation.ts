// Runs once when the Next.js server boots. We use it to start the smart backup
// scheduler — the only background process the app needs in real (Phase 2) mode.
//
// Restricted to `nodejs` runtime — the scheduler uses better-sqlite3 + setInterval
// which don't exist in the edge runtime.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip in build phase — Next runs `register()` once during `next build` to
  // collect telemetry, and we don't want to spawn timers from a build process.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Allow ops to disable the scheduler via env if they ever need to.
  if (process.env.SRB_DISABLE_AUTO_BACKUP === "1") {
    console.log("[instrumentation] auto backup disabled via SRB_DISABLE_AUTO_BACKUP");
    return;
  }

  // Seed the default skill badges if missing — idempotent.
  try {
    const { ensureDefaultBadges } = await import("./lib/db/badges");
    await ensureDefaultBadges();
  } catch (err) {
    console.error("[instrumentation] ensureDefaultBadges failed:", err);
  }

  const { startScheduler } = await import("./lib/db/backup-scheduler");
  startScheduler();

  // Reminder scheduler — fires meeting / shoot / task / invoice alerts every
  // minute regardless of whether anyone has the page open. This is the
  // pipeline that delivers Web Push to phones.
  try {
    const { startReminderScheduler } = await import("./lib/reminders/scheduler");
    startReminderScheduler();
  } catch (err) {
    console.error("[instrumentation] reminder scheduler failed to start:", err);
  }
}
