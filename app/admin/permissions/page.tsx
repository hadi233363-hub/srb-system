import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { isOwner } from "@/lib/auth/roles";
import { listOverridesForUsers } from "@/lib/db/permissions";
import { PermissionsClient } from "./permissions-client";

export default async function AdminPermissionsPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  if (!session?.user) redirect("/login");
  if (!isOwner(session.user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6 text-center">
          <div className="text-lg font-bold text-rose-400">
            {t("admin.denied.title")}
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            {locale === "ar"
              ? "هذي الصفحة للرئيس فقط — يقدر يتحكم بصلاحيات كل موظف يدوياً."
              : "This page is for the Owner only — fine-grained permission control."}
          </p>
        </div>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      jobTitle: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const overridesByUser = await listOverridesForUsers(users.map((u) => u.id));

  // Serialize the Map for the client component (Next won't pass Maps across
  // the boundary).
  const overridesPayload: Record<
    string,
    { module: string; action: string; allowed: boolean }[]
  > = {};
  for (const [userId, list] of overridesByUser.entries()) {
    overridesPayload[userId] = list;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {locale === "ar" ? "لوحة الصلاحيات" : "Permission Control Panel"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {locale === "ar"
            ? "حدّد صلاحيات كل موظف بدقة — يمكنك تعطيل أو منح أي صلاحية يدوياً، فوق الإعدادات الافتراضية لدوره."
            : "Override role defaults per user. Grant or revoke individual capabilities without inventing new roles."}
        </p>
      </div>
      <PermissionsClient
        users={users}
        overridesByUser={overridesPayload}
        locale={locale}
      />
    </div>
  );
}
