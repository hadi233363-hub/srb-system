"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Locale } from "@/lib/i18n/dict";
import { COOKIE_NAME } from "@/lib/i18n/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(locale: Locale): Promise<void> {
  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: locale === "en" ? "en" : "ar",
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  revalidatePath("/");
}
