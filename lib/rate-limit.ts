// In-memory token-bucket rate limiter.
//
// Keyed by an arbitrary string (we use IP for unauth, userId for authed). Stores
// per-key bucket state on globalThis so HMR doesn't reset counters during dev.
// Cheap, fixed-window — enough to slow down brute-force / scraping; not a
// substitute for a real WAF on a public endpoint.

const STORE_KEY = "__srb_rate_limit_buckets__" as const;

interface Bucket {
  count: number;
  // Wall-clock ms when the current window opened.
  windowStartedAt: number;
}

type Store = Map<string, Bucket>;

function getStore(): Store {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, Bucket>();
  return g[STORE_KEY] as Store;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

// `windowMs` is the window length; `max` is the cap inside that window.
export function rateLimit(
  key: string,
  options: { windowMs: number; max: number }
): RateLimitResult {
  const store = getStore();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now - existing.windowStartedAt >= options.windowMs) {
    store.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, remaining: options.max - 1, retryAfterMs: 0 };
  }

  if (existing.count >= options.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: options.windowMs - (now - existing.windowStartedAt),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: options.max - existing.count,
    retryAfterMs: 0,
  };
}
