import { cookies } from "next/headers";
import type { Locale } from "./dict";

const COOKIE_NAME = "srb_locale";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  return raw === "en" ? "en" : "ar";
}

export { COOKIE_NAME };
