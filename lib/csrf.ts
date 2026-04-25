// CSRF — double-submit cookie pattern.
// proxy.ts issues a `csrf-token` cookie on every authed response, and rejects
// state-changing /api/* requests whose `x-csrf-token` header doesn't match the
// cookie. Web-Crypto only — runs in the edge runtime.

export const CSRF_COOKIE = "csrf-token";
export const CSRF_HEADER = "x-csrf-token";

// 32 random bytes hex-encoded → 64-char token. Edge-safe (no Node crypto).
export function generateCsrfToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string compare to avoid leaking the token via timing.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
