// Structured security log: one JSON line per event on stdout, for the
// hosting's log search and alerting (see the reference project's security report; not copied).
//
// Never logged: passwords, tokens, cookies, emails, phone numbers, names,
// request bodies, keys. A user is identified only by a salted hash of their
// uid; the route is the URL path without the query string; the reason is a
// fixed code. Pure module (no "server-only") so the unit tests can check it.
import { createHash } from "node:crypto";

export type SecurityEvent =
  | "session_created"
  | "session_refused"
  | "session_revoked"
  | "auth_refused"
  | "admin_denied"
  | "csrf_refused"
  | "rate_limited"
  | "mfa_required"
  | "reauth_required"
  | "admin_action"
  | "account_deleted"
  | "server_error";

export interface SecurityLogEntry {
  event: SecurityEvent;
  /** URL path (query strings are dropped). */
  route: string;
  status: number;
  /** Short machine code, e.g. "invalid_token". */
  reason: string;
  /** Firebase uid; only its salted hash is written. */
  uid?: string | null;
  /** Client IP; only its salted hash is written (lets alerts spot an admin sign-in from a new network). */
  ip?: string | null;
  /** Admin audit record ID for financial / sensitive admin actions. */
  auditId?: string | null;
}

/** Salted, truncated SHA-256 of a uid (or IP): enough to correlate events, useless to identify someone. */
export function hashId(value: string): string {
  const salt = process.env.SECURITY_LOG_SALT || "sabor-con-amor-security-log";
  return createHash("sha256").update(`${salt}\n${value}`).digest("hex").slice(0, 16);
}

const REASON = /^[a-z0-9_]{1,48}$/;

/** Only the path, never the query (which could carry emails, codes or tokens). */
export function routeOf(input: string | URL | Request): string {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(raw, "http://localhost").pathname;
    return path.slice(0, 200);
  } catch {
    return "unknown";
  }
}

export function formatSecurityLog(entry: SecurityLogEntry, now = new Date()): string {
  return JSON.stringify({
    ts: now.toISOString(),
    type: "security",
    event: entry.event,
    route: routeOf(entry.route),
    status: entry.status,
    reason: REASON.test(entry.reason) ? entry.reason : "other",
    user: entry.uid ? hashId(entry.uid) : null,
    ...(entry.ip ? { client: hashId(`ip:${entry.ip}`) } : {}),
    ...(entry.auditId && /^[A-Za-z0-9_-]{1,80}$/.test(entry.auditId) ? { auditId: entry.auditId } : {}),
  });
}

export function securityLog(entry: SecurityLogEntry): void {
  const line = formatSecurityLog(entry);
  if (entry.status >= 500) console.error(line);
  else console.log(line);
}
