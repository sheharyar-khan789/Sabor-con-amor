// Customer account isolation (Phase 3): one customer can never read or change
// another customer's account or records through any customer-facing path —
// bookings, the bookings list, change requests, reviews, notifications and
// the profile. Every customer API route and /account page takes the uid from
// the verified session cookie (requireUser / getSessionUser) and calls these
// functions with it, so these checks are the server-side authorization.
// IN-MEMORY stores (not Firestore). Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { MemoryProfileStore } from "../../src/lib/account/profile.ts";
import { markAllNotificationsRead, markNotificationRead } from "../../src/lib/booking/communications.ts";
import { getOwnBooking, listOwnBookings, listOwnRequests, submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { changeBookingStatus, createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { submitReview } from "../../src/lib/booking/reviews.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { DEFAULT_CONFIG } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";

const A = { uid: "customer-a", email: "a@example.test" };
const B = { uid: "customer-b", email: "b@example.test" };
const TODAY = "2026-10-01";

async function book(s: MemoryBookingStore, who: typeof A, over = {}, complete = false) {
  const r = await createCustomerBookingRequest(s, who, input(over), { now: NOW });
  assert.ok(r.ok, JSON.stringify(r));
  if (complete) {
    assert.ok((await changeBookingStatus(s, r.booking.bookingId, "confirmed", { now: NOW })).ok);
    assert.ok((await changeBookingStatus(s, r.booking.bookingId, "completed", { now: NOW })).ok);
  }
  return (await s.getBooking(r.booking.bookingId))!;
}

describe("customer account isolation", () => {
  it("B cannot read A's booking or see it in B's list", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A, { date: "2026-10-20" });
    await book(s, B, { date: "2026-10-21" });
    assert.equal(await getOwnBooking(s, B.uid, a.bookingId), null);
    const bList = await listOwnBookings(s, B.uid);
    assert.equal(bList.length, 1);
    assert.ok(bList.every((x) => x.customerId === B.uid && x.bookingId !== a.bookingId));
  });

  it("B cannot request a change or cancellation on A's booking, and A's requests stay invisible to B", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A, { date: "2026-10-20" });
    const cancel = validateChangeRequest({ type: "cancellation", reason: "", requestKey: randomUUID() }, TODAY, DEFAULT_CONFIG);
    assert.ok(cancel.ok);
    const byB = await submitChangeRequest(s, B, a.bookingId, cancel.value, { now: NOW });
    assert.equal(byB.ok, false, "another customer's booking is refused");
    assert.deepEqual(await listOwnRequests(s, B.uid), []);
    assert.deepEqual(await listOwnRequests(s, A.uid), [], "nothing was created for A either");
    assert.equal((await s.getBooking(a.bookingId))!.status, a.status, "A's booking is unchanged");
  });

  it("B cannot review A's completed event", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A, {}, true);
    const r = await submitReview(s, B.uid, a.bookingId, { rating: 5, text: "Lovely evening with family.", displayName: "B" }, { now: NOW });
    assert.deepEqual(r, { ok: false, code: "not_found" });
  });

  it("B cannot mark A's notifications read, singly or in bulk", async () => {
    const s = new MemoryBookingStore();
    await book(s, A);
    const aNotes = await s.listNotificationsForCustomer(A.uid, { before: null, limit: 50 });
    assert.ok(aNotes.length > 0, "A has a notification for the submitted request");
    const id = aNotes[0].notificationId;
    assert.deepEqual(await markNotificationRead(s, B.uid, id, { now: NOW }), { ok: false, code: "not_found" });
    assert.deepEqual(await markAllNotificationsRead(s, B.uid, { now: NOW }), { ok: true, count: 0 });
    const after = await s.listNotificationsForCustomer(A.uid, { before: null, limit: 50 });
    assert.ok(after.every((n) => !n.readAt), "A's notifications are still unread");
    assert.deepEqual(await s.listNotificationsForCustomer(B.uid, { before: null, limit: 50 }), []);
  });

  it("profile reads and updates are keyed to the session's own uid", async () => {
    const p = new MemoryProfileStore();
    const identity = (who: typeof A) => ({ uid: who.uid, email: who.email, emailVerified: true, signInProvider: "password" });
    await p.update(identity(A), { name: "Customer A", phone: "03001234567" });
    assert.equal(await p.get(B.uid), null, "B sees no profile of A");
    await p.update(identity(B), { name: "Customer B", phone: "03007654321" });
    const a = await p.get(A.uid);
    assert.equal(a?.name, "Customer A", "B's update never touches A's profile");
    assert.equal(a?.phone, "03001234567");
  });
});
