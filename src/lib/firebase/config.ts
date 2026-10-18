// Firebase *web* configuration. These values identify the Firebase project to
// the browser and are public by design; access to data is enforced by
// Firestore/Storage Security Rules, not by keeping these values secret.
//
// Each variable is referenced literally so Next.js can inline it at build time.
// Values come from .env.local (see .env.example); nothing is hardcoded here.

/**
 * The auth domain is a bare host ("<project>.firebaseapp.com"). Values pasted
 * into a hosting dashboard often carry a scheme, a trailing slash or stray
 * whitespace, which break Google sign-in and the CSP frame rule, so those are
 * removed here.
 */
export function normalizeAuthDomain(value: string | undefined): string | undefined {
  const host = value?.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return host || undefined;
}

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: normalizeAuthDomain(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when the minimum web configuration needed for Authentication is present. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

/**
 * Local development/testing only: connect to the Firebase Emulator Suite
 * instead of the real project. Never enable this in production.
 */
export const useFirebaseEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";
export const firebaseEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
