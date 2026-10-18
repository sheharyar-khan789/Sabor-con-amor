// Rate-limit helpers for API routes, on top of the existing in-process
// limiter (src/lib/booking/rate-limit.ts). Per server instance only: on a
// host with several instances each one counts separately, so these limits
// stop floods from one client but are not a global quota. The hosting WAF /
// edge rate rules are the distributed layer (see the security report).
import { NextResponse } from "next/server";
import { isRateLimited, rateLimit } from "@/lib/booking/rate-limit";
import { securityLog } from "./log";

/**
 * The client's IP for rate-limit keys. Vercel (the current host) sets
 * x-real-ip / x-forwarded-for itself, so clients cannot spoof them there. On
 * another host, confirm its proxy overwrites these headers; per-account limits
 * apply regardless.
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (real || forwarded || "unknown").slice(0, 64);
}

/**
 * Counts one request against `key`. Returns null when allowed, or the 429
 * response to send (logged as rate_limited with `name` as the reason).
 */
export function limitResponse(
  request: Request,
  name: string,
  key: string,
  max: number,
  windowMs: number,
  options: { uid?: string | null; message?: string } = {}
): Response | null {
  const result = rateLimit(`${name}:${key}`, max, windowMs);
  if (result.ok) return null;
  securityLog({ event: "rate_limited", route: request.url, status: 429, reason: name, uid: options.uid });
  return NextResponse.json(
    {
      error: "rate_limited",
      message: options.message ?? "Too many attempts. Please wait a few minutes and try again.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(result.retryAfterSeconds) } }
  );
}

/** Counts without answering (e.g. failed sign-in attempts); true while still under the limit. */
export function countAttempt(name: string, key: string, max: number, windowMs: number): boolean {
  return rateLimit(`${name}:${key}`, max, windowMs).ok;
}

/** True when `key` has already used up its budget (does not count a new attempt). */
export function isOverLimit(name: string, key: string, max: number, windowMs: number): boolean {
  return isRateLimited(`${name}:${key}`, max, windowMs);
}
