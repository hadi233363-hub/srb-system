"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";

interface MeetingBrief {
  id: string;
  clientName: string;
  meetingAt: Date;
  status: string;
}

interface Props {
  meetings: MeetingBrief[];
}

const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarView({ meetings }: Props) {
  const { locale } = useLocale();
  const t = useT();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0..11

  const monthsName = locale === "ar" ? MONTHS_AR : MONTHS_EN;
  const weekdays = locale === "ar" ? WEEKDAYS_AR : WEEKDAYS_EN;

  // Group meetings by "YYYY-MM-DD" key
  const byDay = useMemo(() => {
    const map = new Map<string, MeetingBrief[]>();
    for (const m of meetings) {
      const d = new Date(m.meetingAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    // Sort within each day
    for (const arr of map.values()) {
      arr.sort(
        (a, b) => new Date(a.meetingAt).getTime() - new Date(b.meetingAt).getTime()
      );
    }
    return map;
  }, [meetings]);

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: `${year}-${month}-${d}` });
  }
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const go = (delta: number) => {
    let y = year;
    let m = month + delta;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setYear(y);
    setMonth(m);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const PrevIcon = locale === "ar" ? ChevronRight : ChevronLeft;
  const NextIcon = locale === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <PrevIcon className="h-4 w-4" />
          </button>
          <div className="min-w-[180px] text-center text-sm font-semibold">
            {monthsName[month]} {year}
          </div>
          <button
            onClick={() => go(1)}
            className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <NextIcon className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {t("meetings.calendar.today")}
        </button>
      </div>

      {/* Weekday header */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {weekdays.map((w) => (
          <div
            key={w}
            className="px-2 py-1 text-center text-[10px] font-semibold text-zinc-500"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) {
            return (
              <div key={i} className="min-h-[96px] rounded-md bg-zinc-950/20" />
            );
          }
          const dayMeetings = byDay.get(cell.key) ?? [];
          const isToday =
            cell.day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();
          return (
            <div
              key={i}
              className={cn(
                "min-h-[96px] rounded-md border p-1.5",
                isToday
                  ? "border-emerald-500/40"
                  : "border-zinc-800 bg-zinc-950/30",
                isToday && "bg-emerald-500/5"
              )}
              style={isToday ? { borderColor: "var(--color-brand-border)", background: "var(--color-brand-dim)" } : undefined}
            >
              <div
                className={cn(
                  "mb-1 flex items-center justify-between text-[10px]",
                  isToday ? "font-bold" : "text-zinc-500"
                )}
                style={isToday ? { color: "var(--color-brand)" } : undefined}
              >
                <span>{cell.day}</span>
                {dayMeetings.length > 0 && (
                  <span className="rounded-full bg-zinc-800 px-1 text-[9px] tabular-nums text-zinc-300">
                    {dayMeetings.length}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayMeetings.slice(0, 3).map((m) => {
                  const time = new Date(m.meetingAt).toLocaleTimeString(
                    locale === "en" ? "en-US" : "en",
                    { hour: "2-digit", minute: "2-digit", hour12: true }
                  );
                  const toneClass =
                    m.status === "done"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : m.status === "cancelled" || m.status === "no_show"
                      ? "bg-zinc-700/40 text-zinc-500 line-through"
                      : "bg-sky-500/10 text-sky-300";
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "truncate rounded-sm px-1 py-0.5 text-[9px]",
                        toneClass
                      )}
                      title={`${time} · ${m.clientName}`}
                    >
                      {time} · {m.clientName}
                    </div>
                  );
                })}
                {dayMeetings.length > 3 && (
                  <div className="text-[9px] text-zinc-500">
                    +{dayMeetings.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
