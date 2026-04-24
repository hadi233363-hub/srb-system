// Backup utility — copies the SQLite DB file to a timestamped backup folder.
//
// Why file copy: SQLite in WAL mode is safe to `VACUUM INTO` while live,
// which atomically writes a consistent snapshot — no torn pages. This is
// the recommended approach over a raw file copy (which can miss WAL changes).

import Database from "better-sqlite3";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";

/**
 * Directory where backup files live.
 * Override with SRB_BACKUP_DIR env var (e.g. to point at a Railway mounted volume).
 */
export function getBackupDir(): string {
  return process.env.SRB_BACKUP_DIR ?? path.join(process.cwd(), "backups");
}

/** How many successful backups to keep on disk. Older ones are pruned automatically. */
export function getBackupRetention(): number {
  const n = Number(process.env.SRB_KEEP_LAST ?? 30);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export interface BackupResult {
  ok: boolean;
  filePath?: string;
  sizeBytes?: number;
  verified?: boolean;
  rowCount?: number;
  error?: string;
  recordId?: string;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Open the .db file fresh and confirm it's not corrupted. Runs PRAGMA integrity_check
 * and a row count on the User table — a tiny query that fails fast if the file
 * is truncated or pages are missing.
 */
export async function verifyBackupFile(filePath: string): Promise<{
  ok: boolean;
  rowCount?: number;
  error?: string;
}> {
  let db: Database.Database | null = null;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
    const integrity = db.prepare("PRAGMA integrity_check").get() as
      | { integrity_check: string }
      | undefined;
    if (!integrity || integrity.integrity_check !== "ok") {
      return {
        ok: false,
        error: `integrity_check returned: ${integrity?.integrity_check ?? "no result"}`,
      };
    }
    const userCount = db.prepare("SELECT COUNT(*) as n FROM User").get() as { n: number };
    return { ok: true, rowCount: userCount.n };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    db?.close();
  }
}

/**
 * Run a backup and immediately verify it. Returns an object describing the result.
 *
 * @param opts.trigger — who/what initiated this run
 * @param opts.reason  — for auto-scheduler runs, why this moment was chosen
 */
export async function runBackup(opts: {
  trigger: "manual" | "scheduled" | "auto";
  reason?: string;
}): Promise<BackupResult> {
  const dir = getBackupDir();
  await mkdir(dir, { recursive: true });

  const fileName = `srb-${timestamp()}.db`;
  const filePath = path.join(dir, fileName);

  try {
    // VACUUM INTO writes a defragmented, consistent snapshot atomically.
    // Parameters cannot be bound in VACUUM — so we sanitize the path manually
    // (only alphanumerics, dashes, underscores, slashes, colons, dots are allowed).
    if (!/^[\w\-.\\/:\s]+$/.test(filePath)) {
      throw new Error("Invalid backup path characters");
    }
    const escaped = filePath.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);

    const st = await stat(filePath);

    // Self-verify before declaring success.
    const verified = await verifyBackupFile(filePath);

    const record = await prisma.backupRun.create({
      data: {
        filePath,
        sizeBytes: st.size,
        trigger: opts.trigger,
        reason: opts.reason ?? null,
        status: verified.ok ? "verified" : "failed",
        errorMessage: verified.ok ? null : verified.error ?? "verification failed",
        verifiedAt: verified.ok ? new Date() : null,
      },
    });

    if (!verified.ok) {
      // Verification failed — try to clean up the bad file so it's not mistaken for valid.
      try {
        await unlink(filePath);
      } catch {
        // ignore — leave the file for forensics
      }
      return {
        ok: false,
        filePath,
        sizeBytes: st.size,
        verified: false,
        error: verified.error,
        recordId: record.id,
      };
    }

    return {
      ok: true,
      filePath,
      sizeBytes: st.size,
      verified: true,
      rowCount: verified.rowCount,
      recordId: record.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Record the failure so the health UI shows it.
    try {
      await prisma.backupRun.create({
        data: {
          filePath,
          sizeBytes: 0,
          trigger: opts.trigger,
          reason: opts.reason ?? null,
          status: "failed",
          errorMessage: message.slice(0, 500),
        },
      });
    } catch {
      // If even the log insert fails, swallow — the original error is still returned.
    }
    return { ok: false, error: message };
  }
}

/**
 * Delete the oldest successful backups, keeping only the most recent `keep`.
 * Failed records are left alone so users can see the failure history.
 * Returns the number of files actually deleted.
 */
export async function pruneOldBackups(keep = getBackupRetention()): Promise<number> {
  const successful = await prisma.backupRun.findMany({
    where: { status: { in: ["success", "verified"] } },
    orderBy: { createdAt: "desc" },
    skip: keep,
  });

  let deleted = 0;
  for (const run of successful) {
    try {
      await unlink(run.filePath);
    } catch {
      // file already gone — still drop the record below
    }
    try {
      await prisma.backupRun.delete({ where: { id: run.id } });
      deleted++;
    } catch {
      // ignore — best effort
    }
  }
  return deleted;
}
