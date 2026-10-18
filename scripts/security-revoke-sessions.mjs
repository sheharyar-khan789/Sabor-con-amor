#!/usr/bin/env node
// INCIDENT RESPONSE: ends Firebase sessions and (optionally) disables accounts
// with the Admin SDK. See SECURITY_INCIDENT_RESPONSE.md.
//
//   node --env-file=.env.local scripts/security-revoke-sessions.mjs <email>             # sign one account out everywhere
//   node --env-file=.env.local scripts/security-revoke-sessions.mjs <email> --disable   # ...and block it from signing in
//   node --env-file=.env.local scripts/security-revoke-sessions.mjs <email> --enable    # re-enable after the incident
//   node --env-file=.env.local scripts/security-revoke-sessions.mjs --all --confirm     # sign EVERY account out
//
// Revoking refresh tokens invalidates every session cookie of the account at
// once: the app verifies cookies with checkRevoked=true on every request.
// Prints uids and counts only (no emails of other users).
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const all = args.includes("--all");
const confirm = args.includes("--confirm");
const disable = args.includes("--disable");
const enable = args.includes("--enable");
const email = args.find((a) => !a.startsWith("--"));

if ((!all && !email?.includes("@")) || (all && (!confirm || email || disable || enable)) || (disable && enable)) {
  console.error(
    "Usage:\n  scripts/security-revoke-sessions.mjs <email> [--disable | --enable]\n  scripts/security-revoke-sessions.mjs --all --confirm"
  );
  process.exit(1);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
let options;
if (projectId && clientEmail && privateKey) options = { credential: cert({ projectId, clientEmail, privateKey }), projectId };
else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) options = { credential: applicationDefault(), projectId };
else if (process.env.FIREBASE_AUTH_EMULATOR_HOST && projectId) options = { projectId };
else {
  console.error("Missing Firebase Admin credentials (FIREBASE_ADMIN_* or GOOGLE_APPLICATION_CREDENTIALS).");
  process.exit(1);
}
const auth = getAuth(initializeApp(options));

try {
  if (all) {
    let count = 0;
    let pageToken;
    do {
      const page = await auth.listUsers(1000, pageToken);
      for (const user of page.users) {
        await auth.revokeRefreshTokens(user.uid);
        count++;
      }
      pageToken = page.pageToken;
    } while (pageToken);
    console.log(`Revoked the sessions of ${count} account(s) in project ${projectId}. Everyone must sign in again.`);
  } else {
    const user = await auth.getUserByEmail(email);
    if (disable) await auth.updateUser(user.uid, { disabled: true });
    if (enable) await auth.updateUser(user.uid, { disabled: false });
    await auth.revokeRefreshTokens(user.uid);
    console.log(
      `uid ${user.uid}: sessions revoked${disable ? ", account DISABLED" : enable ? ", account re-enabled" : ""}.`
    );
  }
} catch (error) {
  console.error(`Failed: ${error.code ?? error.message}`);
  process.exit(1);
}
