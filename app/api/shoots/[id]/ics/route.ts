// iCalendar (.ics) export for a photo shoot — importable into Google Calendar,
// Apple Calendar, Outlook. The response sets a downloadable attachment.

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

function formatICSDate(d: Date): string {
  // "19980118T230000Z" — UTC, no separators
  const iso = d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  return iso; // already ends with Z
}

function escapeICSText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await props.params;
  const shoot = await prisma.photoShoot.findUnique({
    where: { id },
    include: { project: { select: { title: true } } },
  });
  if (!shoot) return new Response("Not found", { status: 404 });

  const start = new Date(shoot.shootDate);
  const end = new Date(start.getTime() + shoot.durationHours * 3600_000);
  const descParts = [
    shoot.project ? `Project: ${shoot.project.title}` : "",
    shoot.shotList ? `\nShot list:\n${shoot.shotList}` : "",
    shoot.notes ? `\nNotes:\n${shoot.notes}` : "",
    shoot.clientContact ? `\nContact: ${shoot.clientContact}` : "",
  ]
    .filter(Boolean)
    .join("");

  const now = formatICSDate(new Date());

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SRB//Shoot Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:shoot-${shoot.id}@srb`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:${escapeICSText(shoot.title)}`,
    `LOCATION:${escapeICSText(shoot.location)}`,
    `DESCRIPTION:${escapeICSText(descParts)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeICSText(shoot.title)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeICSText(shoot.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="shoot-${shoot.id}.ics"`,
    },
  });
}
