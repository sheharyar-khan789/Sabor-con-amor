// Cross-surface consistency (Phase 5). One booking followed through the three
// surfaces on ONE shared store, re-reading after every change ("refresh"):
//   public availability  ←→  customer portal  ←→  admin lists / finance.
// Uses the same functions the routes and pages call (engine, portal, admin
// view, finance) so a status or amount can't differ between surfaces.
// Prices below are TEST FIXTURES, not Sabor con Amor prices.
// IN-MEMORY transactional store (not Firestore). Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { applyAdminListQuery, parseAdminListQuery, toAdminRow } from "../../src/lib/booking/admin-view.ts";
import { getOwnBooking, listOwnBookings } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest, getAvailability } from "../../src/lib/booking/engine.ts";
import { recordPayment, voidPayment } from "../../src/lib/booking/finance.ts";
import { financialSummary, type BusinessSnapshot } from "../../src/lib/booking/finance-model.ts";
import { toCustomerPaymentView } from "../../src/lib/booking/finance-view.ts";
import { toCustomerView } from "../../src/lib/booking/portal.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { testConfig } from "./test-config.ts";

const A = { uid: "customer-a", email: "a@example.test" };
const B = { uid: "customer-b", email: "b@example.test" };
const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const BUSINESS: BusinessSnapshot = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };
// TEST FIXTURE prices: hall 100,000 + 1,000 per guest; 400 guests => 500,000.
const CONFIG = testConfig({ hallRent: { "main-hall": 100_000 }, perGuestRate: 1_000 });
const DATE = "2026-10-20";
const TODAY = "2026-10-01";

const slotState = async (s: MemoryBookingStore, now: Date) => {
  const r = await getAvailability(s, "main-hall", DATE, DATE, { now, config: CONFIG });
  assert.ok(r.ok);
  return r.availability.days[0].slots.find((x) => x.slotId === "day")?.state;
};
const adminRows = async (s: MemoryBookingStore, now: Date) =>
  applyAdminListQuery(
    (await s.listBookingsInRange({ from: "2026-10-01", to: "2026-12-31", limit: 100 })).map((b) => toAdminRow(b, now)),
    parseAdminListQuery({ from: "2026-10-01", to: "2026-12-31" }, TODAY)
  ).rows;

describe("one booking, three surfaces, one source of truth", () => {
  it("request → hold → admin confirm → payment → void stays consistent everywhere after each re-read", async () => {
    const s = new MemoryBookingStore();
    assert.equal(await slotState(s, NOW), "available", "slot starts free on the public calendar");

    // 1. Customer A sends a request (POST /api/bookings → createCustomerBookingRequest).
    const created = await createCustomerBookingRequest(s, A, input({ date: DATE, slotId: "day" }), { now: NOW, config: CONFIG });
    assert.ok(created.ok, JSON.stringify(created));
    const id = created.booking.bookingId;

    // Public availability holds the slot; a second request for it is refused (no double booking).
    assert.equal(await slotState(s, NOW), "held");
    const clash = await createCustomerBookingRequest(s, B, input({ date: DATE, slotId: "day", requestKey: randomUUID() }), { now: NOW, config: CONFIG });
    assert.deepEqual(clash, { ok: false, code: "slot_unavailable" });

    // Customer portal: A sees it as pending with the stored price; B sees nothing.
    const mine = await listOwnBookings(s, A.uid);
    assert.deepEqual(mine.map((b) => b.bookingId), [id]);
    assert.equal(toCustomerView(mine[0], NOW).status, "pending");
    assert.equal(toCustomerView(mine[0], NOW).pricing?.total, 500_000);
    assert.equal(await getOwnBooking(s, B.uid, id), null);
    assert.deepEqual(await listOwnBookings(s, B.uid), []);

    // Admin list shows the same booking, status and total.
    const row = (await adminRows(s, NOW)).find((r) => r.bookingId === id);
    assert.equal(row?.status, "pending");
    assert.equal(row?.total, 500_000);
    assert.equal(row?.customerId, A.uid);

    // 2. Admin confirms (POST /api/admin/bookings/[id]/status → adminSetStatus).
    const LATER = new Date(NOW.getTime() + 60_000);
    const confirmed = await adminSetStatus(s, ADMIN, id, "confirmed", { now: LATER });
    assert.ok(confirmed.ok, JSON.stringify(confirmed));
    assert.equal(await slotState(s, LATER), "booked", "public calendar now shows the slot booked");
    assert.equal(toCustomerView((await getOwnBooking(s, A.uid, id))!, LATER).status, "confirmed", "customer sees it confirmed after refresh");
    assert.equal((await adminRows(s, LATER)).find((r) => r.bookingId === id)?.status, "confirmed");

    // 3. Admin records a payment (POST /api/admin/bookings/[id]/payments → recordPayment).
    const paid = await recordPayment(
      s,
      ADMIN,
      id,
      { amount: 100_000, method: "cash", paidOn: TODAY, reference: "", notes: "", requestKey: randomUUID() },
      { now: LATER, business: BUSINESS }
    );
    assert.ok(paid.ok, JSON.stringify(paid));
    const afterPay = (await getOwnBooking(s, A.uid, id))!;
    const summary = financialSummary(afterPay);
    assert.deepEqual([summary.status, summary.paid, summary.remaining], ["partially_paid", 100_000, 400_000], "admin finance overview figures");
    const customerView = toCustomerView(afterPay, LATER);
    assert.equal(customerView.payment.advanceReceived, 100_000, "customer sees the same paid amount");
    assert.equal(customerView.payment.balanceDue, 400_000);
    const ledger = await s.listPaymentsForBooking(id);
    assert.equal(ledger.length, 1);
    assert.equal(toCustomerPaymentView(ledger[0]).amount, 100_000, "receipt amount matches");

    // 4. Admin voids it (POST /api/admin/payments/[id]/void → voidPayment): every surface returns to unpaid.
    const voided = await voidPayment(s, ADMIN, paid.payment.paymentId, "Entered on the wrong booking", { now: LATER });
    assert.ok(voided.ok, JSON.stringify(voided));
    const afterVoid = (await getOwnBooking(s, A.uid, id))!;
    assert.deepEqual([financialSummary(afterVoid).status, financialSummary(afterVoid).paid], ["unpaid", 0]);
    assert.equal(toCustomerView(afterVoid, LATER).payment.advanceReceived, 0);
    assert.equal((await s.listPaymentsForBooking(id))[0].status, "voided", "the voided payment is kept, not deleted");

    // 5. "New session": a fresh read with the same identity sees the same record.
    const again = await listOwnBookings(s, { ...A }.uid);
    assert.equal(toCustomerView(again[0], LATER).status, "confirmed");
  });
});
