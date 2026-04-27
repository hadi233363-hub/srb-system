"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markNotificationsReadAction } from "./actions";

export function MarkAllReadButton({ locale }: { locale: "ar" | "en" }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsReadAction();
        })
      }
      className="flex h-10 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-xs text-zinc-400 transition hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-50"
    >
      <CheckCheck className="h-3.5 w-3.5" />
      {locale === "ar" ? "وضع الكل كمقروء" : "Mark all read"}
    </button>
  );
}
