// Next.js 16 "proxy" (formerly middleware). Two jobs, neither of them the
// security boundary for data:
//  1. A nonce-based Content-Security-Policy for every HTML page (a fresh nonce
//     per request; Next.js puts it on its own scripts).
//  2. Optimistic route protection: visitors without a session cookie are sent
//     to sign in before a protected page renders. Every protected layout/route
//     still verifies the cookie server-side with the Firebase Admin SDK
//     (src/lib/auth/server.ts).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { contentSecurityPolicy, newNonce } from "@/lib/security/csp";

/** Header telling the customer-area layout which page to return to after sign-in. */
export const RETURN_TO_HEADER = "x-sp-return-to";

/** The separate admin sign-in page (email + password only). */
export const ADMIN_LOGIN_PATH = "/admin/login";

function policy(nonce: string): string {
  return contentSecurityPolicy({
    nonce,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    emulatorHost:
      process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true" ? process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1" : null,
    appCheck: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY),
    development: process.env.NODE_ENV === "development",
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = newNonce();
  const csp = policy(nonce);

  // Request headers the page renders with. Client-sent copies are replaced.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  headers.delete(RETURN_TO_HEADER);

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isProtected = (isAdminArea && pathname !== ADMIN_LOGIN_PATH) || pathname === "/account" || pathname.startsWith("/account/");
  if (isProtected) {
    if (!request.cookies.has(SESSION_COOKIE)) {
      // Admin and customer sign-in are separate flows.
      const login = new URL(isAdminArea ? ADMIN_LOGIN_PATH : "/login", request.url);
      login.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
    headers.set(RETURN_TO_HEADER, pathname + request.nextUrl.search);
  }

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Every page, but not API routes, build assets, or the public images,
    // videos, menu files, favicon, robots.txt and sitemap.xml.
    "/((?!api/|_next/static|_next/image|images/|videos/|menu/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
