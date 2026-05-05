import { SmartEditGenerator } from "./smart-edit-generator";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

export default async function SmartEditPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(key, locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("smartEdit.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("smartEdit.subtitle")}</p>
      </div>
      <SmartEditGenerator locale={locale} />
    </div>
  );
}
