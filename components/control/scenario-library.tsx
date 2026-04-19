"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CircleDollarSign,
  Crown,
  Flame,
  Frown,
  Layers,
  Shuffle,
  TrendingDown,
  UserMinus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useSim } from "../sim-provider";
import type { ScenarioCategory } from "@/lib/sim/types";

interface LibraryEntry {
  templateId: string;
  icon: LucideIcon;
  category: ScenarioCategory;
  title: string;
  subtitle: string;
  needs: "project" | "agent" | "none";
}

const CATALOG: LibraryEntry[] = [
  {
    templateId: "high_value_opportunity",
    icon: Crown,
    category: "sales_opportunity",
    title: "صفقة ذهبية",
    subtitle: "فرصة عالية القيمة · 180-320 ألف ر.ق",
    needs: "none",
  },
  {
    templateId: "sales_lead",
    icon: CircleDollarSign,
    category: "sales_opportunity",
    title: "فرصة مبيعات",
    subtitle: "عميل محتمل بميزانية متوسطة",
    needs: "none",
  },
  {
    templateId: "project_delayed",
    icon: Briefcase,
    category: "project_issue",
    title: "مشروع متأخر",
    subtitle: "تجاوز الـ deadline والعميل ينتظر",
    needs: "project",
  },
  {
    templateId: "unhappy_client",
    icon: Frown,
    category: "project_issue",
    title: "عميل غير راضٍ",
    subtitle: "مراجعات متكررة ورضا منخفض",
    needs: "project",
  },
  {
    templateId: "scope_change",
    icon: Shuffle,
    category: "project_issue",
    title: "تغيير في النطاق",
    subtitle: "العميل يبي شغل إضافي",
    needs: "project",
  },
  {
    templateId: "project_loss_risk",
    icon: AlertTriangle,
    category: "project_issue",
    title: "مشروع متجه لخسارة",
    subtitle: "تكاليف تجاوزت التقدير",
    needs: "project",
  },
  {
    templateId: "external_offer",
    icon: UserX,
    category: "employee_risk",
    title: "عرض خارجي لموظف",
    subtitle: "شركة منافسة تحاول جذبه",
    needs: "agent",
  },
  {
    templateId: "burnout_warning",
    icon: Flame,
    category: "employee_risk",
    title: "احتراق موظف",
    subtitle: "معنويات منخفضة + ضغط متراكم",
    needs: "agent",
  },
  {
    templateId: "underperformer",
    icon: UserMinus,
    category: "employee_risk",
    title: "موظف ضعيف الأداء",
    subtitle: "معدل فشل مرتفع · إنذار / تدريب / فصل؟",
    needs: "agent",
  },
  {
    templateId: "overload",
    icon: Layers,
    category: "operations",
    title: "اختناق تنفيذي",
    subtitle: "دور محمّل زيادة",
    needs: "project",
  },
  {
    templateId: "low_morale",
    icon: TrendingDown,
    category: "team_wellbeing",
    title: "معنويات منخفضة عامة",
    subtitle: "الفريق كله يحتاج دفعة",
    needs: "none",
  },
];

const categoryMeta: Record<
  ScenarioCategory,
  { label: string; hover: string; dot: string }
> = {
  sales_opportunity: {
    label: "فرصة بيع",
    hover:
      "hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.15)]",
    dot: "bg-emerald-500",
  },
  project_issue: {
    label: "مشكلة مشروع",
    hover:
      "hover:border-amber-500/40 hover:bg-amber-500/5 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.15)]",
    dot: "bg-amber-500",
  },
  employee_risk: {
    label: "خطر موظف",
    hover:
      "hover:border-rose-500/40 hover:bg-rose-500/5 hover:shadow-[0_0_0_1px_rgba(244,63,94,0.15)]",
    dot: "bg-rose-500",
  },
  team_wellbeing: {
    label: "راحة الفريق",
    hover:
      "hover:border-violet-500/40 hover:bg-violet-500/5 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15)]",
    dot: "bg-violet-500",
  },
  operations: {
    label: "عمليات",
    hover:
      "hover:border-sky-500/40 hover:bg-sky-500/5 hover:shadow-[0_0_0_1px_rgba(14,165,233,0.15)]",
    dot: "bg-sky-500",
  },
  external: {
    label: "خارجي",
    hover: "hover:border-zinc-500/40 hover:bg-zinc-500/5",
    dot: "bg-zinc-500",
  },
};

export function ScenarioLibrary({ onSpawned }: { onSpawned?: () => void }) {
  const { state, spawn } = useSim();
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  if (!state) return null;

  const activeProjectCount = state.projects.filter(
    (p) => p.status === "active" || p.status === "delayed"
  ).length;
  const activeAgentCount = state.agents.filter((a) => a.active).length;

  const handleClick = async (entry: LibraryEntry) => {
    setBusy(entry.templateId);
    setFlash(null);
    const res = await spawn(entry.templateId);
    setBusy(null);
    if (res.ok) {
      setFlash({ kind: "success", message: `تم توليد سيناريو: ${entry.title}` });
      onSpawned?.();
    } else {
      setFlash({
        kind: "error",
        message: res.error ?? "ما قدرنا نطلع هذا السيناريو الآن",
      });
    }
    window.setTimeout(() => setFlash(null), 3500);
  };

  return (
    <div className="space-y-3">
      {flash && (
        <div
          className={cn(
            "rounded-lg border px-4 py-2 text-sm transition",
            flash.kind === "success"
              ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-400"
              : "border-amber-900/40 bg-amber-950/20 text-amber-400"
          )}
        >
          {flash.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CATALOG.map((entry) => {
          const meta = categoryMeta[entry.category];
          const Icon = entry.icon;
          const isBusy = busy === entry.templateId;
          const disabled =
            isBusy ||
            (entry.needs === "project" && activeProjectCount === 0) ||
            (entry.needs === "agent" && activeAgentCount === 0);

          return (
            <button
              key={entry.templateId}
              onClick={() => handleClick(entry)}
              disabled={disabled}
              className={cn(
                "group relative flex flex-col items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-right transition",
                "disabled:cursor-not-allowed disabled:opacity-40",
                !disabled && meta.hover
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition group-hover:text-zinc-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                  {meta.label}
                </span>
              </div>
              <div className="w-full">
                <div className="text-sm font-semibold text-zinc-100">
                  {isBusy ? "يولّد..." : entry.title}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-500">
                  {entry.subtitle}
                </div>
              </div>
              {entry.needs !== "none" && (
                <div className="w-full border-t border-zinc-800 pt-2 text-[10px] text-zinc-600">
                  {entry.needs === "project"
                    ? `يحتاج مشروع نشط (${activeProjectCount})`
                    : `يحتاج موظف (${activeAgentCount})`}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
