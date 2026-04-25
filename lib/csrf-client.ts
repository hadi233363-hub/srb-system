// Client-side CSRF helper. Reads the `csrf-token` cookie (set by proxy.ts) and
// attaches it as `x-csrf-token` on state-changing fetches. Wrap every mutating
// fetch from a "use client" component with `csrfFetch` — it's a drop-in for fetch.

import { CSRF_COOKIE, CSRF_HEADER } from "./csrf";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = name + "=";
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

export function csrfHeader(): Record<string, string> {
  const token = readCookie(CSRF_COOKIE);
  return token ? { [CSRF_HEADER]: token } : {};
}

export function csrfFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (SAFE_METHODS.has(method)) return fetch(input, init);

  const headers = new Headers(init.headers);
  const token = readCookie(CSRF_COOKIE);
  if (token && !headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, token);
  return fetch(input, { ...init, headers });
}
