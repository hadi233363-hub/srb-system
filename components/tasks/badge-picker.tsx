"use client";

// Inline badge picker — toggle-on/off chips. Used in the new-task modal so
// the manager can say "I need a designer + a video editor" without
// describing it in prose.

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n/dict";
import { translate } from "@/lib/i18n/dict";

export interface BadgeOption {
  id: string;
  slug: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  colorHex: string;
}

export function BadgePicker({
  badges,
  selectedSlugs,
  onChange,
  autoDetectedSlugs,
  locale,
}: {
  badges: BadgeOption[];
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
  /** Slugs the system inferred from the task title — shown as a subtle ghost ring. */
  autoDetectedSlugs?: string[];
  locale: Locale;
}) {
  const t = (k: string) => translate(k, locale);
  const selected = new Set(selectedSlugs);
  const detected = new Set(autoDetectedSlugs ?? []);

  const toggle = (slug: string) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange([...next]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{t("badges.required")}</span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] text-zinc-600 hover:text-zinc-400"
          >
            {t("badges.clear")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((b) => {
          const isOn = selected.has(b.slug);
          const isDetected = detected.has(b.slug);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.slug)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition",
                isOn
                  ? "font-semibold"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-200",
                !isOn && isDetected && "ring-1 ring-emerald-500/30"
              )}
              style={
                isOn
                  ? {
                      borderColor: b.colorHex + "80",
                      backgroundColor: b.colorHex + "20",
                      color: b.colorHex,
                    }
                  : undefined
              }
              title={isDetected ? t("badges.detectedHint") : undefined}
            >
              <span>{b.icon}</span>
              <span>{locale === "ar" ? b.labelAr : b.labelEn}</span>
              {isOn && <Check className="h-3 w-3" />}
            </button>
          );
        })}
        {badges.length === 0 && (
          <span className="text-[11px] text-zinc-600">{t("badges.noneDefined")}</span>
        )}
      </div>
    </div>
  );
}
