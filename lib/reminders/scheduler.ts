// Server-side reminder scheduler.
//
// Runs every 60 seconds inside the Next.js process (started from
// instrumentation.ts). Scans the DB for events that should fire an alert
// right now and creates a Notification row for each — which in turn fans
// out to Web Push so the alert reaches the user's phone even when the
// SRB tab is closed and the screen is locked.
//
// The previous design relied on a client-side poller (MeetingReminder
// component) that could only fire when the user had a tab open. That's
// useless for the actual mobile use case the owner asked about. This
// server scheduler is the canonical alert pipeline; the in-app poller
// stays as a redundant desktop-toast layer for when the page IS open.
//
// Coverage:
//   • Meetings   — 60 min before meetingAt
//   • PhotoShoot — 24h before AND 1h before shootDate
//   • Tasks      — 60 min before dueAt (assignee + collaborators)
//                  + 1st time the task crosses dueAt while still open AND
//                    project deadline is still in the future
//   • Invoices   — 3 days before, day-of, and overdue (owner + manager only,
//                  since these contain financial data)
//
// Idempotency: each event has a `reminderXxxSentAt` column; the scheduler
// only acts on rows where the column is null, then stamps it. Safe to
// run on overlapping schedules — at most one notification per event per
// window.

import { prisma } from "@/lib/db/prisma";
import { createNotification, createNotificationMany } from "@/lib/db/notifications";

const TICK_MS = 60 * 1000; // 1 minute

// We claim a window slightly larger than 1h so that polling drift never
// misses an event. Combined with the SentAt flag this stays idempotent.
const MEETING_WINDOW_MIN = 65;
const SHOOT_HOUR_WINDOW_MIN = 65;
const SHOOT_DAY_WINDOW_HOURS_LO = 23.5;
const SHOOT_DAY_WINDOW_HOURS_HI = 24.5;
const TASK_DUE_WINDOW_MIN = 65;
const INVOICE_BEFORE_DAYS_LO = 2.5;
const INVOICE_BEFORE_DAYS_HI = 3.5;

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;
const MS_DAY = 24 * MS_HOUR;

type Globals = typeof globalThis & { __srbReminderTimer?: NodeJS.Timeout };

let running = false;

/** Start the scheduler. Idempotent — second call is a no-op. */
export function startReminderScheduler() {
  const g = globalThis as Globals;
  if (g.__srbReminderTimer) return;

  // Fire once 30s after boot to catch anything that fell through during the
  // restart window, then on a 1-min cadence.
  setTimeout(() => {
    void tick();
  }, 30_000);
  g.__srbReminderTimer = setInterval(() => void tick(), TICK_MS);
  // eslint-disable-next-line no-console
  console.log("[reminders] scheduler started — tick every 60s");
}

async function tick() {
  if (running) return; // skip if previous tick still in flight
  running = true;
  try {
    await Promise.all([
      checkMeetings(),
      checkShoots(),
      checkTasks(),
      checkInvoices(),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[reminders] tick failed:", err);
  } finally {
    running = false;
  }
}

// ---------------------------------------------------------------------------
// Meetings — 60 min before meetingAt
// ---------------------------------------------------------------------------

async function checkMeetings() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + MEETING_WINDOW_MIN * MS_MIN);

  const meetings = await prisma.clientMeeting.findMany({
    where: {
      status: "scheduled",
      meetingAt: { gte: now, lte: windowEnd },
      reminderSentAt: null,
    },
    select: {
      id: true,
      clientName: true,
      companyName: true,
      meetingAt: true,
      location: true,
      meetingLink: true,
      ownerId: true,
    },
  });

  for (const m of meetings) {
    if (!m.ownerId) {
      // Owner-less meeting — nobody to notify. Just stamp it so we don't
      // re-check next tick.
      await prisma.clientMeeting.updateMany({
        where: { id: m.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
      continue;
    }

    const minsAway = Math.max(0, Math.round((m.meetingAt.getTime() - now.getTime()) / MS_MIN));
    const where = m.location ? ` · ${m.location}` : m.meetingLink ? " · أونلاين" : "";

    await createNotification({
      recipientId: m.ownerId,
      kind: "meeting.soon",
      severity: "warning",
      title: `📅 اجتماع بعد ${minsAway} دقيقة — ${m.clientName}`,
      body: m.companyName
        ? `${m.companyName}${where}`
        : `${m.meetingAt.toLocaleString("ar")}${where}`,
      linkUrl: "/meetings",
      refType: "meeting",
      refId: m.id,
      dedupeKey: { kind: "meeting.soon", refType: "meeting", refId: m.id },
    });

    // Mark as sent so we don't re-fire next tick.
    await prisma.clientMeeting.updateMany({
      where: { id: m.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
  }
}

// ---------------------------------------------------------------------------
// Photo shoots — 24h before AND 1h before, alerts go to every crew member
// ---------------------------------------------------------------------------

async function checkShoots() {
  const now = new Date();
  const dayLo = new Date(now.getTime() + SHOOT_DAY_WINDOW_HOURS_LO * MS_HOUR);
  const dayHi = new Date(now.getTime() + SHOOT_DAY_WINDOW_HOURS_HI * MS_HOUR);
  const hourEnd = new Date(now.getTime() + SHOOT_HOUR_WINDOW_MIN * MS_MIN);

  // 24h-before window
  const dayShoots = await prisma.photoShoot.findMany({
    where: {
      status: "scheduled",
      shootDate: { gte: dayLo, lte: dayHi },
      reminderDayBeforeSentAt: null,
    },
    select: {
      id: true,
      title: true,
      shootDate: true,
      location: true,
      crew: { select: { userId: true } },
    },
  });

  for (const s of dayShoots) {
    const recipients = s.crew.map((c) => c.userId);
    if (recipients.length > 0) {
      await createNotificationMany(recipients, {
        kind: "shoot.day_before",
        severity: "warning",
        title: `📸 تصوير بكره — ${s.title}`,
        body: `${s.shootDate.toLocaleString("ar")}${s.location ? ` · ${s.location}` : ""}`,
        linkUrl: "/shoots",
        refType: "shoot",
        refId: s.id,
        dedupeKey: { kind: "shoot.day_before", refType: "shoot", refId: s.id },
      });
    }
    await prisma.photoShoot.updateMany({
      where: { id: s.id, reminderDayBeforeSentAt: null },
      data: { reminderDayBeforeSentAt: new Date() },
    });
  }

  // 1h-before window
  const hourShoots = await prisma.photoShoot.findMany({
    where: {
      status: "scheduled",
      shootDate: { gte: now, lte: hourEnd },
      reminderHourBeforeSentAt: null,
    },
    select: {
      id: true,
      title: true,
      shootDate: true,
      location: true,
      crew: { select: { userId: true } },
    },
  });

  for (const s of hourShoots) {
    const recipients = s.crew.map((c) => c.userId);
    const minsAway = Math.max(0, Math.round((s.shootDate.getTime() - now.getTime()) / MS_MIN));
    if (recipients.length > 0) {
      await createNotificationMany(recipients, {
        kind: "shoot.hour_before",
        severity: "danger",
        title: `📸 تصوير بعد ${minsAway} دقيقة — ${s.title}`,
        body: s.location ?? "تأكد من المعدات",
        linkUrl: "/shoots",
        refType: "shoot",
        refId: s.id,
        dedupeKey: { kind: "shoot.hour_before", refType: "shoot", refId: s.id },
      });
    }
    await prisma.photoShoot.updateMany({
      where: { id: s.id, reminderHourBeforeSentAt: null },
      data: { reminderHourBeforeSentAt: new Date() },
    });
  }
}

// ---------------------------------------------------------------------------
// Tasks — 60 min before dueAt + overdue-with-slack
// ---------------------------------------------------------------------------

const OPEN_STATUSES = ["todo", "in_progress", "in_review"];

async function checkTasks() {
  const now = new Date();
  const soonEnd = new Date(now.getTime() + TASK_DUE_WINDOW_MIN * MS_MIN);

  // Due-soon (60 min before)
  const dueSoon = await prisma.task.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      dueAt: { gte: now, lte: soonEnd },
      reminderBeforeSentAt: null,
    },
    select: {
      id: true,
      title: true,
      dueAt: true,
      assigneeId: true,
      collaborators: { select: { userId: true } },
      project: { select: { title: true } },
    },
  });

  for (const t of dueSoon) {
    const recipients = collectTaskRecipients(t.assigneeId, t.collaborators);
    if (recipients.length > 0) {
      const minsAway = Math.max(0, Math.round((t.dueAt!.getTime() - now.getTime()) / MS_MIN));
      await createNotificationMany(recipients, {
        kind: "task.due_soon",
        severity: "warning",
        title: `⌛ مهمة بعد ${minsAway} دقيقة — ${t.title}`,
        body: t.project?.title ?? "تأكد من إنهاءها",
        linkUrl: "/tasks",
        refType: "task",
        refId: t.id,
        dedupeKey: { kind: "task.due_soon", refType: "task", refId: t.id },
      });
    }
    await prisma.task.updateMany({
      where: { id: t.id, reminderBeforeSentAt: null },
      data: { reminderBeforeSentAt: new Date() },
    });
  }

  // Overdue-with-slack (task past dueAt, project deadline still future)
  const overdue = await prisma.task.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      dueAt: { lt: now },
      reminderOverdueSentAt: null,
      OR: [
        { projectId: null },
        { project: { deadlineAt: null } },
        { project: { deadlineAt: { gte: now } } },
      ],
    },
    select: {
      id: true,
      title: true,
      dueAt: true,
      assigneeId: true,
      collaborators: { select: { userId: true } },
      project: { select: { title: true, deadlineAt: true } },
    },
  });

  for (const t of overdue) {
    const recipients = collectTaskRecipients(t.assigneeId, t.collaborators);
    if (recipients.length > 0) {
      const slack = t.project?.deadlineAt
        ? `لكن تسليم العميل: ${t.project.deadlineAt.toLocaleString("ar")}`
        : "تجاوزت موعدها — حدّثها";
      await createNotificationMany(recipients, {
        kind: "task.overdue",
        severity: "danger",
        title: `⏰ مهمة متأخرة — ${t.title}`,
        body: slack,
        linkUrl: "/tasks",
        refType: "task",
        refId: t.id,
        dedupeKey: { kind: "task.overdue", refType: "task", refId: t.id },
      });
    }
    await prisma.task.updateMany({
      where: { id: t.id, reminderOverdueSentAt: null },
      data: { reminderOverdueSentAt: new Date() },
    });
  }
}

function collectTaskRecipients(
  assigneeId: string | null,
  collaborators: { userId: string }[]
): string[] {
  const set = new Set<string>();
  if (assigneeId) set.add(assigneeId);
  for (const c of collaborators) set.add(c.userId);
  return Array.from(set);
}

// ---------------------------------------------------------------------------
// Invoices — owner + manager get the alert (financial data)
// ---------------------------------------------------------------------------

async function checkInvoices() {
  const now = new Date();
  const beforeLo = new Date(now.getTime() + INVOICE_BEFORE_DAYS_LO * MS_DAY);
  const beforeHi = new Date(now.getTime() + INVOICE_BEFORE_DAYS_HI * MS_DAY);
  const dueWindowEnd = new Date(now.getTime() + 0.5 * MS_DAY);
  const dueWindowStart = new Date(now.getTime() - 1 * MS_DAY);
  const overdueCutoff = new Date(now.getTime() - 1 * MS_DAY);

  // Recipients: every active admin + manager. Re-resolved each tick so a new
  // hire / promotion gets included without restarting the process.
  const recipients = await prisma.user
    .findMany({
      where: { active: true, role: { in: ["admin", "manager"] } },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));
  if (recipients.length === 0) return;

  // 3-days-before window
  const beforeProjects = await prisma.project.findMany({
    where: {
      billingType: "monthly",
      status: { in: ["active", "on_hold"] },
      nextInvoiceDueAt: { gte: beforeLo, lte: beforeHi },
      invoiceReminderBeforeSentAt: null,
    },
    select: { id: true, title: true, budgetQar: true, nextInvoiceDueAt: true },
  });
  for (const p of beforeProjects) {
    await createNotificationMany(recipients, {
      kind: "invoice.before",
      severity: "info",
      title: `🧾 فاتورة بعد 3 أيام — ${p.title}`,
      body: `${p.budgetQar.toLocaleString("en")} ر.ق`,
      linkUrl: "/projects",
      refType: "project",
      refId: p.id,
      dedupeKey: { kind: "invoice.before", refType: "project", refId: p.id },
    });
    await prisma.project.updateMany({
      where: { id: p.id, invoiceReminderBeforeSentAt: null },
      data: { invoiceReminderBeforeSentAt: new Date() },
    });
  }

  // Day-of window
  const dueProjects = await prisma.project.findMany({
    where: {
      billingType: "monthly",
      status: { in: ["active", "on_hold"] },
      nextInvoiceDueAt: { gte: dueWindowStart, lte: dueWindowEnd },
      invoiceReminderDueSentAt: null,
    },
    select: { id: true, title: true, budgetQar: true },
  });
  for (const p of dueProjects) {
    await createNotificationMany(recipients, {
      kind: "invoice.due",
      severity: "warning",
      title: `🧾 فاتورة اليوم — ${p.title}`,
      body: `${p.budgetQar.toLocaleString("en")} ر.ق · حصّلها اليوم`,
      linkUrl: "/projects",
      refType: "project",
      refId: p.id,
      dedupeKey: { kind: "invoice.due", refType: "project", refId: p.id },
    });
    await prisma.project.updateMany({
      where: { id: p.id, invoiceReminderDueSentAt: null },
      data: { invoiceReminderDueSentAt: new Date() },
    });
  }

  // Overdue (>= 1 day past due, still not collected)
  const overdueProjects = await prisma.project.findMany({
    where: {
      billingType: "monthly",
      status: { in: ["active", "on_hold"] },
      nextInvoiceDueAt: { lt: overdueCutoff },
      invoiceReminderOverdueSentAt: null,
    },
    select: { id: true, title: true, budgetQar: true, nextInvoiceDueAt: true },
  });
  for (const p of overdueProjects) {
    const daysLate = Math.max(
      1,
      Math.round((now.getTime() - (p.nextInvoiceDueAt?.getTime() ?? now.getTime())) / MS_DAY)
    );
    await createNotificationMany(recipients, {
      kind: "invoice.overdue",
      severity: "danger",
      title: `🧾 فاتورة متأخرة ${daysLate} يوم — ${p.title}`,
      body: `${p.budgetQar.toLocaleString("en")} ر.ق · لاحق العميل`,
      linkUrl: "/projects",
      refType: "project",
      refId: p.id,
      dedupeKey: { kind: "invoice.overdue", refType: "project", refId: p.id },
    });
    await prisma.project.updateMany({
      where: { id: p.id, invoiceReminderOverdueSentAt: null },
      data: { invoiceReminderOverdueSentAt: new Date() },
    });
  }
}
