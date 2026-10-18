// Server-side authentication & authorisation helpers — SERVER ONLY.
// The browser never decides who is signed in or who is an admin: every check
// here verifies the httpOnly session cookie with the Firebase Admin SDK.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, isAdminConfigured } from "@/lib/firebase/admin";
import { securityLog } from "@/lib/security/log";
import { SESSION_COOKIE } from "./constants";
import { isSameOrigin } from "./origin";
import { adminAccess, adminMfaRequired, isRecentSignIn, type AdminBlock } from "./session-policy";

export type UserRole = "customer" | "super_admin";

export interface SessionUser {
  uid: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
  /**
   * "super_admin" only when the account holds the server-set claim AND the
   * session meets every admin condition (verified email, password sign-in,
   * MFA when required, admin session age). Otherwise "customer".
   */
  role: UserRole;
  /** Why an account holding the admin claim has no admin access right now. */
  adminBlock: AdminBlock | null;
  /** Seconds since epoch of the last real sign-in. */
  authTime: number;
  secondFactor: string | null;
}

export function toSessionUser(token: DecodedIdToken, nowSeconds = Math.floor(Date.now() / 1000)): SessionUser {
  const signInProvider = token.firebase?.sign_in_provider ?? null;
  const emailVerified = token.email_verified === true;
  const secondFactor = typeof token.firebase?.sign_in_second_factor === "string" ? token.firebase.sign_in_second_factor : null;
  const access = adminAccess(
    { role: token.role, signInProvider, emailVerified, authTime: token.auth_time, secondFactor },
    nowSeconds,
    adminMfaRequired()
  );
  return {
    uid: token.uid,
    email: token.email ?? null,
    name: typeof token.name === "string" ? token.name : null,
    emailVerified,
    signInProvider,
    role: access === "ok" ? "super_admin" : "customer",
    adminBlock: access === "ok" || access === null ? null : access,
    authTime: token.auth_time,
    secondFactor,
  };
}

/** Verifies a session cookie (signature, expiry and revocation). */
export async function verifySessionCookie(value: string | undefined): Promise<SessionUser | null> {
  if (!value || !isAdminConfigured()) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    return toSessionUser(decoded);
  } catch {
    return null; // expired, revoked, malformed, deleted user or another project
  }
}

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return verifySessionCookie(store.get(SESSION_COOKIE)?.value);
});

/** Guard for customer routes (/account/*). Redirects to sign-in when needed. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/**
 * True only for a Super Admin session: the server-set custom claim, a verified
 * email, an email+password sign-in, a second factor when MFA is required, and
 * a sign-in within the admin session lifetime. Admin credentials are created
 * in Firebase; a Google (customer) sign-in never grants admin access.
 */
export function isSuperAdminSession(user: SessionUser): boolean {
  return user.role === "super_admin";
}

/**
 * Guard for admin routes (/admin/*). Signed-out visitors go to the separate
 * admin sign-in; an admin account that needs MFA or whose admin session has
 * expired is sent back to sign in; everyone else gets a 404 so the admin
 * area's existence is not revealed.
 */
export async function requireSuperAdmin(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/admin/login?next=${encodeURIComponent(returnTo)}`);
  if (user.adminBlock === "mfa_required" || user.adminBlock === "session_expired") {
    securityLog({ event: user.adminBlock === "mfa_required" ? "mfa_required" : "admin_denied", route: returnTo, status: 307, reason: user.adminBlock, uid: user.uid });
    redirect(`/admin/login?reason=${user.adminBlock === "mfa_required" ? "mfa" : "expired"}&next=${encodeURIComponent(returnTo)}`);
  }
  if (!isSuperAdminSession(user)) {
    securityLog({ event: "admin_denied", route: returnTo, status: 404, reason: user.adminBlock ?? "not_admin", uid: user.uid });
    notFound();
  }
  return user;
}

export type AdminApiAuth =
  | { ok: true; admin: { uid: string; email: string | null }; recentSignIn: boolean }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Guard for admin API routes. Same-origin (CSRF) + verified session +
 * server-set super_admin claim + verified email + (MFA when required) + admin
 * session age. Returns the admin identity and whether the last sign-in is
 * recent enough for sensitive actions, or the JSON error to send:
 * 403 cross-site, 401 no/expired session, 403 not a Super Admin / MFA missing.
 * The browser's own idea of its role is never consulted.
 */
export async function requireSuperAdminApi(request: Request): Promise<AdminApiAuth> {
  if (!isSameOrigin(request)) return { ok: false, status: 403, error: "forbidden" };
  const user = await getSessionUser();
  if (!user) {
    securityLog({ event: "admin_denied", route: request.url, status: 401, reason: "no_session" });
    return { ok: false, status: 401, error: "unauthenticated" };
  }
  if (user.adminBlock === "mfa_required") {
    securityLog({ event: "mfa_required", route: request.url, status: 403, reason: "mfa_required", uid: user.uid });
    return { ok: false, status: 403, error: "mfa_required" };
  }
  if (user.adminBlock === "session_expired") {
    securityLog({ event: "admin_denied", route: request.url, status: 401, reason: "session_expired", uid: user.uid });
    return { ok: false, status: 401, error: "session_expired" };
  }
  if (!isSuperAdminSession(user)) {
    securityLog({ event: "admin_denied", route: request.url, status: 403, reason: user.adminBlock ?? "not_admin", uid: user.uid });
    return { ok: false, status: 403, error: "forbidden" };
  }
  return {
    ok: true,
    admin: { uid: user.uid, email: user.email },
    recentSignIn: isRecentSignIn(user.authTime, Math.floor(Date.now() / 1000)),
  };
}
