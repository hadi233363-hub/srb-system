import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";

type PageProps = {
  searchParams: Promise<{ from?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  const [locale, settings] = await Promise.all([
    getLocale(),
    prisma.appSetting.findUnique({ where: { id: 1 } }).catch(() => null),
  ]);
  const t = (key: string) => translate(key, locale);
  const logoPath = settings?.logoPath ?? "/srb-logo-white.png";

  const { from, error } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
        <div className="space-y-1 border-b border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 p-6 text-center">
          <div
            className="mx-auto mb-3 rounded-2xl px-4 py-3"
            style={{ background: "var(--color-brand-dim)", width: "fit-content" }}
          >
            <img
              src={logoPath}
              alt="SRB"
              className="h-10 w-auto"
            />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">{t("login.title")}</h1>
          <p className="text-xs text-zinc-500">{t("login.subtitle")}</p>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-zinc-400">{t("login.body")}</p>

          {error === "AccessDenied" && (
            <div className="rounded-lg border border-rose-900/40 bg-rose-950/30 p-3 text-xs text-rose-300">
              ⚠ {t("pending.disabled")}
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: from || "/" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
            >
              <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </form>

          <div className="border-t border-zinc-800 pt-3 text-center text-[11px] text-zinc-600">
            {t("login.internalOnly")}
          </div>
        </div>
      </div>
    </div>
  );
}
