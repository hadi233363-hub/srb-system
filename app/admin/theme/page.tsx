import { Palette } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { ThemeEditor } from "./theme-editor";

export default async function ThemePage() {
  const [session, locale, settings] = await Promise.all([
    auth(),
    getLocale(),
    prisma.appSetting.findUnique({ where: { id: 1 } }).catch(() => null),
  ]);
  const t = (key: string) => translate(key, locale);

  if (session?.user.role !== "admin") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("page.theme.title")}</h1>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <div className="text-sm text-zinc-400">{t("admin.denied.title")}</div>
          <p className="mt-2 text-xs text-zinc-500">{t("admin.denied.desc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Palette className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
            {t("page.theme.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{t("page.theme.subtitle")}</p>
        </div>
      </div>

      <ThemeEditor
        initialBrand={settings?.brandColor ?? "#10b981"}
        initialAccent={settings?.accentColor ?? "#0ea5e9"}
        logoPath={settings?.logoPath ?? "/srb-logo-white.png"}
      />
    </div>
  );
}
