// Prisma-backed CRUD for the PermissionOverride table. Used by the Owner's
// Permission Control Panel and by server-side permission checks.

import { prisma } from "./prisma";
import type { Module, Action, OverrideEntry } from "@/lib/auth/permissions";

export async function getUserOverrides(userId: string): Promise<OverrideEntry[]> {
  const rows = await prisma.permissionOverride.findMany({
    where: { userId },
    select: { module: true, action: true, allowed: true },
  });
  return rows;
}

/**
 * Set or clear a single override cell.
 *   - `allowed = true | false` → upsert with that value
 *   - `allowed = null`         → delete the row (revert to role default)
 *
 * Returns the new effective value for that cell (after the change).
 */
export async function setUserOverride(args: {
  userId: string;
  module: Module;
  action: Action;
  allowed: boolean | null;
  grantedById: string | null;
  reason?: string | null;
}): Promise<{ cleared: boolean; allowed: boolean | null }> {
  const { userId, module, action, allowed, grantedById, reason } = args;

  if (allowed === null) {
    await prisma.permissionOverride.deleteMany({
      where: { userId, module, action },
    });
    return { cleared: true, allowed: null };
  }

  await prisma.permissionOverride.upsert({
    where: { userId_module_action: { userId, module, action } },
    create: {
      userId,
      module,
      action,
      allowed,
      grantedById: grantedById ?? null,
      reason: reason ?? null,
    },
    update: {
      allowed,
      grantedById: grantedById ?? null,
      reason: reason ?? null,
    },
  });

  return { cleared: false, allowed };
}

/** Bulk fetch overrides for several users at once (for the admin grid). */
export async function listOverridesForUsers(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, OverrideEntry[]>();
  const rows = await prisma.permissionOverride.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, module: true, action: true, allowed: true },
  });
  const map = new Map<string, OverrideEntry[]>();
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push({ module: r.module, action: r.action, allowed: r.allowed });
    map.set(r.userId, list);
  }
  return map;
}
