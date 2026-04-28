// Client profile page — header with editable contact fields, projects table,
// and a financial summary footer. The header form is a client component that
// posts back via the updateClientAction server action; the table + summary
// are pure server-rendered.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, UsersRound } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { hasPermission } from "@/lib/auth/permissions";
import { getUserOverrides } from "@/lib/db/permissions";
import { isOwner } from "@/lib/auth/roles";
import { cn } from "@/lib/cn";
import {
  PROJECT_STATUS_COLOR,
  formatDate,
  formatQar,
} from "@/lib/db/helpers";
import { ClientProfileForm } from "../client-profile-form";
import { ClientStatusBadge } from "../client-status-badge";
import { ClientNotesSection } from "../client-notes-section";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const Back = locale === "ar" ? ArrowRight : ArrowLeft;

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
  const canEdit = hasPermission(sessionUser, "clients", "edit", overrides);
  const canDelete = hasPermission(sessionUser, "clients", "delete", overrides);

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

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        include: {
          transactions: {
            where: { kind: "income" },
            select: { amountQar: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      noteEntries: {
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) notFound();

  // Aggregates for the summary footer + per-project remaining column.
  const totalPaid = client.projects.reduce(
    (sum, p) => sum + p.transactions.reduce((a, t) => a + t.amountQar, 0),
    0
  );
  const completedCount = client.projects.filter((p) => p.status === "completed").length;
  const activeCount = client.projects.filter(
    (p) => p.status === "active" || p.status === "on_hold"
  ).length;
  // Computed status — same rule as the table: "active" if at least one
  // project is in `active` state, otherwise "finished". Never persisted.
  const isActive = client.projects.some((p) => p.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/clients"
          className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <Back className="h-3 w-3" />
          {t("page.clients.title")}
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <UsersRound className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <ClientStatusBadge isActive={isActive} size="lg" />
            </div>
            <p className="text-xs text-zinc-500">
              {client.brandName && (
                <span className="text-zinc-300">{client.brandName} · </span>
              )}
              {client.projects.length} {t("clients.col.projectsCount")} ·{" "}
              {totalPaid > 0 ? formatQar(totalPaid, { locale }) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Editable profile */}
      <ClientProfileForm
        id={client.id}
        initial={{
          name: client.name,
          brandName: client.brandName,
          phone: client.phone,
          email: client.email,
          notes: client.notes,
        }}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      {/* Projects table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          {t("clients.detail.projects")}
        </h2>
        {client.projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-500">
            {t("clients.proj.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
                  <Th>{t("clients.proj.title")}</Th>
                  <Th>{t("clients.proj.type")}</Th>
                  <Th>{t("clients.proj.status")}</Th>
                  <Th align="end">{t("clients.proj.budget")}</Th>
                  <Th align="end">{t("clients.proj.paid")}</Th>
                  <Th align="end">{t("clients.proj.remaining")}</Th>
                  <Th>{t("clients.proj.startedAt")}</Th>
                </tr>
              </thead>
              <tbody>
                {client.projects.map((p) => {
                  const paid = p.transactions.reduce((a, t) => a + t.amountQar, 0);
                  const remaining = Math.max(0, p.budgetQar - paid);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-900 transition hover:bg-zinc-900/60 last:border-b-0"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/projects/${p.id}`}
                          className="font-semibold text-zinc-100 hover:text-emerald-400"
                        >
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {p.billingType === "monthly"
                          ? t("billing.monthly")
                          : t("billing.one_time")}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px]",
                            PROJECT_STATUS_COLOR[p.status]
                          )}
                        >
                          {t(`projectStatus.${p.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums text-zinc-200">
                        {p.budgetQar > 0 ? formatQar(p.budgetQar, { locale }) : "—"}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums text-emerald-400">
                        {paid > 0 ? formatQar(paid, { locale }) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-end tabular-nums",
                          remaining > 0 ? "text-amber-400" : "text-zinc-500"
                        )}
                      >
                        {remaining > 0 ? formatQar(remaining, { locale }) : "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-500 tabular-nums">
                        {formatDate(p.startedAt, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Communication log — touchpoint notes */}
      <ClientNotesSection
        clientId={client.id}
        notes={client.noteEntries.map((n) => ({
          id: n.id,
          content: n.content,
          createdAt: n.createdAt,
          author: n.author ? { id: n.author.id, name: n.author.name } : null,
        }))}
        currentUserId={sessionUser.id}
        currentUserIsOwner={isOwner(sessionUser.role)}
      />

      {/* Financial summary */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">
          {t("clients.detail.summary")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            label={t("clients.detail.totalPaid")}
            value={totalPaid > 0 ? formatQar(totalPaid, { locale }) : "—"}
            tone="emerald"
          />
          <SummaryCard
            label={t("clients.detail.completedCount")}
            value={String(completedCount)}
            tone="sky"
          />
          <SummaryCard
            label={t("clients.detail.activeCount")}
            value={String(activeCount)}
            tone="amber"
          />
        </div>
      </section>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th
      className={cn(
        "px-3 py-2 font-medium",
        align === "end" ? "text-end" : "text-start"
      )}
    >
      {children}
    </th>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "sky"
      ? "text-sky-400"
      : "text-amber-400";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", toneClass)}>
        {value}
      </div>
    </div>
  );
}
