// Content-Security-Policy for HTML pages (set per request by src/proxy.ts).
//
// Scripts: only Next.js / React scripts carrying this request's nonce, and
// scripts those load ('strict-dynamic', e.g. Firebase Auth's Google sign-in
// helper). No inline event handlers, no eval in production, no other origin.
// Everything else is limited to what the site really uses:
//   images / video / fonts  this site only (self-hosted, next/font)
//   connect                 this site + Firebase Auth (+ App Check when enabled)
//   frames                  the Firebase Auth helper frame on the auth domain
//                           (+ reCAPTCHA when App Check is enabled)
// style-src keeps 'unsafe-inline': React style attributes (animation delays,
// rating bars) need it; injected CSS cannot run script.
// Pure module: the unit tests build and check the policy.

export interface CspOptions {
  nonce: string;
  /** NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, e.g. "example.firebaseapp.com". */
  authDomain?: string;
  /** Local Firebase emulators (tests / development only). */
  emulatorHost?: string | null;
  /** App Check with reCAPTCHA Enterprise is configured. */
  appCheck?: boolean;
  /** `next dev` needs eval (React debugging) and the HMR websocket. */
  development?: boolean;
}

const HOST = /^[a-z0-9.-]+(:\d+)?$/i;

export function contentSecurityPolicy(o: CspOptions): string {
  const authDomain = o.authDomain && HOST.test(o.authDomain) ? `https://${o.authDomain}` : null;
  const emulator = o.emulatorHost && HOST.test(o.emulatorHost) ? o.emulatorHost : null;
  const firebaseApis = ["https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://www.googleapis.com"];
  const recaptcha = ["https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/", "https://recaptcha.google.com/recaptcha/"];

  const connect = ["'self'", ...firebaseApis];
  const frames = ["'self'"];
  if (authDomain) frames.push(authDomain);
  if (o.appCheck) {
    connect.push("https://content-firebaseappcheck.googleapis.com", "https://www.google.com/recaptcha/");
    frames.push(...recaptcha);
  }
  if (emulator) {
    connect.push(`http://${emulator}:9099`, `http://${emulator}:8080`);
    frames.push(`http://${emulator}:9099`);
  }
  if (o.development) connect.push("ws:", "wss:");

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${o.nonce}' 'strict-dynamic'${o.development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self'",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    `frame-src ${frames.join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];
  return directives.join("; ");
}

/** A fresh, unguessable nonce for one response (128 bits, base64). */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
