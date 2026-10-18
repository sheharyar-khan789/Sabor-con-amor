// Firebase App Check (reCAPTCHA Enterprise) — browser side. OFF unless
// NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is set (a real reCAPTCHA Enterprise
// key registered for this site in the Firebase console). When it is off,
// nothing is loaded: the App Check SDK is only imported on demand.

export const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY || "";

/** Headers proving the request comes from this site's real pages (empty when App Check is off). */
export async function appCheckHeaders(): Promise<Record<string, string>> {
  if (!appCheckSiteKey) return {};
  try {
    const { appCheckToken } = await import("./app-check-token");
    const token = await appCheckToken();
    return token ? { "X-Firebase-AppCheck": token } : {};
  } catch {
    return {}; // the server decides; with enforcement on it refuses the request
  }
}
