// Audit log helper — every sensitive mutation should call logAudit so the
// admin can later see who did what, when, and against which target.
//
// Design notes:
// - actorEmail is snapshotted because actors can be deleted while history stays.
// - metadata is JSON-stringified (SQLite has no native JSON column in this schema).
// - Failures to log are swallowed (best-effort) — we never block a user action
//   just because logging failed. Real production would alert on this instead.

import { prisma } from "./prisma";
import { auth } from "@/auth";

export type AuditAction =
  // User management
  | "user.create"
  | "user.approve"
  | "user.reject"
  | "user.delete"
  | "user.deactivate"
  | "user.activate"
  | "user.role_change"
  | "user.department_change"
  | "user.profile_change"
  | "user.badge_add"
  | "user.badge_remove"
  // Project
  | "project.create"
  | "project.update"
  | "project.delete"
  | "project.status_change"
  | "project.member_add"
  | "project.member_remove"
  // Task
  | "task.create"
  | "task.update"
  | "task.delete"
  | "task.assignee_change"
  | "task.status_change"
  // Finance
  | "tx.create"
  | "tx.update"
  | "tx.delete"
  // Backup
  | "backup.run";

export interface AuditTarget {
  type: "user" | "project" | "task" | "transaction" | "backup";
  id?: string | null;
  label?: string | null;
}

export async function logAudit(args: {
  action: AuditAction;
  target?: AuditTarget;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorEmail?: string | null;
}) {
  try {
    let actorId = args.actorId ?? null;
    let actorEmail = args.actorEmail ?? null;
    if (!actorEmail) {
      const session = await auth();
      actorId = actorId ?? session?.user?.id ?? null;
      actorEmail = session?.user?.email ?? "system";
    }

    await prisma.auditLog.create({
      data: {
        actorId,
        actorEmail: actorEmail ?? "system",
        action: args.action,
        targetType: args.target?.type ?? null,
        targetId: args.target?.id ?? null,
        targetLabel: args.target?.label ?? null,
        metadata: args.metadata ? JSON.stringify(args.metadata) : null,
      },
    });
  } catch (err) {
    // Don't break user actions if logging fails.
    console.error("[audit] failed to write log entry:", err);
  }
}

/** Parse stored metadata back to an object (or null if malformed). */
export function parseAuditMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Human-readable label for an action (Arabic). */
export const AUDIT_ACTION_LABEL_AR: Record<AuditAction, string> = {
  "user.create": "إنشاء حساب",
  "user.approve": "تفعيل حساب",
  "user.reject": "رفض وحذف طلب",
  "user.delete": "حذف حساب",
  "user.deactivate": "تعطيل حساب",
  "user.activate": "تفعيل حساب",
  "user.role_change": "تغيير الدور",
  "user.department_change": "تغيير القسم",
  "user.profile_change": "تعديل بيانات موظف",
  "user.badge_add": "إضافة شارة",
  "user.badge_remove": "إزالة شارة",
  "project.create": "إنشاء مشروع",
  "project.update": "تعديل مشروع",
  "project.delete": "حذف مشروع",
  "project.status_change": "تغيير حالة مشروع",
  "project.member_add": "إضافة عضو للمشروع",
  "project.member_remove": "حذف عضو من المشروع",
  "task.create": "إنشاء مهمة",
  "task.update": "تعديل مهمة",
  "task.delete": "حذف مهمة",
  "task.assignee_change": "تغيير مسؤول المهمة",
  "task.status_change": "تغيير حالة المهمة",
  "tx.create": "إضافة معاملة مالية",
  "tx.update": "تعديل معاملة مالية",
  "tx.delete": "حذف معاملة مالية",
  "backup.run": "نسخ احتياطي",
};

export const AUDIT_ACTION_LABEL_EN: Record<AuditAction, string> = {
  "user.create": "Create account",
  "user.approve": "Approve account",
  "user.reject": "Reject & delete request",
  "user.delete": "Delete account",
  "user.deactivate": "Deactivate account",
  "user.activate": "Activate account",
  "user.role_change": "Change role",
  "user.department_change": "Change department",
  "user.profile_change": "Update employee profile",
  "user.badge_add": "Add badge",
  "user.badge_remove": "Remove badge",
  "project.create": "Create project",
  "project.update": "Update project",
  "project.delete": "Delete project",
  "project.status_change": "Change project status",
  "project.member_add": "Add project member",
  "project.member_remove": "Remove project member",
  "task.create": "Create task",
  "task.update": "Update task",
  "task.delete": "Delete task",
  "task.assignee_change": "Change task assignee",
  "task.status_change": "Change task status",
  "tx.create": "Add transaction",
  "tx.update": "Update transaction",
  "tx.delete": "Delete transaction",
  "backup.run": "Backup",
};

export function auditActionLabel(
  action: string,
  locale: "ar" | "en"
): string {
  const map = locale === "en" ? AUDIT_ACTION_LABEL_EN : AUDIT_ACTION_LABEL_AR;
  return (map as Record<string, string>)[action] ?? action;
}
