// Customer account deletion: DELETE /api/account  body: { confirm: "DELETE", idToken }
//
// same-origin -> verified session -> rate limit -> fresh re-authentication
// (an ID token for the SAME account, signed in within 5 minutes) -> refuse
// admin accounts -> data deletion / anonymisation (src/lib/account/deletion.ts)
// -> delete the Firebase Auth user (which ends every session) -> clear cookie.
import { NextResponse, type NextRequest } from "next/server";
import { deleteCustomerData } from "@/lib/account/deletion";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isSameOrigin } from "@/lib/auth/origin";
import { getSessionUser } from "@/lib/auth/server";
import { DELETE_ACCOUNT_REAUTH_SECONDS, isRecentSignIn, SUPER_ADMIN_CLAIM } from "@/lib/auth/session-policy";
import { businessToday } from "@/lib/booking/dates";
import { bookingStore, logBookingError, profileStore, withTimeout } from "@/lib/booking/server";
import { adminAuth } from "@/lib/firebase/admin";
import { securityLog } from "@/lib/security/log";
import { limitResponse } from "@/lib/security/limits";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const ALLOWED = new Set(["confirm", "idToken"]);

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);
  const user = await getSessionUser();
  if (!user) return json({ error: "unauthenticated" }, 401);
  const limited = limitResponse(request, "account_delete", user.uid, 5, 10 * 60_000, { uid: user.uid });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 10 * 1024) return json({ error: "invalid_request" }, 413);
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (Object.keys(body).some((k) => !ALLOWED.has(k)) || body.confirm !== "DELETE") {
    return json({ error: "invalid_request", message: "Type DELETE to confirm." }, 400);
  }
  if (typeof body.idToken !== "string" || body.idToken.length === 0 || body.idToken.length > 8192) {
    return json({ error: "reauth_required", message: "Please confirm it's you before deleting your account." }, 401);
  }

  const store = bookingStore();
  const profiles = profileStore();
  if (!store || !profiles) return json({ error: "unavailable" }, 503);

  const auth = adminAuth();
  try {
    const fresh = await auth.verifyIdToken(body.idToken, true);
    if (fresh.uid !== user.uid || !isRecentSignIn(fresh.auth_time, Math.floor(Date.now() / 1000), DELETE_ACCOUNT_REAUTH_SECONDS)) {
      securityLog({ event: "reauth_required", route: request.url, status: 401, reason: "account_delete", uid: user.uid });
      return json({ error: "reauth_required", message: "Please confirm it's you before deleting your account." }, 401);
    }
  } catch {
    securityLog({ event: "reauth_required", route: request.url, status: 401, reason: "invalid_token", uid: user.uid });
    return json({ error: "reauth_required", message: "Please confirm it's you before deleting your account." }, 401);
  }

  try {
    // The venue's admin account is never deleted from the customer portal
    // (checked on the stored claims, whatever the current sign-in method).
    const record = await withTimeout(auth.getUser(user.uid), 10_000);
    if (record.customClaims?.role === SUPER_ADMIN_CLAIM) {
      securityLog({ event: "admin_denied", route: request.url, status: 403, reason: "admin_account_delete", uid: user.uid });
      return json({ error: "admin_account", message: "This account can't be deleted here." }, 403);
    }

    const now = new Date();
    const result = await withTimeout(deleteCustomerData(store, profiles, user.uid, { today: businessToday(now), now }), 60_000);
    if (!result.ok) {
      return json(
        {
          error: "active_bookings",
          message:
            "You have a pending or upcoming booking. Please contact the venue to cancel or complete it before deleting your account.",
        },
        409
      );
    }
    // Deleting the user invalidates every session cookie and refresh token.
    await withTimeout(auth.deleteUser(user.uid), 10_000);
    securityLog({ event: "account_deleted", route: request.url, status: 200, reason: "customer_request", uid: user.uid });
    const response = json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if ((error as { code?: string }).code === "active_bookings") {
      return json({ error: "active_bookings", message: "You have a pending or upcoming booking. Please contact the venue first." }, 409);
    }
    logBookingError("account deletion", error);
    securityLog({ event: "server_error", route: request.url, status: 503, reason: "account_delete_failed", uid: user.uid });
    return json({ error: "unavailable", message: "Your account couldn't be fully deleted right now. Please try again; repeating it is safe." }, 503);
  }
}
