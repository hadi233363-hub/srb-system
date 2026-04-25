"use client";

// Full-page gate shown to active users who haven't picked a nickname yet.
// Renders instead of the normal app shell so the user can't reach any data
// (or have their email shown to teammates) before they choose a handle.

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { LogOut, UserCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitcher } from "./language-switcher";
import { saveNicknameAction } from "@/app/onboarding/nickname/actions";

const NICK_RE = /^[A-Za-z0-9_-]{2,24}$/;

interface Props {
  userName: string;
}

export function NicknameGate({ userName }: Props) {
  const t = useT();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = value.trim();
    if (!NICK_RE.test(trimmed)) {
      setError(t("onboarding.nickname.invalid"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveNicknameAction(trimmed);
      if (!res.ok) {
        setError(
          res.reason === "taken"
            ? t("onboarding.nickname.taken")
            : t("onboarding.nickname.invalid")
        );
      }
      // On success the action calls revalidatePath("/") and a redirect happens;
      // we don't need to do anything client-side.
    });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
        <div className="space-y-1 border-b border-zinc-800 bg-gradient-to-b from-emerald-950/30 to-zinc-900/40 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <UserCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">
            {t("onboarding.nickname.title")}
          </h1>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-zinc-400">{t("onboarding.nickname.body")}</p>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-500">
            {userName}
          </div>

          <div>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={t("onboarding.nickname.placeholder")}
              dir="ltr"
              maxLength={24}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              autoFocus
            />
            {error && (
              <div className="mt-2 text-xs text-rose-400">{error}</div>
            )}
          </div>

          <button
            onClick={submit}
            disabled={isPending || value.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {t("onboarding.nickname.save")}
          </button>

          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-500 transition hover:border-rose-500/30 hover:text-rose-400"
          >
            <LogOut className="h-3 w-3" />
            {t("auth.signout")}
          </button>
        </div>
      </div>
    </div>
  );
}
