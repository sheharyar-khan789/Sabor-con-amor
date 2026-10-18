// Admin improvements, step 3: delete (test / spam only) and archive / restore.
// In-memory transactional store (Firestore-like rules). Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { adminDeleteBooking, adminSetArchived, deleteRefusal } from "../../src/lib/booking/admin-archive.ts";
import { applyAdminListQuery, parseAdminListQuery, toAdminRow } from "../../src/lib/booking/admin-view.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { generateQuotation, issueQuotation, recordPayment, voidPayment } from "../../src/lib/booking/finance.ts";
import { bookingReference, type BookingRecord } from "../../src/lib/booking/model.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { DEFAULT_CONFIG, type BusinessConfig } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { testConfig } from "./test-config.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const cust = (n: number) => ({ uid: `cust-${n}`, email: `c${n}@example.test` });
const PRICES = testConfig({ hallRent: { "main-hall": 100_000 }, perGuestRate: 1_000 });
const BUSINESS = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };
const seen = (b: BookingRecord) => new Date(b.updatedAt).toISOString();
const get = async (s: MemoryBookingStore, id: string) => (await s.getBooking(id))!;

async function request(s: MemoryBookingStore, who = cust(1), over = {}, config: BusinessConfig = DEFAULT_CONFIG) {
  const r = await createCustomerBookingRequest(s, who, input(over), { now: NOW, config });
  assert.ok(r.ok, JSON.stringify(r));
  return r.booking;
}
const del = async (s: MemoryBookingStore, id: string, over: Partial<{ confirmReference: string; reason: string; expectedUpdatedAt: string }> = {}) =>
  adminDeleteBooking(s, ADMIN, id, {
    expectedUpdatedAt: over.expectedUpdatedAt ?? seen(await get(s, id)),
    confirmReference: over.confirmReference ?? bookingReference(id),
    reason: over.reason ?? "Test booking",
    now: NOW,
  });
const pay = (amount: number) => ({ amount, method: "cash" as const, paidOn: "2026-10-01", reference: "", notes: "", requestKey: randomUUID() });

describe("admin delete booking", () => {
  it("pending test request: booking, slot lock and change requests removed; audit kept; customer told", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s);
    const v = validateChangeRequest({ type: "cancellation", requestKey: randomUUID() }, "2026-10-01", DEFAULT_CONFIG);
    assert.ok(v.ok);
    assert.ok((await submitChangeRequest(s, { uid: "cust-1" }, b.bookingId, v.value, { now: NOW })).ok);
    assert.equal((await s.listRequestsForBooking(b.bookingId)).length, 1);
    const r = await del(s, b.bookingId, { reason: "Spam request" });
    assert.deepEqual(r, { ok: true, reference: bookingReference(b.bookingId), removedRequests: 1 });
    assert.equal(await s.getBooking(b.bookingId), null);
    assert.equal(s.lockFor(b.slotKey), null, "slot released");
    assert.equal((await s.listRequestsForBooking(b.bookingId)).length, 0);
    const [audit] = await s.listAuditForBooking(b.bookingId, 5);
    assert.equal(audit.action, "booking_deleted");
    assert.equal(audit.reason, "Spam request");
    assert.equal(audit.before?.reference, bookingReference(b.bookingId));
    assert.equal(audit.before?.status, "pending");
    assert.equal(audit.actor.uid, ADMIN.uid);
    const removed = s.allNotifications().find((n) => n.type === "BOOKING_REMOVED");
    assert.equal(removed?.customerId, "cust-1");
    assert.equal(removed?.actionUrl, "/account/bookings");
    // The slot can be requested again.
    await request(s, cust(2));
  });

  it("rejected, expired and cancelled bookings without finances can be deleted", async () => {
    for (const to of ["rejected", "cancelled"] as const) {
      const s = new MemoryBookingStore();
      const b = await request(s);
      assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, to, { now: NOW })).ok);
      assert.equal((await del(s, b.bookingId)).ok, true, to);
    }
    assert.equal(deleteRefusal({ status: "expired" }, { payments: 0, quotations: 0, operations: false, assignments: 0 }), null);
  });

  it("refused: confirmed / under review / completed (cancel first), with payments (even voided), with any quotation, with event records", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s);
    assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, "confirmed", { now: NOW })).ok);
    assert.deepEqual(await del(s, b.bookingId), { ok: false, code: "not_deletable_status" });
    assert.ok(await s.getBooking(b.bookingId));
    for (const status of ["under_review", "completed"] as const) {
      assert.equal(deleteRefusal({ status }, { payments: 0, quotations: 0, operations: false, assignments: 0 }), "not_deletable_status");
    }

    // A cancelled booking whose payment was voided still has financial history.
    const p = await request(s, cust(2), { date: "2026-11-02" }, PRICES);
    assert.ok((await adminSetStatus(s, ADMIN, p.bookingId, "confirmed", { now: NOW })).ok);
    const paid = await recordPayment(s, ADMIN, p.bookingId, pay(10_000), { now: NOW, business: BUSINESS });
    assert.ok(paid.ok);
    assert.ok((await voidPayment(s, ADMIN, paid.payment.paymentId, "Entered twice", { now: NOW })).ok);
    assert.ok((await adminSetStatus(s, ADMIN, p.bookingId, "cancelled", { now: NOW })).ok);
    assert.deepEqual(await del(s, p.bookingId), { ok: false, code: "has_payments" });
    assert.equal((await s.listPaymentsForBooking(p.bookingId)).length, 1, "payments are never deleted");

    // Issued quotation on a cancelled booking.
    const q = await request(s, cust(3), { date: "2026-11-03" }, PRICES);
    const draft = await generateQuotation(s, ADMIN, q.bookingId, { now: NOW, config: PRICES, business: BUSINESS });
    assert.ok(draft.ok, JSON.stringify(draft));
    assert.ok((await issueQuotation(s, ADMIN, draft.quotation.quotationId, { now: NOW })).ok);
    assert.ok((await adminSetStatus(s, ADMIN, q.bookingId, "cancelled", { now: NOW })).ok);
    assert.deepEqual(await del(s, q.bookingId), { ok: false, code: "has_quotations" });

    assert.equal(deleteRefusal({ status: "cancelled" }, { payments: 0, quotations: 0, operations: true, assignments: 0 }), "has_operations");
    assert.equal(deleteRefusal({ status: "cancelled" }, { payments: 0, quotations: 0, operations: false, assignments: 1 }), "has_operations");
  });

  it("refused: wrong typed reference, missing reason, stale page — nothing deleted", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s);
    assert.deepEqual(await del(s, b.bookingId, { confirmReference: "SP-00000000" }), { ok: false, code: "reference_mismatch" });
    assert.deepEqual(await del(s, b.bookingId, { reason: " x " }), { ok: false, code: "invalid_reason" });
    assert.deepEqual(await del(s, b.bookingId, { expectedUpdatedAt: "2020-01-01T00:00:00.000Z" }), { ok: false, code: "stale" });
    assert.ok(await s.getBooking(b.bookingId));
    assert.ok(s.lockFor(b.slotKey));
    // The typed reference is case-insensitive.
    assert.equal((await del(s, b.bookingId, { confirmReference: bookingReference(b.bookingId).toLowerCase() })).ok, true);
  });
});

describe("admin archive / restore", () => {
  it("archives finished bookings only; hidden from default lists, shown with 'Show archived'; restore brings it back", async () => {
    const s = new MemoryBookingStore();
    const keep = await request(s, cust(1), { date: "2026-10-20" });
    const old = await request(s, cust(2), { date: "2026-10-21" });
    assert.ok((await adminSetStatus(s, ADMIN, old.bookingId, "cancelled", { now: NOW })).ok);

    assert.deepEqual(await adminSetArchived(s, ADMIN, keep.bookingId, true, { expectedUpdatedAt: seen(keep), now: NOW }), { ok: false, code: "not_archivable" });
    const conf = await request(s, cust(3), { date: "2026-10-22" });
    assert.ok((await adminSetStatus(s, ADMIN, conf.bookingId, "confirmed", { now: NOW })).ok);
    assert.equal((await adminSetArchived(s, ADMIN, conf.bookingId, true, { expectedUpdatedAt: seen(await get(s, conf.bookingId)), now: NOW })).ok, false, "confirmed: cancel first");

    const later = new Date(NOW.getTime() + 1000);
    const a = await adminSetArchived(s, ADMIN, old.bookingId, true, { expectedUpdatedAt: seen(await get(s, old.bookingId)), reason: "Old test", now: later });
    assert.ok(a.ok);
    const archived = await get(s, old.bookingId);
    assert.ok(archived.archivedAt);
    assert.equal(archived.status, "cancelled", "status unchanged");
    assert.deepEqual(await adminSetArchived(s, ADMIN, old.bookingId, true, { expectedUpdatedAt: seen(archived), now: later }), { ok: false, code: "already_archived" });

    const rows = async () => (await s.listBookingsInRange({ from: "2026-01-01", to: "2027-12-31", limit: 100 })).map((b) => toAdminRow(b, NOW));
    const def = applyAdminListQuery(await rows(), parseAdminListQuery({}, "2026-10-01"));
    assert.ok(!def.rows.some((r) => r.bookingId === old.bookingId), "hidden by default");
    assert.ok(def.rows.some((r) => r.bookingId === keep.bookingId));
    const all = applyAdminListQuery(await rows(), parseAdminListQuery({ archived: "1" }, "2026-10-01"));
    assert.ok(all.rows.find((r) => r.bookingId === old.bookingId)?.archived, "shown, marked archived");
    assert.equal(all.total, def.total + 1);

    const restored = await adminSetArchived(s, ADMIN, old.bookingId, false, { expectedUpdatedAt: seen(archived), now: new Date(later.getTime() + 1000) });
    assert.ok(restored.ok);
    assert.equal((await get(s, old.bookingId)).archivedAt, null);
    assert.deepEqual((await s.listAuditForBooking(old.bookingId, 10)).map((x) => x.action).slice(0, 2), ["booking_restored", "booking_archived"]);
    assert.deepEqual(await adminSetArchived(s, ADMIN, old.bookingId, false, { expectedUpdatedAt: seen(await get(s, old.bookingId)), now: later }), { ok: false, code: "not_archived" });
  });

  it("archiving keeps payments and the price untouched", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s, cust(1), {}, PRICES);
    assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, "confirmed", { now: NOW })).ok);
    assert.ok((await recordPayment(s, ADMIN, b.bookingId, pay(50_000), { now: NOW, business: BUSINESS })).ok);
    assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, "cancelled", { now: NOW })).ok);
    const before = await get(s, b.bookingId);
    assert.ok((await adminSetArchived(s, ADMIN, b.bookingId, true, { expectedUpdatedAt: seen(before), now: new Date(NOW.getTime() + 5000) })).ok);
    const after = await get(s, b.bookingId);
    assert.deepEqual(after.payment, before.payment);
    assert.deepEqual(after.pricing, before.pricing);
    assert.equal((await s.listPaymentsForBooking(b.bookingId)).length, 1);
  });
});
