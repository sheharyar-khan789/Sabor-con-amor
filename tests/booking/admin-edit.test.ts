// Admin improvements, step 2: "Edit booking" (contact, guests, event type,
// menu / package / services, notes, date and slot) in one transaction with the
// engine's slot locks, the price guard and the audit trail. In-memory
// transactional store (Firestore-like rules). Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { adminEditBooking, planEdit, validateBookingEdit, type BookingEdit } from "../../src/lib/booking/admin-edit.ts";
import { recordPayment } from "../../src/lib/booking/finance.ts";
import type { PaymentInput } from "../../src/lib/booking/finance.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import type { BookingRecord } from "../../src/lib/booking/model.ts";
import { toCustomerView } from "../../src/lib/booking/portal.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { DEFAULT_CONFIG, type BusinessConfig } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { MENU_FIXTURE_CONFIG, testConfig } from "./test-config.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const cust = (n: number) => ({ uid: `cust-${n}`, email: `c${n}@example.test` });
// Hall 100,000 + 1,000 per guest; 400 guests => 500,000.
const PRICES = testConfig({ hallRent: { "main-hall": 100_000 }, perGuestRate: 1_000, advance: { mode: "percent", value: 20 } });
const LATER = new Date(NOW.getTime() + 60_000);
const seen = (b: BookingRecord) => new Date(b.updatedAt).toISOString();

async function request(s: MemoryBookingStore, who = cust(1), over = {}, config: BusinessConfig = MENU_FIXTURE_CONFIG) {
  const r = await createCustomerBookingRequest(s, who, input(over), { now: NOW, config });
  assert.ok(r.ok, JSON.stringify(r));
  return r.booking;
}
const edit = (s: MemoryBookingStore, b: BookingRecord, changes: BookingEdit, over: { expectedTotal?: number | null; config?: BusinessConfig; now?: Date } = {}) =>
  adminEditBooking(s, ADMIN, b.bookingId, changes, { expectedUpdatedAt: seen(b), now: over.now ?? LATER, config: over.config ?? MENU_FIXTURE_CONFIG, expectedTotal: over.expectedTotal });
const get = async (s: MemoryBookingStore, id: string) => (await s.getBooking(id))!;
const pay = (amount: number): PaymentInput => ({ amount, method: "cash", paidOn: "2026-10-01", reference: "", notes: "", requestKey: randomUUID() });
const BUSINESS = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };

describe("admin edit booking", () => {
  it("edits contact, guests, event type, menu and notes; audits old → new; notifies the customer", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s);
    const r = await edit(s, b, { contactName: "New Name", contactPhone: "0301 7654321", contactEmail: "new@example.test", guestCount: 350, eventTypeId: "mehndi", menuPreferenceId: "w2", customerNotes: "Stage on the left" });
    assert.ok(r.ok, JSON.stringify(r));
    const after = await get(s, b.bookingId);
    assert.deepEqual(after.customer, { name: "New Name", phone: "0301 7654321", email: "new@example.test" });
    assert.equal(after.guestCount, 350);
    assert.equal(after.eventTypeId, "mehndi");
    assert.equal(after.eventTypeLabel, DEFAULT_CONFIG.eventTypes.find((e) => e.id === "mehndi")!.name);
    assert.equal(after.menuPreference?.id, "w2");
    assert.equal(after.customerNotes, "Stage on the left");
    assert.equal(after.status, "pending", "status is never changed by an edit");
    assert.equal(after.customerId, "cust-1", "ownership is never changed");
    const [audit] = await s.listAuditForBooking(b.bookingId, 5);
    assert.equal(audit.action, "booking_edited");
    assert.equal(audit.before?.guestCount, "400");
    assert.equal(audit.after?.guestCount, "350");
    assert.equal(audit.after?.contactName, "New Name");
    assert.equal(audit.after?.customerNotes, "17 characters", "note text is not copied into the audit");
    const n = s.allNotifications().filter((x) => x.type === "BOOKING_UPDATED");
    assert.equal(n.length, 1);
    assert.equal(n[0].customerId, "cust-1");
    assert.match(n[0].message, /guests/);
    // The customer's own view shows the new details.
    const view = toCustomerView(after, LATER);
    assert.equal(view.guestCount, 350);
  });

  it("moves date and slot: claims the new slot and releases the old one together", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s);
    assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, "confirmed", { now: NOW })).ok);
    const confirmed = await get(s, b.bookingId);
    const r = await edit(s, confirmed, { date: "2026-11-05", slotId: "night" });
    assert.ok(r.ok, JSON.stringify(r));
    const after = await get(s, b.bookingId);
    assert.equal(after.slotKey, "2026-11-05__main-hall__night");
    assert.equal(after.status, "confirmed");
    assert.equal(s.lockFor(b.slotKey), null, "old slot released");
    assert.equal(s.lockFor(after.slotKey)?.bookingId, b.bookingId);
    assert.equal(s.lockFor(after.slotKey)?.status, "confirmed");
    // The old slot is bookable again.
    await request(s, cust(2));
    assert.match(s.allNotifications().find((x) => x.type === "BOOKING_UPDATED")!.message, /previously/);
  });

  it("refuses a slot taken by another booking: nothing changes", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, cust(1));
    const other = await request(s, cust(2), { date: "2026-11-05" });
    const r = await edit(s, a, { date: "2026-11-05", guestCount: 300 });
    assert.deepEqual(r, { ok: false, code: "slot_unavailable" });
    const after = await get(s, a.bookingId);
    assert.equal(after.eventDate, a.eventDate);
    assert.equal(after.guestCount, 400, "no partial change");
    assert.equal(s.lockFor(a.slotKey)?.bookingId, a.bookingId);
    assert.equal(s.lockFor(other.slotKey)?.bookingId, other.bookingId);
    assert.equal((await s.listAuditForBooking(a.bookingId, 5)).length, 0);
  });

  it("price: a quote change must be confirmed with the exact new total; then applied with payments kept", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s, cust(1), {}, PRICES);
    assert.equal(b.pricing?.total, 500_000);
    const plan = planEdit(b, { guestCount: 450 }, PRICES, LATER);
    assert.ok(plan.ok);
    assert.deepEqual(plan.ok && plan.plan.price && [plan.plan.price.before, plan.plan.price.after], [500_000, 550_000]);
    const unconfirmed = await edit(s, b, { guestCount: 450 }, { config: PRICES });
    assert.deepEqual(unconfirmed, { ok: false, code: "price_confirmation_required", price: { before: 500_000, after: 550_000 } });
    assert.equal((await get(s, b.bookingId)).guestCount, 400, "nothing applied without confirmation");
    const wrong = await edit(s, b, { guestCount: 450 }, { config: PRICES, expectedTotal: 540_000 });
    assert.equal(wrong.ok, false);
    const ok = await edit(s, b, { guestCount: 450 }, { config: PRICES, expectedTotal: 550_000 });
    assert.ok(ok.ok, JSON.stringify(ok));
    const after = await get(s, b.bookingId);
    assert.equal(after.pricing?.total, 550_000);
    assert.equal(after.payment.balanceDue, 550_000);
    const [audit] = await s.listAuditForBooking(b.bookingId, 5);
    assert.deepEqual([audit.before?.total, audit.after?.total], [500_000, 550_000]);
  });

  it("price guard: a new total below the amount already paid is refused (refund / financial adjustment)", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s, cust(1), {}, PRICES);
    assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, "confirmed", { now: NOW })).ok);
    assert.ok((await recordPayment(s, ADMIN, b.bookingId, pay(450_000), { now: NOW, business: BUSINESS })).ok);
    const paid = await get(s, b.bookingId);
    // 300 guests => 400,000 < 450,000 paid.
    const r = await edit(s, paid, { guestCount: 300 }, { config: PRICES, expectedTotal: 400_000 });
    assert.deepEqual(r, { ok: false, code: "total_below_paid" });
    const after = await get(s, b.bookingId);
    assert.equal(after.pricing?.total, 500_000);
    assert.equal(after.payment.advanceReceived, 450_000);
    assert.equal(after.payment.paymentCount, 1, "payment summary untouched");
    // A change that keeps the total above what was paid works, and keeps the payments.
    const up = await edit(s, after, { guestCount: 420 }, { config: PRICES, expectedTotal: 520_000 });
    assert.ok(up.ok, JSON.stringify(up));
    const raised = await get(s, b.bookingId);
    assert.deepEqual([raised.payment.advanceReceived, raised.payment.balanceDue, raised.payment.paymentCount], [450_000, 70_000, 1]);
    assert.equal((await s.listPaymentsForBooking(b.bookingId)).length, 1);
  });

  it("a priced booking is never left without a price (missing menu price → refused)", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s, cust(1), {}, PRICES);
    const r = await edit(s, b, { menuPreferenceId: "w1" }, { config: PRICES, expectedTotal: null });
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.code, "pricing_incomplete");
    assert.equal((await get(s, b.bookingId)).menuPreference, null);
  });

  it("an unpriced booking stays unpriced (the edit never creates a first price)", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s);
    assert.equal(b.pricing, null);
    const r = await edit(s, b, { guestCount: 300 }, { config: PRICES });
    assert.ok(r.ok);
    assert.equal((await get(s, b.bookingId)).pricing, null);
  });

  it("completed, cancelled, rejected and expired bookings are read-only", async () => {
    for (const to of ["cancelled", "rejected"] as const) {
      const s = new MemoryBookingStore();
      const b = await request(s);
      assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, to, { now: NOW })).ok);
      assert.deepEqual(await edit(s, await get(s, b.bookingId), { guestCount: 300 }), { ok: false, code: "not_editable" });
    }
    const s = new MemoryBookingStore();
    const b = await request(s);
    for (const status of ["completed", "expired"] as const) {
      assert.deepEqual(planEdit({ ...b, status }, { guestCount: 300 }, DEFAULT_CONFIG, LATER), { ok: false, code: "not_editable" });
    }
  });

  it("stale page, no change, invalid values and unknown fields are refused", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s);
    assert.ok((await edit(s, b, { guestCount: 300 })).ok);
    assert.deepEqual(await edit(s, b, { guestCount: 250 }), { ok: false, code: "stale" }, "edit based on the old version");
    const now = await get(s, b.bookingId);
    assert.deepEqual(await edit(s, now, { guestCount: 300 }), { ok: false, code: "no_change" });
    const tooMany = await edit(s, now, { guestCount: 5000 });
    assert.equal(!tooMany.ok && tooMany.code, "invalid_change");
    const past = await edit(s, now, { date: "2026-09-01" });
    assert.equal(!past.ok && past.field, "date");
    assert.equal(!past.ok && past.code, "invalid_change");
    const unknownEvent = await edit(s, now, { eventTypeId: "nope" });
    assert.equal(!unknownEvent.ok && unknownEvent.field, "eventTypeId");

    const v = validateBookingEdit({ guestCount: 300, status: "confirmed", customerId: "x" });
    assert.equal(v.ok, false);
    assert.equal(!v.ok && v.errors.body?.code, "unexpected_field");
    assert.equal(validateBookingEdit({ contactPhone: "12" }).ok, false);
    assert.equal(validateBookingEdit({ contactEmail: "not-an-email" }).ok, false);
    assert.equal(validateBookingEdit({ guestCount: 1.5 }).ok, false);
    assert.equal(validateBookingEdit({ serviceIds: ["a", "a"] }).ok, false);
    assert.equal(validateBookingEdit([]).ok, false);
    assert.deepEqual(validateBookingEdit({ contactEmail: "", menuPreferenceId: "" }), { ok: true, value: { contactEmail: null, menuPreferenceId: null } });
  });

  it("two admins editing at once: exactly one wins, the other is refused as stale", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s);
    const results = await Promise.all([edit(s, b, { guestCount: 300 }), edit(s, b, { guestCount: 200 })]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal((await s.listAuditForBooking(b.bookingId, 5)).length, 1);
  });
});
