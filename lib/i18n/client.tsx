"use client";

import { createContext, useCallback, useContext } from "react";
import { translate, type Locale } from "./dict";

interface LocaleContextValue {
  locale: Locale;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "ar",
  t: (k) => k,
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useCallback((key: string) => translate(key, locale), [locale]);
  return (
    <LocaleContext.Provider value={{ locale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

export function useT(): (key: string) => string {
  return useContext(LocaleContext).t;
}
