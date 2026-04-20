// Local SQLite store for authorized users. Separate from the simulation's
// in-memory state — this is the only persisted part of the app.

import Database from "better-sqlite3";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type AuthRole = "admin" | "manager" | "employee";

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  department: string | null;
  active: 1 | 0;
  createdAt: number;
  lastLoginAt: number | null;
  linkedAgentId: string | null;
}

const DB_PATH = path.join(process.cwd(), "auth.db");

// Reuse a single connection across Next.js HMR.
const g = globalThis as unknown as { __authdb__?: Database.Database };

function getDb(): Database.Database {
  if (!g.__authdb__) {
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS authorized_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
        department TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_login_at INTEGER,
        linked_agent_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON authorized_users(email);
    `);

    // Seed the first admin from ADMIN_EMAIL env var if table is empty.
    const count = db
      .prepare("SELECT COUNT(*) as n FROM authorized_users")
      .get() as { n: number };
    if (count.n === 0 && process.env.ADMIN_EMAIL) {
      const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
      db.prepare(
        `INSERT INTO authorized_users
         (id, email, name, role, department, active, created_at)
         VALUES (?, ?, ?, 'admin', NULL, 1, ?)`
      ).run(randomUUID(), email, process.env.ADMIN_NAME || "Admin", Date.now());
      console.log(`[auth] Seeded admin from ADMIN_EMAIL: ${email}`);
    }

    g.__authdb__ = db;
  }
  return g.__authdb__;
}

export { getDb };
