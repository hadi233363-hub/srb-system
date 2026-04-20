"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/i18n/client";
import { setLocaleAction } from "@/app/actions/set-locale";
import type { Locale } from "@/lib/i18n/dict";

export function LanguageSwitcher() {
  const { locale } = useLocale();
  const [isPending, startTransition] = useTransition();

  const switchTo = (l: Locale) => {
    if (l === locale) return;
    startTransition(async () => {
      await setLocaleAction(l);
    });
  };

  return (
    <div className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/60 p-0.5 text-xs">
      <Languages className="mx-1 h-3 w-3 text-zinc-500" />
      <button
        onClick={() => switchTo("ar")}
        disabled={isPending}
        className={cn(
          "rounded px-2 py-0.5 transition disabled:opacity-60",
          locale === "ar"
            ? "bg-emerald-500/15 text-emerald-400"
            : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        عربي
      </button>
      <button
        onClick={() => switchTo("en")}
        disabled={isPending}
        className={cn(
          "rounded px-2 py-0.5 transition disabled:opacity-60",
          locale === "en"
            ? "bg-emerald-500/15 text-emerald-400"
            : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        EN
      </button>
    </div>
  );
}
