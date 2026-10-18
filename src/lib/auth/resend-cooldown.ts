// Per-account cooldown for verification emails (browser only).
//
// Firebase accepts about one verification email per minute per account and
// answers anything sooner with auth/too-many-requests, which then blocks the
// account's sends for a while. The cooldown is stored with an end time in
// localStorage so it survives reloads and covers the email sent at sign-up;
// an in-memory copy is used when storage is blocked.

/** Wait after a verification email was sent (sign-up or resend). */
export const VERIFICATION_COOLDOWN_SECONDS = 60;
/** Wait after Firebase refused a send with auth/too-many-requests. */
export const VERIFICATION_RATE_LIMITED_SECONDS = 5 * 60;

const memory = new Map<string, number>();
const storageKey = (uid: string) => `sabor-verification-cooldown:${uid}`;

export function startVerificationCooldown(uid: string, seconds: number): void {
  const until = Date.now() + seconds * 1000;
  memory.set(uid, until);
  try {
    window.localStorage.setItem(storageKey(uid), String(until));
  } catch {
    /* storage unavailable: the in-memory copy still applies */
  }
}

/** Whole seconds left before another verification email may be requested. */
export function verificationCooldownLeft(uid: string): number {
  let until = memory.get(uid) ?? 0;
  try {
    until = Math.max(until, Number(window.localStorage.getItem(storageKey(uid))) || 0);
  } catch {
    /* storage unavailable */
  }
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

/** "45 seconds", "1 minute", "4 minutes 30 seconds". */
export function formatWait(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (m === 0) return part(s, "second");
  return s === 0 ? part(m, "minute") : `${part(m, "minute")} ${part(s, "second")}`;
}

/** Countdown for a button label: "0:45", "4:30". */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
