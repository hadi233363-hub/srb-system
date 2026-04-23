// Centralised input validation limits.
//
// These exist to keep a single malicious / buggy client from wedging the app
// via a multi-MB `title` string or a 9-trillion-QAR transaction. Every server
// action that accepts user-supplied text or money should run it through
// `safeString` / `safeAmount` before writing to the DB.

export const MAX_TITLE_LEN = 200;
export const MAX_NAME_LEN = 120;
export const MAX_SHORT_TEXT = 300; // phone, email, url, notes field
export const MAX_LONG_TEXT = 5_000; // description, notes, agenda
export const MAX_AMOUNT_QAR = 10_000_000; // 10M QAR cap — higher than any real SRB transaction

/**
 * Trim, then enforce max length. Returns `null` for empty input so the caller
 * can decide between null-ok and required. Throws on over-limit input so we
 * fail loud instead of silently truncating financial records.
 */
export function safeString(raw: unknown, maxLen: number): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  if (s.length > maxLen) {
    throw new Error(`النص أطول من الحد المسموح (${maxLen} حرف)`);
  }
  return s;
}

/**
 * Parse and clamp a money amount (QAR). Always returns a positive number —
 * the transaction's `kind` field determines income vs expense, so negative
 * input is collapsed to its absolute value rather than silently sign-flipped.
 * Caps at MAX_AMOUNT_QAR to stop a single keystroke mistake (or tamper) from
 * polluting every P&L chart on the dashboard.
 */
export function safeAmount(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const n = Math.abs(parseFloat(String(raw)));
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  if (n > MAX_AMOUNT_QAR) {
    throw new Error(
      `المبلغ أكبر من الحد المسموح (${MAX_AMOUNT_QAR.toLocaleString("en")} ر.ق)`
    );
  }
  return n;
}

/**
 * Clamp a numeric integer input (e.g. billing cycle days, duration minutes).
 * Out-of-range values clamp rather than throw so forms don't reject a user
 * who picks an odd value — but truly wild inputs don't reach Prisma.
 */
export function safeInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw == null || raw === "") return fallback;
  const n = parseInt(String(raw), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
