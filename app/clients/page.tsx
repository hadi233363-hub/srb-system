// Clients (CRM) list page. Server-rendered: fetches every client + the
// aggregates the table needs (project counts, last project, total revenue),
// then hands the data to a client component that does live in-memory search
// and the "new client" modal. This keeps the bandwidth small (the list is
// capped at 1k rows for the foreseeable future) and avoids a second
// roundtrip on each keystroke.

import { UsersRound } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { hasPermission } from "@/lib/auth/permissions";
import { getUserOverrides } from "@/lib/db/permissions";
import { ClientsTable } from "./clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  const sessionUser = session?.user;
  if (!sessionUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-zinc-500">{t("admin.denied.desc")}</div>
      </div>
    );
  }

  const overrides = await getUserOverrides(sessionUser.id);
  const canView = hasPermission(sessionUser, "clients", "view", overrides);
  const canCreate = hasPermission(sessionUser, "clients", "create", overrides);

  if (!canView) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6 text-center">
          <div className="text-lg font-bold text-rose-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-sm text-zinc-400">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  const clients = await prisma.client.findMany({
    include: {
      projects: {
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          startedAt: true,
          transactions: {
            where: { kind: "income" },
            select: { amountQar: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Reduce the heavy nested objects to flat numbers / strings the client
  // component can sort + filter cheaply. We compute "last project" + "joined"
  // here (server) so the client never sees raw transaction rows.
  const rows = clients.map((c) => {
    const totalRevenue = c.projects.reduce(
      (sum, p) => sum + p.transactions.reduce((a, t) => a + t.amountQar, 0),
      0
    );
    const last = c.projects[0];
    const first = c.projects[c.projects.length - 1];
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      projectsCount: c.projects.length,
      totalRevenue,
      lastProjectTitle: last?.title ?? null,
      lastProjectAt: (last?.createdAt ?? null) as Date | null,
      joinedAt: (first?.createdAt ?? c.createdAt) as Date,
    };
  });

  // Most recent activity first — uses the latest project createdAt when present,
  // otherwise the client's own updatedAt (already orderBy'd above).
  rows.sort((a, b) => {
    const aT = a.lastProjectAt?.getTime() ?? 0;
    const bT = b.lastProjectAt?.getTime() ?? 0;
    return bT - aT;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("page.clients.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {rows.length} {t("clients.count")} · {t("page.clients.subtitle")}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <UsersRound className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("clients.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">{t("clients.empty.desc")}</p>
          {canCreate && <ClientsTable rows={[]} canCreate={canCreate} locale={locale} emptyAddOnly />}
        </div>
      ) : (
        <ClientsTable rows={rows} canCreate={canCreate} locale={locale} />
      )}
    </div>
  );
}
