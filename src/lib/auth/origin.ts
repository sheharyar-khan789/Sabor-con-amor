import { securityLog } from "@/lib/security/log";

/** CSRF protection for state-changing routes: only accept requests whose
 *  Origin header is this site. Refusals are written to the security log. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let same = false;
  if (origin && host) {
    try {
      same = new URL(origin).host === host;
    } catch {
      same = false;
    }
  }
  if (!same) securityLog({ event: "csrf_refused", route: request.url, status: 403, reason: origin ? "cross_origin" : "missing_origin" });
  return same;
}
