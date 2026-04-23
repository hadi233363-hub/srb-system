import { Archive, Info } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { formatDate } from "@/lib/db/helpers";
import { getBackupDir } from "@/lib/db/backup";
import { RunBackupButton } from "./run-button";

export default async function BackupPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  if (session?.user.role !== "admin") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("page.backup.title")}</h1>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <div className="text-sm text-zinc-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-xs text-zinc-500">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  const runs = await prisma.backupRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const last = runs[0];
  const dir = getBackupDir();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Archive className="h-5 w-5 text-emerald-400" />
            {t("page.backup.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{t("page.backup.subtitle")}</p>
        </div>
        <RunBackupButton />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard
          label={t("backup.lastRun")}
          value={last ? formatDate(last.createdAt, locale) : t("backup.never")}
          sub={
            last
              ? new Date(last.createdAt).toLocaleTimeString(
                  locale === "en" ? "en-US" : "en",
                  { hour: "2-digit", minute: "2-digit" }
                )
              : undefined
          }
        />
        <InfoCard
          label={t("backup.size")}
          value={last ? formatBytes(last.sizeBytes) : "—"}
        />
        <InfoCard
          label={t("backup.location")}
          value={dir}
          dir="ltr"
        />
      </div>

      <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-4 text-xs text-sky-300">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("backup.schedule.hint")}</span>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          {t("backup.history")}
        </h2>
        {runs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <Archive className="h-10 w-10 text-zinc-700" />
            <div className="text-sm text-zinc-400">{t("backup.empty.title")}</div>
            <p className="max-w-md text-xs text-zinc-500">{t("backup.empty.desc")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-start font-normal">{t("table.date")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("backup.trigger")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("backup.size")}</th>
                  <th className="px-4 py-2 text-start font-normal">{t("backup.location")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                      <div>{formatDate(r.createdAt, locale)}</div>
                      <div className="text-[10px] text-zinc-600">
                        {new Date(r.createdAt).toLocaleTimeString(
                          locale === "en" ? "en-US" : "en",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={
                          r.trigger === "scheduled"
                            ? "rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400"
                            : "rounded-full bg-zinc-700/40 px-2 py-0.5 text-[10px] text-zinc-400"
                        }
                      >
                        {r.trigger === "scheduled"
                          ? t("backup.trigger.scheduled")
                          : t("backup.trigger.manual")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-zinc-300">
                      {formatBytes(r.sizeBytes)}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-zinc-500" dir="ltr">
                      {r.filePath}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoCard({
  label,
  value,
  sub,
  dir,
}: {
  label: string;
  value: string;
  sub?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-100 break-all" dir={dir}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-zinc-600">{sub}</div>}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
