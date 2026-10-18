// Shared, non-secret auth constants (safe to import from proxy, server and client code).
import { CUSTOMER_SESSION_SECONDS, SUPER_ADMIN_CLAIM } from "./session-policy.ts";

/**
 * httpOnly session cookie set by /api/auth/session.
 *
 * Production uses the "__Host-" prefix: browsers then accept the cookie only
 * with Secure, Path=/ and no Domain attribute, so it can never be set or
 * overwritten by a subdomain or over plain HTTP (cookie tossing). The site is
 * hosted on Vercel, which forwards every cookie; the "__session" name was only
 * required by Firebase Hosting, which this project does not use. Local
 * development (`next dev`, plain http) keeps "__session" because "__Host-"
 * cookies must be Secure. Changing the name signs everyone out once.
 */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-sp_session" : "__session";

/** Customer session length: 5 days. Admin sessions are shorter (session-policy.ts). */
export const SESSION_MAX_AGE_SECONDS = CUSTOMER_SESSION_SECONDS;

/** Custom-claim value that marks the venue's Super Admin. Only ever set
 *  server-side by scripts/set-super-admin.mjs; never read from client input. */
export const SUPER_ADMIN_ROLE = SUPER_ADMIN_CLAIM;

/** Where signed-in customers land by default. */
export const DEFAULT_SIGNED_IN_PATH = "/account";

const PROBE_ORIGIN = "https://same-site.invalid";

/**
 * Only allow same-site relative redirects (prevents open redirects via ?next=).
 * Control characters, spaces and backslashes are refused outright: URL parsers
 * strip or reinterpret them, so "/\t/evil.example" would otherwise become the
 * protocol-relative "//evil.example". The value is then resolved against a
 * dummy origin and must stay on it; the normalised path is returned.
 */
export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_SIGNED_IN_PATH): string {
  if (!next || typeof next !== "string" || next.length > 2048) return fallback;
  // C0 control characters, space, DEL and backslash.
  if (/[\x00-\x20\x7f\\]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE_ORIGIN) return fallback;
  // Defence in depth: the path must stay harmless after percent-decoding too
  // ("/%2F%2Fevil.example", "/%09/evil.example"), in case anything decodes it.
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return fallback;
  }
  if (decoded.startsWith("//") || /[\x00-\x20\x7f\\]/.test(decoded)) return fallback;
  const path = url.pathname + url.search + url.hash;
  if (path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/api/")) return fallback;
  return path;
}
