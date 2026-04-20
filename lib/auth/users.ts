import { randomUUID } from "node:crypto";
import { getDb, type AuthorizedUser, type AuthRole } from "./db";

export type { AuthorizedUser, AuthRole };

export function findUserByEmail(email: string): AuthorizedUser | null {
  const row = getDb()
    .prepare(
      `SELECT id, email, name, role, department, active,
              created_at as createdAt, last_login_at as lastLoginAt,
              linked_agent_id as linkedAgentId
       FROM authorized_users WHERE email = ?`
    )
    .get(email.trim().toLowerCase()) as AuthorizedUser | undefined;
  return row ?? null;
}

export function listUsers(): AuthorizedUser[] {
  return getDb()
    .prepare(
      `SELECT id, email, name, role, department, active,
              created_at as createdAt, last_login_at as lastLoginAt,
              linked_agent_id as linkedAgentId
       FROM authorized_users
       ORDER BY created_at DESC`
    )
    .all() as AuthorizedUser[];
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: AuthRole;
  department?: string | null;
  linkedAgentId?: string | null;
}

export function createUser(input: CreateUserInput): AuthorizedUser {
  const id = randomUUID();
  const email = input.email.trim().toLowerCase();
  getDb()
    .prepare(
      `INSERT INTO authorized_users
       (id, email, name, role, department, active, created_at, linked_agent_id)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(
      id,
      email,
      input.name.trim(),
      input.role,
      input.department?.trim() || null,
      Date.now(),
      input.linkedAgentId ?? null
    );
  return findUserByEmail(email)!;
}

export function updateUser(
  id: string,
  patch: Partial<Pick<AuthorizedUser, "name" | "role" | "department" | "linkedAgentId" | "active">>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    values.push(patch.name);
  }
  if (patch.role !== undefined) {
    sets.push("role = ?");
    values.push(patch.role);
  }
  if (patch.department !== undefined) {
    sets.push("department = ?");
    values.push(patch.department);
  }
  if (patch.linkedAgentId !== undefined) {
    sets.push("linked_agent_id = ?");
    values.push(patch.linkedAgentId);
  }
  if (patch.active !== undefined) {
    sets.push("active = ?");
    values.push(patch.active ? 1 : 0);
  }
  if (sets.length === 0) return;
  values.push(id);
  getDb()
    .prepare(`UPDATE authorized_users SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);
}

export function deleteUser(id: string): void {
  getDb().prepare("DELETE FROM authorized_users WHERE id = ?").run(id);
}

export function touchLogin(id: string): void {
  getDb()
    .prepare("UPDATE authorized_users SET last_login_at = ? WHERE id = ?")
    .run(Date.now(), id);
}

export function countUsers(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as n FROM authorized_users")
    .get() as { n: number };
  return row.n;
}
