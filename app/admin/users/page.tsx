import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listUsersWithBadges } from "@/lib/db/users";
import { prisma } from "@/lib/db/prisma";
import { UsersAdminClient } from "./users-admin-client";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { assignableRoles, isManagerOrAbove } from "@/lib/auth/roles";

export default async function AdminUsersPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);

  if (!session?.user) redirect("/login");
  if (!isManagerOrAbove(session.user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6 text-center">
          <div className="text-lg font-bold text-rose-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-sm text-zinc-400">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  const [users, allBadges] = await Promise.all([
    listUsersWithBadges(),
    prisma.badge.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("page.admin.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {users.length} {t("admin.accountsCount")} · {t("admin.subtitle")}
        </p>
      </div>
      <UsersAdminClient
        users={users}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
        allowedRoles={assignableRoles(session.user.role)}
        allBadges={allBadges}
        locale={locale}
      />
    </div>
  );
}
