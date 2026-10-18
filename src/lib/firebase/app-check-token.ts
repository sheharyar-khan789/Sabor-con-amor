// Loaded only when App Check is configured (see app-check-client.ts).
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { getFirebase } from "./client";
import { appCheckSiteKey } from "./app-check-client";
import { useFirebaseEmulators } from "./config";

const g = globalThis as typeof globalThis & { __saborConAmorAppCheck?: AppCheck };

/** Initialises App Check once; Firebase Auth then sends App Check tokens too (sign-up, sign-in). */
export function ensureAppCheck(): AppCheck | null {
  if (!appCheckSiteKey || useFirebaseEmulators) return null;
  g.__saborConAmorAppCheck ??= initializeAppCheck(getFirebase().app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return g.__saborConAmorAppCheck;
}

export async function appCheckToken(): Promise<string | null> {
  const appCheck = ensureAppCheck();
  if (!appCheck) return null;
  return (await getToken(appCheck, false)).token;
}
