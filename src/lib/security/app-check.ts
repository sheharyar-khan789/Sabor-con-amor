// Firebase App Check — server side. Enforced only when BOTH are set:
//   SABOR_APPCHECK_ENFORCE=true            (server environment)
//   NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=...   (the real reCAPTCHA Enterprise key)
// Otherwise every request passes, so the site works before keys exist.
import "server-only";
import { getAppCheck } from "firebase-admin/app-check";
import { adminApp } from "@/lib/firebase/admin";
import { securityLog } from "./log";

export function appCheckEnforced(): boolean {
  return process.env.SABOR_APPCHECK_ENFORCE === "true" && Boolean(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY);
}

/** null when the request may continue, otherwise the 401 response to send. */
export async function appCheckFailure(request: Request, uid?: string): Promise<Response | null> {
  if (!appCheckEnforced()) return null;
  const token = request.headers.get("x-firebase-appcheck");
  if (token && token.length < 4096) {
    try {
      await getAppCheck(adminApp()).verifyToken(token);
      return null;
    } catch {
      // fall through: invalid or expired token
    }
  }
  securityLog({ event: "auth_refused", route: request.url, status: 401, reason: token ? "app_check_invalid" : "app_check_missing", uid });
  return Response.json(
    { error: "app_check_failed", message: "We couldn't verify this browser. Please reload the page and try again." },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
