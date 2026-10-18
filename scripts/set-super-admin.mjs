#!/usr/bin/env node
// Manages Super Admin accounts with the Admin SDK. This is the only way the
// admin role can be assigned: it is never read from client input or Firestore
// documents, and the admin area has no sign-up. The venue owner chooses the
// admin email and password here.
//
// Run locally by the venue owner/developer, with server credentials in .env.local:
//   node --env-file=.env.local scripts/set-super-admin.mjs <email> --create          # new admin: asks for a password
//   node --env-file=.env.local scripts/set-super-admin.mjs <email>                   # make an existing account admin
//   node --env-file=.env.local scripts/set-super-admin.mjs <email> --reset-password  # set a new admin password
//   node --env-file=.env.local scripts/set-super-admin.mjs <email> --revoke          # remove admin access
//   node --env-file=.env.local scripts/set-super-admin.mjs --list                    # show current admins
//
// --create makes an email/password account that counts as verified (the owner
// vouches for it), so it can sign in at /admin/login straight away. Use a real
// mailbox: "Forgot password?" emails go to it. A granted account must already
// have a verified email. Every change revokes the account's existing sessions,
// so it must sign in again.
import { createInterface } from "node:readline";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const ROLE = "super_admin";
const MIN_PASSWORD = 12;
const FLAGS = ["--create", "--reset-password", "--revoke"];
const USAGE = "Usage: node --env-file=.env.local scripts/set-super-admin.mjs <email> [--create | --reset-password | --revoke]\n       node --env-file=.env.local scripts/set-super-admin.mjs --list";

const [first, flag] = process.argv.slice(2);
const list = first === "--list";
const email = list ? null : first?.trim().toLowerCase();
if (!list && (!email || !email.includes("@") || (flag && !FLAGS.includes(flag)))) {
  console.error(USAGE);
  process.exit(1);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
// Same parsing as src/lib/firebase/admin.ts (surrounding quotes, literal \n).
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim()
  .replace(/^"([\s\S]*)"$/, "$1")
  .replace(/\\r/g, "")
  .replace(/\\n/g, "\n");

let options;
if (projectId && clientEmail && privateKey) options = { credential: cert({ projectId, clientEmail, privateKey }), projectId };
else if (process.env.FIREBASE_AUTH_EMULATOR_HOST && projectId) options = { projectId };
else {
  console.error("Missing Firebase Admin credentials (FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY).");
  process.exit(1);
}

const auth = getAuth(initializeApp(options));

/** Reads lines from one shared prompt; typed characters are hidden in a terminal. */
let prompt;
function ask(question) {
  if (!prompt) {
    const tty = Boolean(process.stdin.isTTY);
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
    if (tty) rl._writeToOutput = (s) => rl.output.write(s === "\r\n" || s === "\n" || s.startsWith("New admin") || s.startsWith("Type the") ? s : "");
    const lines = [];
    const waiting = [];
    rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
    rl.on("close", () => waiting.splice(0).forEach((resolve) => resolve("")));
    prompt = { rl, lines, waiting };
  }
  prompt.rl.output.write(question);
  return new Promise((resolve) => (prompt.lines.length ? resolve(prompt.lines.shift()) : prompt.waiting.push(resolve)));
}

async function askPassword() {
  const password = await ask(`New admin password (at least ${MIN_PASSWORD} characters): `);
  if (password.length < MIN_PASSWORD) throw new Error(`The password must be at least ${MIN_PASSWORD} characters.`);
  if (password.toLowerCase().includes(email.split("@")[0])) throw new Error("The password must not contain the email name.");
  if ((await ask("Type the password again: ")) !== password) throw new Error("The two passwords don't match.");
  return password;
}

async function grant(user) {
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: ROLE });
  await auth.revokeRefreshTokens(user.uid); // force re-sign-in so sessions pick up the change
}

try {
  if (list) {
    const admins = [];
    let pageToken;
    do {
      const page = await auth.listUsers(1000, pageToken);
      admins.push(...page.users.filter((u) => u.customClaims?.role === ROLE));
      pageToken = page.pageToken;
    } while (pageToken);
    console.log(admins.length ? admins.map((u) => `${u.email} (uid ${u.uid})`).join("\n") : "No Super Admin accounts yet.");
    process.exit(0);
  }

  if (flag === "--create") {
    const existing = await auth.getUserByEmail(email).catch((error) => {
      if (error.code === "auth/user-not-found") return null;
      throw error;
    });
    if (existing) {
      console.error(`Refusing: ${email} already has an account. Run without --create to make it admin, or use --reset-password.`);
      process.exit(1);
    }
    const password = await askPassword();
    const user = await auth.createUser({ email, password, emailVerified: true, displayName: "Admin" });
    await grant(user);
    console.log(`Created Super Admin ${email} (uid ${user.uid}). Sign in at /admin/login.`);
    process.exit(0);
  }

  const user = await auth.getUserByEmail(email);

  if (flag === "--revoke") {
    const claims = { ...(user.customClaims ?? {}) };
    delete claims.role;
    await auth.setCustomUserClaims(user.uid, claims);
    await auth.revokeRefreshTokens(user.uid);
    console.log(`Revoked ${ROLE} for ${email} (uid ${user.uid}). They must sign in again.`);
    process.exit(0);
  }

  if (flag === "--reset-password") {
    if (user.customClaims?.role !== ROLE) {
      console.error(`Refusing: ${email} is not a Super Admin. Customers reset their password from the sign-in page.`);
      process.exit(1);
    }
    await auth.updateUser(user.uid, { password: await askPassword() });
    await auth.revokeRefreshTokens(user.uid);
    console.log(`New password set for ${email}. Existing admin sessions were signed out.`);
    process.exit(0);
  }

  if (!user.emailVerified) {
    console.error(`Refusing: ${email} has not verified its email address yet (or use --create for a new admin account).`);
    process.exit(1);
  }
  // Admin sign-in is email + password only (no Google), so the account needs a password.
  if (!user.providerData.some((p) => p.providerId === "password")) {
    console.error(`Refusing: ${email} has no email/password sign-in. Use --create with a different email for the admin account.`);
    process.exit(1);
  }
  await grant(user);
  console.log(`Granted ${ROLE} for ${email} (uid ${user.uid}). They must sign in again.`);
} catch (error) {
  console.error(`Failed: ${error.code ?? error.message}`);
  process.exit(1);
}
