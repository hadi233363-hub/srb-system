import { Lock } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { isOwner } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/permissions";
import { getUserOverrides } from "@/lib/db/permissions";
import { formatQar } from "@/lib/db/helpers";
import { PartnerShareManager } from "./partner-share-manager";
import type { ShareEntry, ProjectOption } from "./partner-share-manager";

export default async function PartnerSharePage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  const role = session?.user?.role;
  const userId = session?.user?.id;
  const overrides = userId ? await getUserOverrides(userId) : [];

  const canView =
    isOwner(role) ||
    hasPermission({ role: role ?? "employee" }, "partnerShare", "view", overrides);

  if (!canView) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <Lock className="h-10 w-10 text-zinc-700" />
        <div className="text-sm text-zinc-500">{t("common.noAccess")}</div>
      </div>
    );
  }

  // Fetch all partner shares with project titles
  const allShares = await prisma.partnerShare.findMany({
    include: { project: { select: { id: true, title: true } } },
    orderBy: [{ project: { title: "asc" } }, { createdAt: "asc" }],
  });

  // Compute total income per project from transactions
  const incomeRows = await prisma.transaction.groupBy({
    by: ["projectId"],
    where: { kind: "income", projectId: { not: null } },
    _sum: { amountQar: true },
  });
  const incomeByProject = new Map<string, number>(
    incomeRows.map((r) => [r.projectId!, r._sum.amountQar ?? 0])
  );

  const shares: ShareEntry[] = allShares.map((s) => {
    const projectIncome = incomeByProject.get(s.projectId) ?? 0;
    const partnerAmount = (projectIncome * s.sharePercent) / 100;
    return {
      id: s.id,
      projectId: s.projectId,
      projectTitle: s.project.title,
      partnerName: s.partnerName,
      sharePercent: s.sharePercent,
      notes: s.notes,
      projectIncome,
      partnerAmount,
    };
  });

  // All projects for the "add share" dropdown
  const allProjects = await prisma.project.findMany({
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  const projects: ProjectOption[] = allProjects.map((p) => ({ id: p.id, title: p.title }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("partnerShare.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("partnerShare.subtitle")}</p>
      </div>

      {/* Private data warning */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-300">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        {t("partnerShare.privateWarning")}
      </div>

      <PartnerShareManager shares={shares} projects={projects} locale={locale} />
    </div>
  );
}
