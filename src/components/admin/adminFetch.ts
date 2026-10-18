// Admin API calls with the "confirm your password" step: sensitive actions
// (payments, prices / policies, quotations, cancellations) answer
// 401 reauth_required when the admin's last sign-in is older than 15 minutes.
// The admin then signs in again in a dialog (AdminReauth), which refreshes
// the session cookie, and the same request is sent once more.

type Opener = () => Promise<boolean>;
let opener: Opener | null = null;

/** Called by <AdminReauth> while it is mounted. */
export function registerReauth(open: Opener | null) {
  opener = open;
}

export async function adminFetch(url: string, init: RequestInit): Promise<Response> {
  const first = await fetch(url, init);
  if (first.status !== 401 || !opener) return first;
  const data = (await first.clone().json().catch(() => ({}))) as { error?: string };
  if (data.error !== "reauth_required") return first;
  const confirmed = await opener();
  return confirmed ? fetch(url, init) : first;
}
