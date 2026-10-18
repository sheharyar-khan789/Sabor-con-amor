// Security hardening: open-redirect guard, Super Admin session policy (MFA,
// admin session age, recent sign-in), password policy, security-log privacy,
// CSP, rate limiter, and customer account deletion (isolation + retention).
// Pure logic and the IN-MEMORY transactional store (not Firestore).
// Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { anonymisedCustomerRef, blocksDeletion, deleteCustomerData } from "../../src/lib/account/deletion.ts";
import { MemoryProfileStore } from "../../src/lib/account/profile.ts";
import { safeNextPath } from "../../src/lib/auth/constants.ts";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "../../src/lib/auth/password-policy.ts";
import {
  ADMIN_REAUTH_SECONDS,
  ADMIN_SESSION_SECONDS,
  adminAccess,
  adminMfaRequired,
  CUSTOMER_SESSION_SECONDS,
  isRecentSignIn,
  type SessionClaims,
} from "../../src/lib/auth/session-policy.ts";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { generateQuotation, issueQuotation, recordPayment } from "../../src/lib/booking/finance.ts";
import type { BusinessSnapshot } from "../../src/lib/booking/finance-model.ts";
import { isRateLimited, rateLimit } from "../../src/lib/booking/rate-limit.ts";
import { reviewIdFor, submitReview } from "../../src/lib/booking/reviews.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { contentSecurityPolicy, newNonce } from "../../src/lib/security/csp.ts";
import { formatSecurityLog, hashId, routeOf } from "../../src/lib/security/log.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { testConfig } from "./test-config.ts";

describe("open-redirect guard (safeNextPath)", () => {
  it("keeps same-site paths", () => {
    assert.equal(safeNextPath("/account/bookings"), "/account/bookings");
    assert.equal(safeNextPath("/book?date=2026-10-10&slot=day"), "/book?date=2026-10-10&slot=day");
    assert.equal(safeNextPath("/admin/bookings/bk_1#x", "/admin"), "/admin/bookings/bk_1#x");
    assert.equal(safeNextPath("/book?note=a%20b"), "/book?note=a%20b", "encoded characters in the query are fine");
  });
  it("refuses every off-site or ambiguous form", () => {
    for (const evil of [
      "https://evil.example/",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r/evil.example",
      " /evil",
      "/ /evil.example",
      "javascript:alert(1)",
      "/login?next=/x",
      "/signup",
      "/api/auth/session",
      "/./api/admin/settings",
      "/%0a",
      "/%09/evil.example",
      "/%2F%2Fevil.example",
      "/%5Cevil.example",
      "/%E0%A4%A",
      "",
      "x".repeat(3000),
    ]) {
      const out = safeNextPath(evil);
      assert.equal(out, "/account", `${JSON.stringify(evil)} -> ${out}`);
      assert.ok(new URL(out, "https://site.test").origin === "https://site.test", `${JSON.stringify(evil)} stays on site`);
    }
    assert.equal(safeNextPath("/./api/admin/settings"), "/account", "normalised before the /api check");
  });
});

describe("Super Admin session policy", () => {
  const now = 1_800_000_000;
  const admin: SessionClaims = { role: "super_admin", signInProvider: "password", emailVerified: true, authTime: now - 60, secondFactor: null };
  it("only a password sign-in with the claim and a verified email is an admin", () => {
    assert.equal(adminAccess(admin, now, false), "ok");
    assert.equal(adminAccess({ ...admin, role: "customer" }, now, false), null);
    assert.equal(adminAccess({ ...admin, role: undefined }, now, false), null);
    assert.equal(adminAccess({ ...admin, signInProvider: "google.com" }, now, false), null, "Google never grants admin");
    assert.equal(adminAccess({ ...admin, emailVerified: false }, now, false), "unverified");
  });
  it("MFA required: no second factor -> mfa_required; with one -> ok", () => {
    assert.equal(adminAccess(admin, now, true), "mfa_required");
    assert.equal(adminAccess({ ...admin, secondFactor: "totp" }, now, true), "ok");
    assert.equal(adminAccess({ ...admin, secondFactor: "phone" }, now, true), "ok");
  });
  it("the flag is off unless explicitly 'true'", () => {
    assert.equal(adminMfaRequired({}), false);
    assert.equal(adminMfaRequired({ SABOR_ADMIN_MFA_REQUIRED: "1" }), false);
    assert.equal(adminMfaRequired({ SABOR_ADMIN_MFA_REQUIRED: "true" }), true);
  });
  it("admin sessions end 8 hours after sign-in (shorter than customers' 5 days)", () => {
    assert.ok(ADMIN_SESSION_SECONDS < CUSTOMER_SESSION_SECONDS);
    assert.equal(adminAccess({ ...admin, authTime: now - ADMIN_SESSION_SECONDS + 5 }, now, false), "ok");
    assert.equal(adminAccess({ ...admin, authTime: now - ADMIN_SESSION_SECONDS }, now, false), "session_expired");
  });
  it("sensitive actions need a sign-in within 15 minutes", () => {
    assert.equal(ADMIN_REAUTH_SECONDS, 15 * 60);
    assert.ok(isRecentSignIn(now - 60, now));
    assert.ok(isRecentSignIn(now - ADMIN_REAUTH_SECONDS + 1, now));
    assert.ok(!isRecentSignIn(now - ADMIN_REAUTH_SECONDS, now));
    assert.ok(!isRecentSignIn(now + 3600, now), "a sign-in time in the future is not trusted");
  });
});

describe("password policy", () => {
  it("requires length and refuses common or email-based passwords", () => {
    assert.match(passwordProblem("short1!")!, new RegExp(String(MIN_PASSWORD_LENGTH)));
    assert.ok(passwordProblem("password123"));
    assert.ok(passwordProblem("Password2024!"), "common word plus digits");
    assert.ok(passwordProblem("Pakistan786"));
    assert.ok(passwordProblem("1234567890"));
    assert.ok(passwordProblem("aaaaaaaaaaaa"));
    assert.ok(passwordProblem("ayesha.khan99", "ayesha.khan@example.test"), "contains the email name");
    assert.equal(passwordProblem("lantern-river-42-mango"), null);
  });
});

describe("security log", () => {
  it("writes hashed ids and paths only: no email, uid, query string, token or free text", () => {
    const uid = "uid-ayesha@example.test";
    const line = formatSecurityLog({
      event: "session_refused",
      route: "http://localhost/api/auth/session?email=ayesha@example.test&token=eyJabc",
      status: 401,
      reason: "Bearer eyJhbGciOi secret",
      uid,
      ip: "203.0.113.7",
      auditId: "aud_123",
    });
    const parsed = JSON.parse(line);
    assert.equal(parsed.route, "/api/auth/session");
    assert.equal(parsed.reason, "other", "free text is never logged as the reason");
    assert.equal(parsed.user, hashId(uid));
    assert.equal(parsed.auditId, "aud_123");
    for (const secret of ["ayesha", "example.test", "eyJ", "203.0.113.7", "Bearer", "secret", uid]) {
      assert.ok(!line.includes(secret), `log line must not contain ${secret}`);
    }
    assert.equal(routeOf("/account/bookings?x=1"), "/account/bookings");
  });
});

describe("content security policy", () => {
  const nonce = newNonce();
  it("scripts need this response's nonce; no inline / eval in production; only used origins", () => {
    const csp = contentSecurityPolicy({ nonce, authDomain: "venue.firebaseapp.com" });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    assert.equal(script, `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    assert.ok(!csp.includes("unsafe-eval"));
    assert.ok(csp.includes("object-src 'none'") && csp.includes("base-uri 'self'") && csp.includes("frame-ancestors 'self'"));
    assert.ok(csp.includes("frame-src 'self' https://venue.firebaseapp.com"));
    assert.ok(!csp.includes("127.0.0.1") && !csp.includes("recaptcha"), "no emulator / App Check origins unless enabled");
    assert.ok(!/\*/.test(csp), "no wildcard sources");
  });
  it("nonces are fresh and unguessable", () => {
    const seen = new Set(Array.from({ length: 200 }, () => newNonce()));
    assert.equal(seen.size, 200);
    assert.ok(nonce.length >= 22);
  });
  it("adds emulator / App Check / dev sources only when asked; refuses odd host values", () => {
    const csp = contentSecurityPolicy({ nonce, emulatorHost: "127.0.0.1", appCheck: true, development: true });
    assert.ok(csp.includes("http://127.0.0.1:9099") && csp.includes("https://www.google.com/recaptcha/") && csp.includes("'unsafe-eval'"));
    const odd = contentSecurityPolicy({ nonce, authDomain: "evil.example; script-src *" });
    assert.ok(!odd.includes("evil.example"));
  });
});

describe("rate limiter", () => {
  it("allows normal use, then refuses after the limit until the window passes", () => {
    const key = `test:${randomUUID()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) assert.ok(rateLimit(key, 5, 60_000, t0 + i).ok, `request ${i + 1} allowed`);
    const sixth = rateLimit(key, 5, 60_000, t0 + 10);
    assert.ok(!sixth.ok && sixth.retryAfterSeconds > 0);
    assert.ok(isRateLimited(key, 5, 60_000, t0 + 20));
    assert.ok(rateLimit(key, 5, 60_000, t0 + 60_001).ok, "allowed again after the window");
  });
  it("keys are independent (one customer's limit never blocks another)", () => {
    const a = `test:${randomUUID()}`;
    const b = `test:${randomUUID()}`;
    for (let i = 0; i < 3; i++) rateLimit(a, 3, 60_000);
    assert.ok(!rateLimit(a, 3, 60_000).ok);
    assert.ok(rateLimit(b, 3, 60_000).ok);
  });
});

// ------------------------------------------------------------ account deletion

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const A = { uid: "guest-uid-a", email: "a@example.test" };
const B = { uid: "guest-uid-b", email: "b@example.test" };
const PRICES = testConfig({ hallRent: { "main-hall": 100_000 }, perGuestRate: 1_000, advance: { mode: "percent", value: 20 } });
const BUSINESS: BusinessSnapshot = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };
const TODAY = "2026-10-05";

async function confirmed(s: MemoryBookingStore, who: { uid: string; email: string }, date: string) {
  const r = await createCustomerBookingRequest(s, who, input({ date }), { now: NOW, config: PRICES });
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok((await adminSetStatus(s, ADMIN, r.booking.bookingId, "confirmed", { now: NOW })).ok);
  return r.booking.bookingId;
}
async function paid(s: MemoryBookingStore, bookingId: string) {
  const p = await recordPayment(
    s,
    ADMIN,
    bookingId,
    { amount: 10_000, method: "cash", paidOn: "2026-10-01", reference: "", notes: "", requestKey: randomUUID() },
    { now: NOW, business: BUSINESS }
  );
  assert.ok(p.ok, JSON.stringify(p));
  return p.payment.paymentId;
}
async function completed(s: MemoryBookingStore, bookingId: string) {
  assert.ok((await adminSetStatus(s, ADMIN, bookingId, "completed", { now: new Date("2026-10-04T12:00:00Z") })).ok);
}

describe("customer account deletion", () => {
  it("an active booking blocks deletion (pending / under review / confirmed for today or later)", () => {
    assert.ok(blocksDeletion({ status: "pending", eventDate: "2020-01-01" }, TODAY));
    assert.ok(blocksDeletion({ status: "under_review", eventDate: "2020-01-01" }, TODAY));
    assert.ok(blocksDeletion({ status: "confirmed", eventDate: TODAY }, TODAY));
    assert.ok(!blocksDeletion({ status: "confirmed", eventDate: "2026-10-04" }, TODAY));
    for (const status of ["completed", "cancelled", "rejected", "expired"] as const) assert.ok(!blocksDeletion({ status, eventDate: "2030-01-01" }, TODAY));
  });

  it("deletes A's profile, notifications and reviews; keeps A's booking and financial records anonymised; never touches B", async () => {
    const s = new MemoryBookingStore();
    const profiles = new MemoryProfileStore();
    profiles.seed([
      { uid: A.uid, email: A.email, name: "Customer A", phone: "03001234567", authProvider: "password", emailVerified: true, updatedAt: null },
      { uid: B.uid, email: B.email, name: "Customer B", phone: "03007654321", authProvider: "password", emailVerified: true, updatedAt: null },
    ]);

    // A: a completed, paid, quoted and reviewed event, plus an upcoming confirmed one.
    const past = await confirmed(s, A, "2026-10-01");
    const payA = await paid(s, past);
    const q = await generateQuotation(s, ADMIN, past, { now: NOW, config: PRICES, business: BUSINESS });
    assert.ok(q.ok, JSON.stringify(q));
    assert.ok((await issueQuotation(s, ADMIN, q.quotation.quotationId, { now: NOW })).ok);
    await completed(s, past);
    assert.ok((await submitReview(s, A.uid, past, { rating: 5, text: "Lovely venue and staff.", displayName: "A K." }, { now: NOW })).ok);
    const upcoming = await confirmed(s, A, "2026-10-20");
    const cancel = validateChangeRequest({ type: "cancellation", reason: "Plans changed", requestKey: randomUUID() }, "2026-10-01", PRICES);
    assert.ok(cancel.ok, JSON.stringify(cancel));
    assert.ok((await submitChangeRequest(s, { uid: A.uid }, upcoming, cancel.value, { now: NOW })).ok);

    // B: their own paid booking and review.
    const bBooking = await confirmed(s, B, "2026-10-03");
    const payB = await paid(s, bBooking);
    await completed(s, bBooking);
    assert.ok((await submitReview(s, B.uid, bBooking, { rating: 4, text: "Very good food and service.", displayName: "B" }, { now: NOW })).ok);

    const before = s.allNotifications();
    assert.ok(before.some((n) => n.customerId === A.uid) && before.some((n) => n.customerId === B.uid));
    const bNotifications = before.filter((n) => n.customerId === B.uid).length;

    // 1. Refused while A has an upcoming confirmed booking; nothing changed.
    const refused = await deleteCustomerData(s, profiles, A.uid, { today: TODAY, now: NOW });
    assert.deepEqual(refused, { ok: false, code: "active_bookings", count: 1 });
    assert.ok(await profiles.get(A.uid));
    assert.equal((await s.getBooking(past))!.customerId, A.uid);

    // 2. The venue cancels the upcoming booking; deletion then succeeds.
    assert.ok((await adminSetStatus(s, ADMIN, upcoming, "cancelled", { now: NOW })).ok);
    const result = await deleteCustomerData(s, profiles, A.uid, { today: TODAY, now: NOW });
    assert.ok(result.ok, JSON.stringify(result));
    const ref = anonymisedCustomerRef(A.uid);
    assert.equal(result.ref, ref);
    assert.ok(!ref.includes(A.uid) && ref.startsWith("deleted_"));
    assert.equal(result.bookings, 2);
    assert.equal(result.payments, 1);
    assert.equal(result.quotations, 1);
    assert.equal(result.reviews, 1);
    assert.equal(result.requests, 1);
    assert.ok(result.notifications > 0);

    // Profile, notifications and review of A are gone.
    assert.equal(await profiles.get(A.uid), null);
    assert.equal(s.allNotifications().filter((n) => n.customerId === A.uid).length, 0);
    assert.equal(await s.getReview(reviewIdFor(past)), null);
    // Booking and financial records are kept, unlinked from the account.
    const kept = (await s.getBooking(past))!;
    assert.equal(kept.customerId, ref);
    assert.equal(kept.customer.email, null);
    assert.equal(kept.createdBy.uid, ref);
    assert.equal(kept.status, "completed");
    assert.equal(kept.payment.advanceReceived, 10_000, "financial totals unchanged");
    const payment = (await s.getPayment(payA))!;
    assert.equal(payment.customerId, ref);
    assert.equal(payment.amount, 10_000);
    assert.equal(payment.receipt.receiptNumber.length > 0, true, "receipt kept");
    assert.equal((await s.getQuotation(q.quotation.quotationId))!.customerId, ref);
    assert.equal((await s.listRequestsForCustomer(ref, {})).length, 1);
    assert.equal((await s.listBookingsForCustomer(A.uid, 50)).length, 0, "nothing is linked to the deleted account");

    // Customer B is untouched.
    assert.ok(await profiles.get(B.uid));
    assert.equal((await s.getBooking(bBooking))!.customerId, B.uid);
    assert.equal((await s.getBooking(bBooking))!.customer.email, B.email);
    assert.equal((await s.getPayment(payB))!.customerId, B.uid);
    assert.ok(await s.getReview(reviewIdFor(bBooking)));
    assert.equal(s.allNotifications().filter((n) => n.customerId === B.uid).length, bNotifications);

    // Repeating is safe (idempotent).
    const again = await deleteCustomerData(s, profiles, A.uid, { today: TODAY, now: NOW });
    assert.ok(again.ok && again.bookings === 0 && again.notifications === 0);
  });
});
