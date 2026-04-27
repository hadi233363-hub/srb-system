// Full-page notification inbox for the current user. The bell icon in the
// topbar is the quick-glance surface; this page is the destination for the
// mobile bottom-nav "إشعاراتي" tab and for the bell's "See all" link.

import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Bell, Inbox } from "lucide-react";
import { listForUser, unreadCount } from "@/lib/db/notifications";
import { getLocale } from "@/lib/i18n/server";
import { MarkAllReadButton } from "./mark-all-read-button";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, string> = {
  info: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  danger: "border-rose-500/30 bg-rose-500/5 text-rose-300",
};

export default async function NotificationsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const [items, unread] = await Promise.all([
    listForUser(userId, { limit: 100 }),
    unreadCount(userId),
  ]);

  const titleAr = "إشعاراتي";
  const titleEn = "Notifications";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bell className="h-6 w-6 text-zinc-500" />
            {locale === "ar" ? titleAr : titleEn}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {items.length}{" "}
            {locale === "ar" ? "إشعار" : "notifications"}
            {unread > 0 && (
              <>
                {" · "}
                <span className="text-amber-400">
                  {unread} {locale === "ar" ? "غير مقروء" : "unread"}
                </span>
              </>
            )}
          </p>
        </div>
        {unread > 0 && <MarkAllReadButton locale={locale} />}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Inbox className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">
            {locale === "ar" ? "ما فيه إشعارات بعد" : "No notifications yet"}
          </div>
          <p className="max-w-md text-xs text-zinc-500">
            {locale === "ar"
              ? "أي تنبيه جديد على مهامك أو مواعيدك يوصلك هنا."
              : "Alerts about your tasks, meetings, and schedule will appear here."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const tone = SEVERITY_TONE[n.severity] ?? SEVERITY_TONE.info;
            const isUnread = n.readAt === null;
            const Wrapper: React.FC<{ children: React.ReactNode }> = ({
              children,
            }) =>
              n.linkUrl ? (
                <Link href={n.linkUrl} className="block">
                  {children}
                </Link>
              ) : (
                <div>{children}</div>
              );

            return (
              <li key={n.id}>
                <Wrapper>
                  <div
                    className={cn(
                      "min-h-16 rounded-lg border p-3 transition",
                      tone,
                      isUnread
                        ? "shadow-[inset_2px_0_0_currentColor]"
                        : "opacity-70"
                    )}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold">{n.title}</div>
                      <time
                        className="text-[10px] text-zinc-500 tabular-nums"
                        dir="ltr"
                      >
                        {new Date(n.createdAt).toLocaleString(
                          locale === "ar" ? "en" : "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </time>
                    </div>
                    {n.body && (
                      <div className="text-xs text-zinc-300">{n.body}</div>
                    )}
                  </div>
                </Wrapper>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
