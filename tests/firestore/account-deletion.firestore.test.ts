// Customer account deletion against the REAL Firestore adapter on the
// Firestore EMULATOR (never a real project): the new transactional deletes
// (notifications, reviews) and the anonymisation of kept records, with a
// second customer's data untouched. Refuses to run without FIRESTORE_EMULATOR_HOST.
// Run: npm run test:booking:firestore
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { anonymisedCustomerRef, deleteCustomerData } from "../../src/lib/account/deletion.ts";
import { firestoreProfileStore } from "../../src/lib/account/firestore-profile-store.ts";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { firestoreBookingStore } from "../../src/lib/booking/firestore-store.ts";
import { reviewIdFor, submitReview } from "../../src/lib/booking/reviews.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { input, NOW } from "../booking/engine-scenarios.ts";

const projectId = "demo-sabor-con-amor";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set; refusing to run against a real Firestore.");
const db = getFirestore(initializeApp({ projectId }, "account-deletion-test"));
let s: BookingStore;
const ADMIN = { uid: "admin-1", email: "admin@example.test" };

beforeEach(async () => {
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not reset the emulator (${res.status})`);
  s = firestoreBookingStore(db);
});

async function completedBooking(uid: string, date: string) {
  const r = await createCustomerBookingRequest(s, { uid, email: `${uid}@example.test` }, input({ date }), { now: NOW });
  assert.ok(r.ok);
  const id = r.booking.bookingId;
  assert.ok((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok);
  assert.ok((await adminSetStatus(s, ADMIN, id, "completed", { now: new Date("2026-10-04T06:00:00Z") })).ok);
  const review = await submitReview(s, uid, id, { rating: 5, text: "Lovely venue and very helpful staff.", displayName: "Guest" }, { now: NOW });
  assert.ok(review.ok);
  return id;
}

describe("firestore emulator: customer account deletion", () => {
  it("deletes A's profile, notifications and review; anonymises A's booking; B untouched", async () => {
    const profiles = firestoreProfileStore(db);
    for (const uid of ["cust-a", "cust-b"]) {
      await profiles.ensure({ uid, email: `${uid}@example.test`, emailVerified: true, signInProvider: "password", name: uid, photoURL: null });
    }
    const a = await completedBooking("cust-a", "2026-10-01");
    const b = await completedBooking("cust-b", "2026-10-02");

    const result = await deleteCustomerData(s, profiles, "cust-a", { today: "2026-10-05", now: NOW });
    assert.ok(result.ok && result.bookings === 1 && result.reviews === 1 && result.notifications > 0, JSON.stringify(result));

    assert.equal(await profiles.get("cust-a"), null);
    assert.equal((await s.listNotificationsForCustomer("cust-a", { before: null, limit: 50 })).length, 0);
    assert.equal(await s.getReview(reviewIdFor(a)), null);
    const kept = (await s.getBooking(a))!;
    assert.equal(kept.customerId, anonymisedCustomerRef("cust-a"));
    assert.equal(kept.customer.email, null);

    assert.ok(await profiles.get("cust-b"));
    assert.ok((await s.listNotificationsForCustomer("cust-b", { before: null, limit: 50 })).length > 0);
    assert.ok(await s.getReview(reviewIdFor(b)));
    assert.equal((await s.getBooking(b))!.customerId, "cust-b");
  });
});
