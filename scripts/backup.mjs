// Standalone backup script — runs VACUUM INTO on the SQLite DB file.
// Safe to run while the Next.js server is alive (WAL mode + atomic snapshot).
//
// Usage (from srb-sim directory):
//   node scripts/backup.mjs
//
// Schedule via Windows Task Scheduler by creating a new task that runs:
//   Program:   node
//   Arguments: scripts\backup.mjs
//   Start in:  C:\Users\hadi2\srb-sim
//
// Optional env vars:
//   SRB_BACKUP_DIR=C:\path\to\backups   (default: ./backups)
//   SRB_KEEP_LAST=14                    (default: 14 — older files auto-pruned)

import Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const DB_PATH = path.join(PROJECT_ROOT, "prisma", "app.db");
const BACKUP_DIR = process.env.SRB_BACKUP_DIR ?? path.join(PROJECT_ROOT, "backups");
const KEEP_LAST = Number(process.env.SRB_KEEP_LAST ?? 14);

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function pruneOldBackups(dir, keepLast) {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("srb-") && f.endsWith(".db"))
    .map((f) => ({ name: f, full: path.join(dir, f), mtime: statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  const toDelete = files.slice(keepLast);
  for (const f of toDelete) {
    unlinkSync(f.full);
    console.log(`[backup] pruned old: ${f.name}`);
  }
  return toDelete.length;
}

function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const outName = `srb-${ts()}.db`;
  const outPath = path.join(BACKUP_DIR, outName);

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    db.exec(`VACUUM INTO '${outPath.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  const size = statSync(outPath).size;
  console.log(`[backup] ok: ${outPath} (${formatBytes(size)})`);

  // Record in the backup log table so the UI can display it.
  try {
    const logDb = new Database(DB_PATH);
    // Use cuid-like id: timestamp + random
    const id = `bk${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    logDb
      .prepare(
        `INSERT INTO BackupRun (id, filePath, sizeBytes, trigger, createdAt) VALUES (?, ?, ?, 'scheduled', ?)`
      )
      .run(id, outPath, size, new Date().toISOString());
    logDb.close();
  } catch (e) {
    console.warn("[backup] could not write log row:", e.message);
  }

  const pruned = pruneOldBackups(BACKUP_DIR, KEEP_LAST);
  if (pruned) console.log(`[backup] rotation kept ${KEEP_LAST}, pruned ${pruned}`);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

try {
  main();
  process.exit(0);
} catch (err) {
  console.error("[backup] FAILED:", err);
  process.exit(1);
}
