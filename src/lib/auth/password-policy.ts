// Password rules for new passwords (sign-up and password reset).
//
// Firebase Auth stores and checks passwords (hashed with its own scrypt); the
// app never sees them on the server. Firebase's own password policy (console:
// Authentication → Settings → Password policy, "Require enforcement",
// minimum length 10) enforces the length on Firebase's servers; Firebase
// cannot reject common passwords, so that check runs here in the browser.

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 4096;

// Widely published most-used / breached passwords (lower case), plus obvious
// local and brand variants. Small on purpose: it ships to the browser.
const COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "12345678910", "0123456789", "111111", "1111111111",
  "000000", "0000000000", "123123", "123123123", "123321", "654321", "987654321", "9876543210", "112233", "121212",
  "666666", "777777", "888888", "999999", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "1qaz2wsx3edc", "qwerty", "qwerty123",
  "qwertyuiop", "qwerty12345", "asdfghjkl", "asdf1234", "zxcvbnm", "zaq12wsx", "password", "password1", "password12",
  "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword", "pass1234", "passwordpassword", "abc123",
  "abcd1234", "abc12345", "abcdef", "abcdefgh", "abcdefghij", "iloveyou", "iloveyou1", "princess", "sunshine",
  "football", "baseball", "cricket", "cricket123", "monkey", "dragon", "letmein", "welcome", "welcome1", "welcome123",
  "admin", "admin123", "admin1234", "administrator", "root", "master", "superman", "batman", "starwars", "trustno1",
  "shadow", "michael", "jennifer", "hello123", "freedom", "whatever", "computer", "internet", "google", "facebook",
  "pakistan", "pakistan1", "pakistan123", "pakistan786", "786786", "786786786", "karachi", "lahore", "islamabad",
  "allah786", "bismillah", "bismillah786", "mashallah", "saborconamor", "sabor", "marquee", "wedding",
  "changeme", "secret", "default", "test1234", "testtest", "qazwsx", "qazwsxedc", "aa123456", "a1b2c3d4",
]);

/** Lower-cased, with trailing digits / symbols removed ("Password2024!" → "password"). */
function base(password: string): string {
  return password.toLowerCase().replace(/[\d\W_]+$/u, "");
}

/** A reason the new password is not acceptable, or null when it is fine. */
export function passwordProblem(password: string, email?: string | null): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Please use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return "This password is too long.";
  const lower = password.toLowerCase();
  if (/^(.)\1+$/u.test(password)) return "Please don't use one character repeated.";
  if (COMMON.has(lower) || COMMON.has(base(password))) return "This password is too common. Please choose a less predictable one.";
  const local = email?.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && lower.includes(local)) return "Please don't use your email address in your password.";
  return null;
}

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters; avoid common passwords.`;
