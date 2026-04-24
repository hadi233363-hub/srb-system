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

  const { startScheduler } = await import("./lib/db/backup-scheduler");
  startScheduler();
}
