// Print-friendly call sheet for a photo shoot. Standalone page (no sidebar /
// topbar / mobile nav) so the user can hit Cmd/Ctrl+P and print straight to
// PDF or paper. Crew gets all the info they need on-site at a glance.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/server";
import { isDeptLeadOrAbove } from "@/lib/auth/roles";
import { ClientPrintButton } from "./client-print-button";

export const dynamic = "force-dynamic";

export default async function CallSheetPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const isAr = locale === "ar";
  if (!session?.user) redirect("/login");
  if (!isDeptLeadOrAbove(session.user.role)) {
    return (
      <div className="p-12 text-center">
        <h1 className="text-lg font-bold text-rose-400">
          {isAr ? "صلاحيات غير كافية" : "Permission denied"}
        </h1>
      </div>
    );
  }

  const shoot = await prisma.photoShoot.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true, client: { select: { name: true } } } },
      crew: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              jobTitle: true,
              phone: true,
              email: true,
            },
          },
        },
      },
      equipment: {
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
              category: true,
              brand: true,
              model: true,
              serialNumber: true,
            },
          },
        },
      },
    },
  });
  if (!shoot) notFound();

  const dateLabel = new Date(shoot.shootDate).toLocaleString(isAr ? "en" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = new Date(
    shoot.shootDate.getTime() + shoot.durationHours * 60 * 60 * 1000
  ).toLocaleString(isAr ? "en" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="min-h-dvh bg-white text-zinc-900 print:bg-white" dir={isAr ? "rtl" : "ltr"}>
      {/* Toolbar — hidden on print */}
      <div className="border-b border-zinc-300 bg-zinc-100 p-3 print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link
            href={`/shoots/${id}`}
            className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
          >
            <ArrowRight className="h-3 w-3" />
            {isAr ? "ارجع للجلسة" : "Back to shoot"}
          </Link>
          <PrintButton labelAr="اطبع / احفظ PDF" labelEn="Print / Save PDF" isAr={isAr} />
        </div>
      </div>

      {/* The actual call sheet */}
      <article className="mx-auto max-w-3xl space-y-4 p-6 text-[12px] leading-relaxed">
        <header className="border-b-2 border-zinc-900 pb-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold">{shoot.title}</h1>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              {isAr ? "كول شيت — SRB" : "Call sheet — SRB"}
            </div>
          </div>
          {shoot.project && (
            <div className="mt-1 text-sm text-zinc-600">
              {isAr ? "المشروع" : "Project"}: <strong>{shoot.project.title}</strong>
              {shoot.project.client && ` · ${shoot.project.client.name}`}
            </div>
          )}
        </header>

        <Row labelAr="الوقت" labelEn="Time" isAr={isAr}>
          <strong>{dateLabel}</strong>
          {" → "}
          {endTime}
          {" · "}
          {shoot.durationHours}h
        </Row>

        <Row labelAr="الموقع" labelEn="Location" isAr={isAr}>
          <div>
            <div className="font-semibold">{shoot.location}</div>
            {shoot.locationNotes && (
              <div className="text-zinc-700">{shoot.locationNotes}</div>
            )}
            {shoot.mapUrl && (
              <a
                href={shoot.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-700 underline print:no-underline"
              >
                {shoot.mapUrl}
              </a>
            )}
          </div>
        </Row>

        {shoot.clientContact && (
          <Row labelAr="الاتصال في الموقع" labelEn="On-site contact" isAr={isAr}>
            {shoot.clientContact}
          </Row>
        )}

        <section>
          <h2 className="mb-1 border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
            {isAr ? "الفريق" : "Crew"} ({shoot.crew.length})
          </h2>
          {shoot.crew.length === 0 ? (
            <p className="text-zinc-500">
              {isAr ? "ما تم إسناد فريق بعد" : "No crew assigned yet"}
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-1 text-start">{isAr ? "الاسم" : "Name"}</th>
                  <th className="py-1 text-start">{isAr ? "الدور" : "Role"}</th>
                  <th className="py-1 text-start">{isAr ? "الهاتف" : "Phone"}</th>
                </tr>
              </thead>
              <tbody>
                {shoot.crew.map((c) => (
                  <tr key={c.userId} className="border-t border-zinc-200">
                    <td className="py-1 font-medium">{c.user.name}</td>
                    <td className="py-1 text-zinc-700">
                      {c.role ?? c.user.jobTitle ?? "—"}
                    </td>
                    <td className="py-1 text-zinc-700 tabular-nums" dir="ltr">
                      {c.user.phone ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="mb-1 border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
            {isAr ? "المعدات" : "Equipment"} ({shoot.equipment.length})
          </h2>
          {shoot.equipment.length === 0 ? (
            <p className="text-zinc-500">
              {isAr ? "ما تم حجز معدات" : "No equipment reserved"}
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-1 text-start">{isAr ? "العنصر" : "Item"}</th>
                  <th className="py-1 text-start">{isAr ? "الفئة" : "Category"}</th>
                  <th className="py-1 text-start">{isAr ? "الرقم التسلسلي" : "Serial"}</th>
                </tr>
              </thead>
              <tbody>
                {shoot.equipment.map((e) => (
                  <tr key={e.equipmentId} className="border-t border-zinc-200">
                    <td className="py-1 font-medium">
                      {e.equipment.brand
                        ? `${e.equipment.brand} ${e.equipment.model ?? ""}`.trim()
                        : e.equipment.name}
                    </td>
                    <td className="py-1 text-zinc-700">
                      {e.equipment.category}
                    </td>
                    <td className="py-1 text-zinc-700 tabular-nums" dir="ltr">
                      {e.equipment.serialNumber ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {shoot.shotList && (
          <section>
            <h2 className="mb-1 border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
              {isAr ? "قائمة اللقطات / البريف" : "Shot list / brief"}
            </h2>
            <div className="whitespace-pre-wrap text-[11px] text-zinc-800">
              {shoot.shotList}
            </div>
          </section>
        )}

        {shoot.referenceUrl && (
          <Row labelAr="مرجع" labelEn="Reference" isAr={isAr}>
            <a
              href={shoot.referenceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline print:no-underline"
            >
              {shoot.referenceUrl}
            </a>
          </Row>
        )}

        {shoot.notes && (
          <section>
            <h2 className="mb-1 border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
              {isAr ? "ملاحظات" : "Notes"}
            </h2>
            <div className="whitespace-pre-wrap text-[11px] text-zinc-800">
              {shoot.notes}
            </div>
          </section>
        )}

        <footer className="mt-6 border-t border-zinc-300 pt-2 text-[9px] text-zinc-500">
          {isAr
            ? "تم التوليد بواسطة نظام SRB الداخلي · "
            : "Generated by SRB Internal · "}
          {new Date().toLocaleString("en-US")}
        </footer>
      </article>
    </div>
  );
}

function Row({
  labelAr,
  labelEn,
  isAr,
  children,
}: {
  labelAr: string;
  labelEn: string;
  isAr: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 border-b border-zinc-200 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {isAr ? labelAr : labelEn}
      </div>
      <div className="text-[12px] text-zinc-900">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client island — the toolbar's "Print" button needs window.print().
// ---------------------------------------------------------------------------
function PrintButton({
  labelAr,
  labelEn,
  isAr,
}: {
  labelAr: string;
  labelEn: string;
  isAr: boolean;
}) {
  return <ClientPrintButton label={isAr ? labelAr : labelEn} />;
}
