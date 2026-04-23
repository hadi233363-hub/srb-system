// Backup utility — copies the SQLite DB file to a timestamped backup folder.
//
// Why file copy: SQLite in WAL mode is safe to `VACUUM INTO` while live,
// which atomically writes a consistent snapshot — no torn pages. This is
// the recommended approach over a raw file copy (which can miss WAL changes).

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";

/**
 * Directory where backup files live.
 * Override with SRB_BACKUP_DIR env var (e.g. to point at a synced Drive/OneDrive folder).
 */
export function getBackupDir(): string {
  return process.env.SRB_BACKUP_DIR ?? path.join(process.cwd(), "backups");
}

export interface BackupResult {
  ok: boolean;
  filePath?: string;
  sizeBytes?: number;
  error?: string;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Run a backup. Returns an object describing the result. */
export async function runBackup(opts: {
  trigger: "manual" | "scheduled";
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
    await prisma.backupRun.create({
      data: {
        filePath,
        sizeBytes: st.size,
        trigger: opts.trigger,
      },
    });

    return { ok: true, filePath, sizeBytes: st.size };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
