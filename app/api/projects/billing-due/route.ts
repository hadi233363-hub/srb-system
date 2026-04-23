// Polled by the InvoiceReminder client component every 30s.
// Returns monthly projects whose invoice is in one of 3 alert windows:
//   before   — 2.5 to 3.5 days before due  (soft reminder)
//   due      — same calendar day (due today)
//   overdue  — >= 1 day past due and still not collected
// Each window fires only once per cycle — the per-cycle reminder fields on
// the Project track that, and are wiped when recordInvoiceAction advances the
// cycle.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const candidates = await prisma.project.findMany({
    where: {
      billingType: "monthly",
      status: "active",
      nextInvoiceDueAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      budgetQar: true,
      billingCycleDays: true,
      nextInvoiceDueAt: true,
      invoiceReminderBeforeSentAt: true,
      invoiceReminderDueSentAt: true,
      invoiceReminderOverdueSentAt: true,
      client: { select: { name: true } },
    },
  });

  const before: typeof candidates = [];
  const due: typeof candidates = [];
  const overdue: typeof candidates = [];

  for (const p of candidates) {
    if (!p.nextInvoiceDueAt) continue;
    const diffMs = p.nextInvoiceDueAt.getTime() - now.getTime();
    const diffDays = diffMs / dayMs;

    // 3-day-before window: between 2.5 and 3.5 days ahead.
    if (
      !p.invoiceReminderBeforeSentAt &&
      diffDays > 2.5 &&
      diffDays <= 3.5
    ) {
      before.push(p);
    }

    // Due-today window: invoice date within today (any moment today before
    // flipping past the due moment by a calendar day).
    if (
      !p.invoiceReminderDueSentAt &&
      diffDays <= 0.5 &&
      diffDays > -1
    ) {
      due.push(p);
    }

    // Overdue: >= 1 full day past due.
    if (!p.invoiceReminderOverdueSentAt && diffDays <= -1) {
      overdue.push(p);
    }
  }

  return NextResponse.json({
    before,
    due,
    overdue,
    now: now.toISOString(),
  });
}
