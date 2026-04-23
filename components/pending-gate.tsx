"use client";

import { signOut } from "next-auth/react";
import { Clock, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "./language-switcher";

interface Props {
  userName: string;
  userEmail: string;
  // When true, the user was previously approved but is now disabled by the admin.
  // When false, they've never been approved yet (fresh sign-in awaiting review).
  wasPreviouslyApproved: boolean;
}

export function PendingGate({ userName, userEmail, wasPreviouslyApproved }: Props) {
  const t = useT();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
        <div className="space-y-1 border-b border-zinc-800 bg-gradient-to-b from-amber-950/30 to-zinc-900/40 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">
            {t("pending.title")}
          </h1>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs">
            <div className="text-zinc-400">{userName}</div>
            <div className="text-zinc-600" dir="ltr">
              {userEmail}
            </div>
          </div>

          <p className="text-sm text-zinc-400">
            {wasPreviouslyApproved ? t("pending.disabled") : t("pending.body")}
          </p>
          <p className="text-xs text-zinc-500">{t("pending.nudge")}</p>

          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-rose-500/30 hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
            {t("auth.signout")}
          </button>
        </div>
      </div>
    </div>
  );
}
