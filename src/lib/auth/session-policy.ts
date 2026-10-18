// Session and Super Admin policy — pure logic shared by the session API, the
// server guards and the unit tests. The server decides from the VERIFIED
// session claims only; nothing here trusts the browser.

/** Customer session cookie lifetime: 5 days (Firebase allows 5 minutes – 14 days). */
export const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24 * 5;

/**
 * Super Admin session lifetime: 8 hours, one working day at the venue. An
 * admin session can record payments and change prices, so a stolen or
 * forgotten admin cookie must stop working the same day; customers keep the
 * longer 5-day session because their sessions can only see their own data.
 * Enforced twice: the cookie is minted with this lifetime, and every request
 * checks the sign-in time (auth_time), so refreshing the cookie never extends it.
 */
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

/** Sensitive admin actions (money, prices / policies, cancellations) need a sign-in within 15 minutes. */
export const ADMIN_REAUTH_SECONDS = 15 * 60;

/** Account deletion needs a sign-in (re-authentication) within 5 minutes. */
export const DELETE_ACCOUNT_REAUTH_SECONDS = 5 * 60;

export const SUPER_ADMIN_CLAIM = "super_admin";

/**
 * Super Admin multi-factor authentication. Off unless the server environment
 * sets SABOR_ADMIN_MFA_REQUIRED=true, because it needs Firebase
 * Identity Platform with TOTP enabled on the real project (console step,
 * see the security report). When on, an admin session without a second
 * factor gets no admin access at all.
 */
export function adminMfaRequired(env: Record<string, string | undefined> = process.env): boolean {
  return env.SABOR_ADMIN_MFA_REQUIRED === "true";
}

export interface SessionClaims {
  role: unknown;
  signInProvider: string | null;
  emailVerified: boolean;
  /** Seconds since epoch of the last real sign-in (password / Google / MFA). */
  authTime: number;
  /** firebase.sign_in_second_factor ("totp", "phone"), when the sign-in used MFA. */
  secondFactor: string | null;
}

/** Why an account holding the admin claim is not given admin access right now. */
export type AdminBlock = "unverified" | "mfa_required" | "session_expired";

/**
 * null: not an admin account at all (customer). Otherwise "ok" or the block.
 * Admin credentials are email + password accounts; a Google sign-in is
 * always a customer session, even for an account that holds the claim.
 */
export function adminAccess(claims: SessionClaims, nowSeconds: number, mfaRequired: boolean): "ok" | AdminBlock | null {
  if (claims.role !== SUPER_ADMIN_CLAIM || claims.signInProvider !== "password") return null;
  if (!claims.emailVerified) return "unverified";
  if (mfaRequired && !claims.secondFactor) return "mfa_required";
  if (!(nowSeconds - claims.authTime < ADMIN_SESSION_SECONDS)) return "session_expired";
  return "ok";
}

/** True when the last real sign-in is recent enough for a sensitive action. */
export function isRecentSignIn(authTime: number, nowSeconds: number, maxAgeSeconds = ADMIN_REAUTH_SECONDS): boolean {
  return nowSeconds - authTime >= -60 && nowSeconds - authTime < maxAgeSeconds;
}
