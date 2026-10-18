// Exchanges a Firebase ID token for an httpOnly session cookie (POST) and
// clears it (DELETE). Server-side route protection reads only this cookie.
import { NextResponse, type NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, isAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isSameOrigin } from "@/lib/auth/origin";
import { getSessionUser } from "@/lib/auth/server";
import { ADMIN_SESSION_SECONDS, adminMfaRequired, CUSTOMER_SESSION_SECONDS, SUPER_ADMIN_CLAIM } from "@/lib/auth/session-policy";
import { ensureProfileFromToken } from "@/lib/account/ensure-profile";
import { securityLog } from "@/lib/security/log";
import { clientIp, countAttempt, isOverLimit, limitResponse } from "@/lib/security/limits";

const RECENT_SIGN_IN_SECONDS = 5 * 60;

// Login-abuse limits (per server instance). Generous per IP because mobile
// carriers put many customers behind one address (carrier-grade NAT).
const TEN_MINUTES = 10 * 60_000;
const IP_ATTEMPTS = 40; // session requests per IP per 10 min
const IP_FAILURES = 10; // invalid / refused tokens per IP per 15 min, then a cool-down
const FAILURE_WINDOW = 15 * 60_000;
const ACCOUNT_SESSIONS = 10; // sessions per account per 10 min

const TOO_MANY = "Too many sign-in attempts. Please wait a few minutes and try again.";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

const isAdminAccount = (t: DecodedIdToken) => t.role === SUPER_ADMIN_CLAIM && t.firebase?.sign_in_provider === "password";

/**
 * Who is signed in, for the public navbar (which is static and can't read the
 * httpOnly cookie). Only the display name and email of the caller's own
 * verified session; never the role, so admin status isn't exposed publicly.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ signedIn: false });
  return json({ signedIn: true, name: user.name, email: user.email });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);
  if (!isAdminConfigured()) return json({ error: "auth_unavailable" }, 503);

  const ip = clientIp(request);
  // An address that keeps sending bad tokens is cooled down before any work.
  if (isOverLimit("session_fail_ip", ip, IP_FAILURES, FAILURE_WINDOW)) {
    securityLog({ event: "rate_limited", route: request.url, status: 429, reason: "session_failures", ip });
    return json({ error: "rate_limited", message: TOO_MANY }, 429);
  }
  const ipLimited = limitResponse(request, "session_ip", ip, IP_ATTEMPTS, TEN_MINUTES, { message: TOO_MANY });
  if (ipLimited) return ipLimited;

  const refuse = (status: number, error: string, reason: string, uid?: string) => {
    countAttempt("session_fail_ip", ip, IP_FAILURES, FAILURE_WINDOW);
    securityLog({ event: "session_refused", route: request.url, status, reason, uid, ip });
    return json({ error }, status);
  };

  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return refuse(400, "bad_request", "bad_request");
  }
  if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > 8192) {
    return refuse(400, "bad_request", "bad_request");
  }

  try {
    const auth = adminAuth();
    let decoded: DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(idToken, true);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "unknown";
      return refuse(401, "invalid_token", code.replace(/^auth\//, "").replace(/[^a-z0-9]+/g, "_"));
    }

    // Per-account limit, only after the token proved who this is (no enumeration).
    const accountLimited = limitResponse(request, "session_uid", decoded.uid, ACCOUNT_SESSIONS, TEN_MINUTES, { uid: decoded.uid, message: TOO_MANY });
    if (accountLimited) return accountLimited;

    // Only mint a session right after a real sign-in, or to refresh an
    // existing valid session for the same user (e.g. after email verification).
    let allowed = Date.now() / 1000 - decoded.auth_time < RECENT_SIGN_IN_SECONDS;
    if (!allowed) {
      const existing = request.cookies.get(SESSION_COOKIE)?.value;
      if (existing) {
        try {
          allowed = (await auth.verifySessionCookie(existing, true)).uid === decoded.uid;
        } catch {
          allowed = false;
        }
      }
    }
    if (!allowed) return refuse(401, "recent_sign_in_required", "stale_sign_in", decoded.uid);

    const admin = isAdminAccount(decoded);
    // Super Admin MFA (when required): no session at all without a second factor.
    if (admin && adminMfaRequired() && !decoded.firebase?.sign_in_second_factor) {
      securityLog({ event: "mfa_required", route: request.url, status: 403, reason: "mfa_required", uid: decoded.uid, ip });
      return json({ error: "mfa_required" }, 403);
    }

    const lifetime = admin ? ADMIN_SESSION_SECONDS : CUSTOMER_SESSION_SECONDS;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: lifetime * 1000 });
    // The customer profile (users/{uid}) is created/updated here with the
    // Admin SDK, from the verified token, so sign-in never depends on the
    // browser writing to Firestore.
    const profileOk = await ensureProfileFromToken(decoded);
    securityLog({ event: "session_created", route: request.url, status: 200, reason: admin ? "admin_sign_in" : "sign_in", uid: decoded.uid, ip });
    const response = json({ ok: true, emailVerified: decoded.email_verified === true, profileOk });
    response.cookies.set(SESSION_COOKIE, sessionCookie, cookieOptions(lifetime));
    return response;
  } catch (error) {
    const code = (error as { code?: string }).code ?? "unknown";
    console.error(`[auth/session] session creation failed: ${code}`);
    securityLog({ event: "server_error", route: request.url, status: 503, reason: "session_creation_failed", ip });
    return json({ error: "auth_unavailable" }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  // Session cookies are stateless, so clearing this browser's copy alone would
  // leave any copied cookie valid until it expires. Revoking the user's refresh
  // tokens invalidates every session cookie for the account (checkRevoked), i.e.
  // sign-out ends the session everywhere.
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (existing && isAdminConfigured()) {
    try {
      const auth = adminAuth();
      const { uid, auth_time } = await auth.verifySessionCookie(existing, false);
      // Firebase records revocation to the whole second, and a session whose
      // sign-in happened in that same second would still count as valid. If
      // this session is that fresh, wait until the next second (at most ~1 s)
      // so the revocation is guaranteed to cover it.
      const waitMs = (auth_time + 1) * 1000 - Date.now();
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 1100)));
      await auth.revokeRefreshTokens(uid);
      securityLog({ event: "session_revoked", route: request.url, status: 200, reason: "sign_out", uid });
    } catch (error) {
      // Already invalid/expired: nothing to revoke. Other failures are logged.
      const code = (error as { code?: string }).code ?? "unknown";
      if (!code.includes("session-cookie")) console.error(`[auth/session] sign-out revocation failed: ${code}`);
    }
  }

  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return response;
}
