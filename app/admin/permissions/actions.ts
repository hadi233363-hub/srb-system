"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth-guards";
import { logAudit } from "@/lib/db/audit";
import { setUserOverride } from "@/lib/db/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  ACTIONS,
  MODULES,
  type Action,
  type Module,
} from "@/lib/auth/permissions";

function isModule(value: unknown): value is Module {
  return (
    typeof value === "string" && (MODULES as readonly string[]).includes(value)
  );
}

function isAction(value: unknown): value is Action {
  return (
    typeof value === "string" && (ACTIONS as readonly string[]).includes(value)
  );
}

/**
 * Owner-only: flip a single (module, action) cell on a user.
 *   - allowed=true   → grant explicitly
 *   - allowed=false  → revoke explicitly
 *   - allowed=null   → clear the override (revert to role default)
 */
export async function setPermissionOverrideAction(args: {
  userId: string;
  module: string;
  action: string;
  allowed: boolean | null;
  reason?: string | null;
}) {
  const actor = await requireOwner();

  const { userId, module, action, allowed, reason } = args;
  if (!isModule(module)) return { ok: false as const, message: "module غير صحيح" };
  if (!isAction(action)) return { ok: false as const, message: "action غير صحيح" };

  // The Owner cannot strip permissions from themselves — Owner is always all-on.
  // We still allow the row to be written (the resolver short-circuits on admin),
  // but block it here to keep the UI honest.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!target) return { ok: false as const, message: "الموظف غير موجود" };
  if (target.role === "admin" && actor.id === target.id) {
    return {
      ok: false as const,
      message: "ما تقدر تعدّل صلاحياتك أنت — الرئيس له كل الصلاحيات افتراضياً",
    };
  }

  const result = await setUserOverride({
    userId,
    module,
    action,
    allowed,
    grantedById: actor.id,
    reason: reason ?? null,
  });

  await logAudit({
    action:
      allowed === null
        ? "permission.reset"
        : allowed
        ? "permission.grant"
        : "permission.revoke",
    target: {
      type: "user",
      id: userId,
      label: `${target.name} · ${target.email}`,
    },
    metadata: { module, action, allowed, reason: reason ?? null },
  });

  revalidatePath("/admin/permissions");
  return { ok: true as const, ...result };
}

/**
 * Owner-only: clear ALL overrides on a user (reset their permissions to the
 * role default). Useful for the "Reset to defaults" button on each row.
 */
export async function resetUserPermissionsAction(userId: string) {
  const actor = await requireOwner();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!target) return { ok: false as const, message: "الموظف غير موجود" };

  const removed = await prisma.permissionOverride.deleteMany({
    where: { userId },
  });

  await logAudit({
    action: "permission.reset",
    target: {
      type: "user",
      id: userId,
      label: `${target.name} · ${target.email}`,
    },
    metadata: { byActor: actor.id, removedCount: removed.count, scope: "all" },
  });

  revalidatePath("/admin/permissions");
  return { ok: true as const, removed: removed.count };
}
