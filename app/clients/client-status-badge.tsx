"use client";

// Computed status badge for a client. The "active" / "finished" decision is
// derived from the client's projects (see app/clients/page.tsx and
// app/clients/[id]/page.tsx) — never persisted, so this component just
// renders the boolean.

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

export function ClientStatusBadge({
  isActive,
  size = "default",
}: {
  isActive: boolean;
  size?: "default" | "lg";
}) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "lg" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]",
        isActive
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-emerald-400" : "bg-zinc-500"
        )}
      />
      {isActive ? t("clients.status.active") : t("clients.status.inactive")}
    </span>
  );
}
