// Small in-process rate limiter for communication endpoints (Phase 9).
// Sliding window per key (e.g. "wa:<adminUid>"). Kept on globalThis because
// Next.js bundles route handlers separately. Per server instance only: it
// stops accidental floods and scripted spam from one session; it is not a
// distributed quota (no extra infrastructure exists for that).
const g = globalThis as typeof globalThis & { __saborConAmorRate?: Map<string, number[]> };

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
  g.__saborConAmorRate ??= new Map();
  const map = g.__saborConAmorRate;
  const recent = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    map.set(key, recent);
    return { ok: false, retryAfterSeconds: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  map.set(key, recent);
  if (map.size > 5000) for (const [k, v] of map) if (!v.some((t) => now - t < windowMs)) map.delete(k);
  return { ok: true };
}

/** True when `key` has already used its budget in the window (counts nothing). */
export function isRateLimited(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (g.__saborConAmorRate?.get(key) ?? []).filter((t) => now - t < windowMs);
  return recent.length >= max;
}
