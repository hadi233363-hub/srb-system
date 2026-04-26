// Smart Insights — server-side rule engine that scans the live DB and
// surfaces patterns the team would otherwise have to dig for. Pure functions
// here, no UI; the home page renders the result.
//
// Signal categories:
//   • risk        — needs attention soon (overdue tasks with project slack)
//   • opportunity — positive trends worth amplifying
//   • alert       — owner-only financial conditions (low cash, expense spike)
//   • info        — neutral observations (workload balance, milestone close)
//
// Severity drives color in the UI: info < warning < danger.
//
// Each insight returns a stable `key` so the home page can map them to
// localized labels without us hardcoding Arabic / English here.

import { prisma } from "@/lib/db/prisma";
import type { Role } from "@/lib/auth/roles";
import { isOwner } from "@/lib/auth/roles";

export type InsightSeverity = "info" | "warning" | "danger" | "success";

export interface SmartInsight {
  key: string;            // stable id, e.g. "tasks.overdue_with_slack"
  severity: InsightSeverity;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  /** href the card should link to when clicked. */
  href?: string;
}

const MS_DAY = 24 * 60 * 60 * 1000;

export async function computeSmartInsights(
  userRole: Role | undefined
): Promise<SmartInsight[]> {
  const out: SmartInsight[] = [];
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * MS_DAY);

  // ─── 1. Tasks: overdue but project deadline still salvageable ────────────
  // The headline scenario the owner asked about: the TASK passed its dueAt
  // but the CLIENT delivery date is still in the future, so there's slack to
  // recover. We surface the count + the most overdue task so they can act.
  const overdueRecoverable = await prisma.task.findMany({
    where: {
      status: { in: ["todo", "in_progress", "in_review"] },
      dueAt: { lt: now },
      OR: [
        { projectId: null },
        { project: { deadlineAt: null } },
        { project: { deadlineAt: { gte: now } } },
      ],
    },
    orderBy: { dueAt: "asc" },
    take: 5,
    select: {
      id: true,
      title: true,
      dueAt: true,
      project: { select: { title: true, deadlineAt: true } },
    },
  });
  if (overdueRecoverable.length > 0) {
    const worst = overdueRecoverable[0];
    const lateDays = Math.ceil(
      (now.getTime() - (worst.dueAt?.getTime() ?? now.getTime())) / MS_DAY
    );
    out.push({
      key: "tasks.overdue_with_slack",
      severity: "danger",
      titleAr: `${overdueRecoverable.length} مهمة متأخرة لكن لسا في وقت للتسليم`,
      titleEn: `${overdueRecoverable.length} task(s) overdue but client deadline still safe`,
      detailAr: `أقدم مهمة: «${worst.title}» متأخرة ${lateDays} يوم${
        worst.project?.title ? ` · ${worst.project.title}` : ""
      }`,
      detailEn: `Oldest: "${worst.title}" — ${lateDays}d late${
        worst.project?.title ? ` · ${worst.project.title}` : ""
      }`,
      href: "/tasks",
    });
  }

  // ─── 2. Project deadlines closing in (next 7 days) ───────────────────────
  const closingProjects = await prisma.project.findMany({
    where: {
      status: "active",
      deadlineAt: { gte: now, lte: in7d },
    },
    orderBy: { deadlineAt: "asc" },
    take: 5,
    select: {
      id: true,
      title: true,
      deadlineAt: true,
      tasks: {
        where: { status: { in: ["todo", "in_progress", "in_review"] } },
        select: { id: true },
      },
    },
  });
  for (const p of closingProjects) {
    const remainDays = Math.ceil(
      ((p.deadlineAt?.getTime() ?? now.getTime()) - now.getTime()) / MS_DAY
    );
    const openCount = p.tasks.length;
    if (openCount > 0) {
      out.push({
        key: `project.deadline_close.${p.id}`,
        severity: remainDays <= 2 ? "danger" : "warning",
        titleAr: `${p.title} — التسليم خلال ${remainDays} يوم`,
        titleEn: `${p.title} — deadline in ${remainDays}d`,
        detailAr: `لسا في ${openCount} مهمة مفتوحة على المشروع`,
        detailEn: `${openCount} task(s) still open on this project`,
        href: `/projects/${p.id}`,
      });
    }
  }

  // ─── 3. Workload imbalance — flag any active employee with > 8 open tasks
  const overloaded = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          tasksAssigned: {
            where: { status: { in: ["todo", "in_progress", "in_review"] } },
          },
        },
      },
    },
  });
  const heaviest = overloaded
    .filter((u) => u._count.tasksAssigned > 8)
    .sort((a, b) => b._count.tasksAssigned - a._count.tasksAssigned);
  if (heaviest.length > 0) {
    const top = heaviest[0];
    out.push({
      key: "team.overloaded",
      severity: "warning",
      titleAr: `${heaviest.length} موظف عليه ضغط زايد`,
      titleEn: `${heaviest.length} teammate(s) overloaded`,
      detailAr: `الأعلى: ${top.name} (${top._count.tasksAssigned} مهمة)`,
      detailEn: `Top: ${top.name} (${top._count.tasksAssigned} open tasks)`,
      href: "/team",
    });
  }

  // ─── 4. Equipment due-back overdue ──────────────────────────────────────
  const equipmentLate = await prisma.equipment.findMany({
    where: {
      currentHolderId: { not: null },
      expectedReturnAt: { lt: now },
    },
    select: {
      id: true,
      name: true,
      expectedReturnAt: true,
      currentHolder: { select: { name: true } },
    },
    take: 5,
  });
  if (equipmentLate.length > 0) {
    const sample = equipmentLate[0];
    out.push({
      key: "equipment.return_overdue",
      severity: "warning",
      titleAr: `${equipmentLate.length} معدات لازم ترجع`,
      titleEn: `${equipmentLate.length} equipment items past due return`,
      detailAr: `${sample.name} مع ${sample.currentHolder?.name ?? "—"}`,
      detailEn: `${sample.name} with ${sample.currentHolder?.name ?? "—"}`,
      href: "/equipment",
    });
  }

  // ─── 5. Pending user approvals (manager-or-above only — they're the
  //       audience that can act on it) ──────────────────────────────────
  const pendingCount = await prisma.user.count({
    where: { approvedAt: null },
  });
  if (pendingCount > 0) {
    out.push({
      key: "users.pending_approval",
      severity: "info",
      titleAr: `${pendingCount} طلب انضمام للفريق ينتظر موافقة`,
      titleEn: `${pendingCount} team join request(s) awaiting approval`,
      detailAr: "افتح إدارة الحسابات وعطهم الصلاحية المناسبة",
      detailEn: "Open user management to assign their role",
      href: "/admin/users",
    });
  }

  // ─── 6. Owner-only financial signals ────────────────────────────────────
  if (isOwner(userRole)) {
    const since30 = new Date(now.getTime() - 30 * MS_DAY);
    const since60 = new Date(now.getTime() - 60 * MS_DAY);

    const [income30, expense30, income60, expense60] = await Promise.all([
      prisma.transaction.aggregate({
        where: { kind: "income", occurredAt: { gte: since30, lte: now } },
        _sum: { amountQar: true },
      }),
      prisma.transaction.aggregate({
        where: { kind: "expense", occurredAt: { gte: since30, lte: now } },
        _sum: { amountQar: true },
      }),
      prisma.transaction.aggregate({
        where: { kind: "income", occurredAt: { gte: since60, lt: since30 } },
        _sum: { amountQar: true },
      }),
      prisma.transaction.aggregate({
        where: { kind: "expense", occurredAt: { gte: since60, lt: since30 } },
        _sum: { amountQar: true },
      }),
    ]);

    const i30 = income30._sum.amountQar ?? 0;
    const e30 = expense30._sum.amountQar ?? 0;
    const i60 = income60._sum.amountQar ?? 0;
    const e60 = expense60._sum.amountQar ?? 0;

    // Cash burn — expenses materially outpace income for 30d
    if (e30 > i30 && e30 - i30 > 1000) {
      out.push({
        key: "finance.cash_burn",
        severity: "danger",
        titleAr: "المصاريف فاقت الإيرادات هذا الشهر",
        titleEn: "Expenses outpaced revenue last 30d",
        detailAr: `الفجوة: ${(e30 - i30).toLocaleString("en")} ر.ق`,
        detailEn: `Gap: ${(e30 - i30).toLocaleString("en")} QAR`,
        href: "/finance",
      });
    }

    // Revenue spike or drop month-over-month
    if (i60 > 0) {
      const change = ((i30 - i60) / i60) * 100;
      if (change <= -20) {
        out.push({
          key: "finance.revenue_drop",
          severity: "warning",
          titleAr: `الإيرادات هبطت ${Math.round(Math.abs(change))}% عن الشهر السابق`,
          titleEn: `Revenue dropped ${Math.round(Math.abs(change))}% MoM`,
          detailAr: `${i30.toLocaleString("en")} مقابل ${i60.toLocaleString("en")} ر.ق`,
          detailEn: `${i30.toLocaleString("en")} vs ${i60.toLocaleString("en")} QAR`,
          href: "/finance",
        });
      } else if (change >= 25) {
        out.push({
          key: "finance.revenue_spike",
          severity: "success",
          titleAr: `الإيرادات ارتفعت ${Math.round(change)}% عن الشهر السابق 🚀`,
          titleEn: `Revenue up ${Math.round(change)}% MoM 🚀`,
          detailAr: `${i30.toLocaleString("en")} مقابل ${i60.toLocaleString("en")} ر.ق`,
          detailEn: `${i30.toLocaleString("en")} vs ${i60.toLocaleString("en")} QAR`,
          href: "/finance",
        });
      }
    }

    // Expense spike — current 30d expenses well above prior 30d
    if (e60 > 0 && (e30 - e60) / e60 >= 0.3) {
      out.push({
        key: "finance.expense_spike",
        severity: "warning",
        titleAr: `المصاريف زادت ${Math.round(((e30 - e60) / e60) * 100)}% فجأة`,
        titleEn: `Expenses jumped ${Math.round(((e30 - e60) / e60) * 100)}%`,
        detailAr: `هذا الشهر: ${e30.toLocaleString("en")} · السابق: ${e60.toLocaleString(
          "en"
        )} ر.ق`,
        detailEn: `This 30d: ${e30.toLocaleString("en")} vs prior: ${e60.toLocaleString(
          "en"
        )} QAR`,
        href: "/finance",
      });
    }

    // Monthly recurring projects with stale invoices
    const overdueInvoices = await prisma.project.count({
      where: {
        billingType: "monthly",
        status: { in: ["active", "on_hold"] },
        nextInvoiceDueAt: { lt: now },
      },
    });
    if (overdueInvoices > 0) {
      out.push({
        key: "finance.invoices_overdue",
        severity: "warning",
        titleAr: `${overdueInvoices} فاتورة شهرية متأخرة`,
        titleEn: `${overdueInvoices} monthly invoice(s) overdue`,
        detailAr: "تابع التحصيل قبل ما يكبر الرقم",
        detailEn: "Chase collection before it grows",
        href: "/projects",
      });
    }
  }

  // Cap at 8 cards so the panel stays scannable.
  return out.slice(0, 8);
}
