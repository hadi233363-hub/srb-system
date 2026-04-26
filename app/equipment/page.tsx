import {
  Camera,
  Mic,
  Package,
  Plane,
  Target,
  Disc3,
  HardDrive,
  Puzzle,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { cn } from "@/lib/cn";
import { formatDate, formatQar } from "@/lib/db/helpers";
import { EquipmentForm } from "./equipment-form";
import { CheckOutButton } from "./checkout-button";
import { DeleteEquipmentButton } from "./delete-button";
import { isDeptLeadOrAbove, isOwner } from "@/lib/auth/roles";

// Map category → icon. Lucide 1.x doesn't ship every icon — pick ones we know exist.
const CATEGORY_ICON: Record<string, typeof Camera> = {
  camera: Camera,
  lens: Target,
  light: Disc3,
  tripod: Package,
  microphone: Mic,
  drone: Plane,
  audio: Mic,
  storage: HardDrive,
  accessory: Puzzle,
  other: Package,
};

const CONDITION_STYLE: Record<string, string> = {
  new: "bg-emerald-500/10 text-emerald-400",
  good: "bg-sky-500/10 text-sky-400",
  fair: "bg-amber-500/10 text-amber-400",
  needs_repair: "bg-orange-500/10 text-orange-400",
  broken: "bg-rose-500/10 text-rose-400",
};

export default async function EquipmentPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(key, locale);
  const user = session?.user;
  if (!user) return null;
  const canManage = isDeptLeadOrAbove(user.role);
  // Equipment value totals (purchase price aggregate) are owner-only — same
  // policy as the finance dashboard.
  const canSeeValue = isOwner(user.role);

  const [equipment, users] = await Promise.all([
    prisma.equipment.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        currentHolder: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Group by category
  const byCategory = new Map<string, typeof equipment>();
  for (const e of equipment) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category)!.push(e);
  }

  const totalValue = equipment.reduce(
    (s, e) => s + (e.purchasePriceQar ?? 0),
    0
  );
  const outCount = equipment.filter((e) => e.currentHolderId).length;
  const needsRepair = equipment.filter(
    (e) => e.condition === "needs_repair" || e.condition === "broken"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Camera className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
            {t("page.equipment.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("page.equipment.subtitle")}
          </p>
        </div>
        {canManage && <EquipmentForm mode="create" />}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          icon={Package}
          label={t("equipment.stats.total")}
          value={String(equipment.length)}
          tone="brand"
        />
        <Kpi
          icon={Camera}
          label={t("equipment.stats.categories")}
          value={String(byCategory.size)}
        />
        <Kpi
          icon={HardDrive}
          label={t("equipment.stats.checkedOut")}
          value={String(outCount)}
          tone={outCount > 0 ? "accent" : "muted"}
        />
        <Kpi
          icon={Target}
          label={t("equipment.stats.needsRepair")}
          value={String(needsRepair)}
          tone={needsRepair > 0 ? "danger" : "muted"}
        />
      </div>

      {/* Total value (owner only — same sensitivity as salaries) */}
      {canSeeValue && totalValue > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--color-brand-border)",
            background: "var(--color-brand-dim)",
          }}
        >
          <div
            className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-brand)" }}
          >
            {t("equipment.stats.totalValue")}
          </div>
          <div className="text-2xl font-bold text-zinc-100 tabular-nums">
            {formatQar(totalValue, { locale })}
          </div>
        </div>
      )}

      {equipment.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Camera className="h-10 w-10 text-zinc-700" />
          <div className="text-sm text-zinc-400">{t("equipment.empty.title")}</div>
          <p className="max-w-md text-xs text-zinc-500">
            {t("equipment.empty.desc")}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byCategory.entries()).map(([category, items]) => {
            const Icon = CATEGORY_ICON[category] ?? Package;
            return (
              <section key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "var(--color-brand-dim)" }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: "var(--color-brand)" }}
                    />
                  </div>
                  <h2 className="text-sm font-semibold text-zinc-200">
                    {t(`equipment.category.${category}`)}
                  </h2>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                    {items.length}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <table className="w-full text-sm">
                    <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
                      <tr>
                        <th className="px-4 py-2 text-start font-normal">
                          {t("equipment.field.name")}
                        </th>
                        <th className="px-4 py-2 text-start font-normal">
                          {t("equipment.field.condition")}
                        </th>
                        <th className="px-4 py-2 text-start font-normal">
                          {t("equipment.holder")}
                        </th>
                        {canManage && (
                          <th className="px-4 py-2 text-start font-normal">
                            {t("equipment.actions")}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {items.map((e) => (
                        <tr key={e.id} className="hover:bg-zinc-900/40">
                          <td className="px-4 py-3">
                            <div className="text-sm text-zinc-100">
                              {e.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              {[e.brand, e.model, e.serialNumber]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                            {e.notes && (
                              <div className="mt-0.5 text-[10px] text-zinc-600">
                                {e.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px]",
                                CONDITION_STYLE[e.condition] ??
                                  "bg-zinc-700/40 text-zinc-400"
                              )}
                            >
                              {t(`equipment.condition.${e.condition}`)}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top">
                            {e.currentHolder ? (
                              <div>
                                <div className="text-xs text-zinc-200">
                                  {e.currentHolder.name}
                                </div>
                                {e.expectedReturnAt && (
                                  <div className="text-[10px] text-zinc-500">
                                    {t("equipment.return")}:{" "}
                                    {formatDate(e.expectedReturnAt, locale)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-600">
                                {t("equipment.inStorage")}
                              </span>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-wrap items-center gap-2">
                                <CheckOutButton
                                  equipmentId={e.id}
                                  equipmentName={e.name}
                                  currentHolder={e.currentHolder}
                                  users={users}
                                />
                                <EquipmentEditInline
                                  equipment={{
                                    id: e.id,
                                    name: e.name,
                                    category: e.category,
                                    brand: e.brand,
                                    model: e.model,
                                    serialNumber: e.serialNumber,
                                    condition: e.condition,
                                    notes: e.notes,
                                    purchasedAt: e.purchasedAt,
                                    purchasePriceQar: e.purchasePriceQar,
                                  }}
                                />
                                <DeleteEquipmentButton
                                  id={e.id}
                                  name={e.name}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Camera;
  label: string;
  value: string;
  tone?: "brand" | "accent" | "muted" | "danger";
}) {
  const style =
    tone === "brand"
      ? { color: "var(--color-brand)" }
      : tone === "accent"
      ? { color: "var(--color-accent)" }
      : tone === "danger"
      ? { color: "#fb7185" }
      : undefined;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      <div
        className="mt-1 text-2xl font-bold tabular-nums text-zinc-100"
        style={style}
      >
        {value}
      </div>
    </div>
  );
}

// Thin wrapper to render EquipmentForm in edit mode from a server component.
function EquipmentEditInline({
  equipment,
}: {
  equipment: {
    id: string;
    name: string;
    category: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    condition: string;
    notes: string | null;
    purchasedAt: Date | null;
    purchasePriceQar: number | null;
  };
}) {
  return <EquipmentForm mode="edit" initial={equipment} />;
}
