import { Shield, Activity } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { formatDate } from "@/lib/db/helpers";
import { auditActionLabel, parseAuditMetadata } from "@/lib/db/audit";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 100;

export default async function AuditPage(props: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  if (session?.user.role !== "admin") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("page.audit.title")}</h1>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <div className="text-sm text-zinc-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-xs text-zinc-500">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  const { page: pageRaw, action: actionFilter } = await props.searchParams;
  const page = Math.max(1, parseInt(pageRaw ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = actionFilter ? { action: actionFilter } : {};

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="h-5 w-5 text-emerald-400" />
            {t("page.audit.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{t("page.audit.subtitle")}</p>
        </div>
        <div className="text-xs text-zinc-500">
          {total.toLocaleString("en")} {t("audit.entries")}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Activity className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("audit.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">{t("audit.empty.desc")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-start font-normal">{t("audit.time")}</th>
                <th className="px-4 py-2 text-start font-normal">{t("audit.actor")}</th>
                <th className="px-4 py-2 text-start font-normal">{t("audit.action")}</th>
                <th className="px-4 py-2 text-start font-normal">{t("audit.target")}</th>
                <th className="px-4 py-2 text-start font-normal">{t("audit.details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {entries.map((e) => {
                const meta = parseAuditMetadata(e.metadata);
                const isDestructive = e.action.includes("delete") || e.action.includes("reject") || e.action.includes("deactivate");
                return (
                  <tr key={e.id} className="hover:bg-zinc-900/40 align-top">
                    <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                      <div>{formatDate(e.createdAt, locale)}</div>
                      <div className="text-[10px] text-zinc-600">
                        {new Date(e.createdAt).toLocaleTimeString(
                          locale === "en" ? "en-US" : "en",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-300" dir="ltr">
                      {e.actorEmail}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px]",
                          isDestructive
                            ? "bg-rose-500/10 text-rose-400"
                            : e.action.includes("create") || e.action.includes("approve")
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-sky-500/10 text-sky-400"
                        )}
                      >
                        {auditActionLabel(e.action, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-300">
                      {e.targetLabel ?? e.targetId ?? "—"}
                      {e.targetType && (
                        <div className="text-[10px] text-zinc-600">{e.targetType}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-zinc-500">
                      {meta ? (
                        <div className="space-y-0.5">
                          {Object.entries(meta).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-zinc-600">{k}:</span>
                              <span className="text-zinc-400" dir="ltr">
                                {formatMetaValue(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <a
            href={`/admin/audit?page=${Math.max(1, page - 1)}${actionFilter ? `&action=${actionFilter}` : ""}`}
            className={cn(
              "rounded-md border px-3 py-1.5",
              page === 1
                ? "pointer-events-none border-zinc-800 text-zinc-600"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            )}
          >
            {t("audit.prev")}
          </a>
          <span className="text-zinc-500">
            {page} / {totalPages}
          </span>
          <a
            href={`/admin/audit?page=${Math.min(totalPages, page + 1)}${actionFilter ? `&action=${actionFilter}` : ""}`}
            className={cn(
              "rounded-md border px-3 py-1.5",
              page >= totalPages
                ? "pointer-events-none border-zinc-800 text-zinc-600"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            )}
          >
            {t("audit.next")}
          </a>
        </div>
      )}
    </div>
  );
}

function formatMetaValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v || "—";
  if (typeof v === "number") return v.toLocaleString("en");
  if (typeof v === "boolean") return v ? "true" : "false";
  return JSON.stringify(v);
}
