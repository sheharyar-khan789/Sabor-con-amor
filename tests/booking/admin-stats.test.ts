// Admin improvements, step 7: booking statistics (counts only, no money) on a
// known in-memory data set. Run: npm run test:booking
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { blockSlots } from "../../src/lib/booking/admin-blocks.ts";
import { computeBookingStats, computeOccupancy, parseStatsRange } from "../../src/lib/booking/admin-stats.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import type { BookingStatus } from "../../src/lib/booking/status.ts";
import { input, NOW } from "./engine-scenarios.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const SLOTS = [{ id: "day", label: "Day" }, { id: "night", label: "Night" }];
const TODAY = "2026-10-01";

// [date, slot, event type, final status]
const DATA: [string, "day" | "night", string, BookingStatus][] = [
  ["2026-10-05", "day", "walima", "confirmed"],
  ["2026-10-05", "night", "barat", "confirmed"],
  ["2026-10-12", "night", "walima", "cancelled"],
  ["2026-10-20", "day", "mehndi", "pending"],
  ["2026-11-02", "night", "walima", "confirmed"],
  ["2026-11-09", "day", "barat", "rejected"],
  ["2026-11-15", "night", "barat", "under_review"],
  ["2027-01-10", "day", "walima", "confirmed"],
];

async function seed() {
  const s = new MemoryBookingStore();
  let n = 0;
  for (const [date, slotId, eventTypeId, status] of DATA) {
    const r = await createCustomerBookingRequest(s, { uid: `c${n++}`, email: null }, input({ date, slotId, eventTypeId }), { now: NOW });
    assert.ok(r.ok, JSON.stringify(r));
    if (status === "cancelled") assert.ok((await adminSetStatus(s, ADMIN, r.booking.bookingId, "confirmed", { now: NOW })).ok);
    if (status !== "pending") assert.ok((await adminSetStatus(s, ADMIN, r.booking.bookingId, status, { now: NOW })).ok);
  }
  return s;
}
const all = (s: MemoryBookingStore) => s.listBookingsInRange({ from: "2026-01-01", to: "2027-12-31", limit: 100 });

describe("admin booking stats (no money)", () => {
  it("counts, confirmed vs cancelled, per month, Day vs Night and event types", async () => {
    const s = await seed();
    const st = computeBookingStats(await all(s), { from: "2026-10-01", to: "2026-12-31" }, SLOTS);
    assert.equal(st.total, 7, "the January booking is outside the range");
    assert.deepEqual(st.byStatus, { pending: 1, under_review: 1, confirmed: 3, completed: 0, cancelled: 1, rejected: 1, expired: 0 });
    assert.deepEqual([st.confirmed, st.cancelled], [3, 1]);
    assert.equal(st.cancellationRate, 0.25);
    assert.deepEqual(st.perMonth, [
      { month: "2026-10", total: 4, booked: 2 },
      { month: "2026-11", total: 3, booked: 1 },
      { month: "2026-12", total: 0, booked: 0 },
    ]);
    assert.deepEqual(st.slotUsage.map((x) => [x.slotId, x.count]), [["day", 1], ["night", 2]]);
    assert.deepEqual(st.byEventType.map((t) => [t.id, t.total, t.booked]), [["barat", 3, 1], ["walima", 3, 2], ["mehndi", 1, 0]]);
    assert.ok(!/"(pricing|payment|amount|advance\w*|balance\w*|revenue|paid)"/i.test(JSON.stringify(st)), "no money fields in the stats");
  });

  it("empty range and default range", async () => {
    const s = await seed();
    const st = computeBookingStats(await all(s), { from: "2025-01-01", to: "2025-02-28" }, SLOTS);
    assert.deepEqual([st.total, st.cancellationRate, st.perMonth.length], [0, null, 2]);
    assert.deepEqual(parseStatsRange({}, TODAY), { from: "2026-04-01", to: "2027-10-01" }, "last 6 months and next 12");
    assert.deepEqual(parseStatsRange({ from: "2027-01-01", to: "2026-01-01" }, TODAY), { from: "2026-01-01", to: "2027-01-01" }, "reversed dates are swapped");
    const long = parseStatsRange({ from: "2020-01-01", to: "2030-01-01" }, TODAY);
    assert.equal(long.to, "2022-01-01", "bounded to two years");
  });

  it("occupancy for the next 30 / 60 / 90 days: booked vs on hold vs blocked", async () => {
    const s = await seed();
    assert.ok((await blockSlots(s, ADMIN, { date: "2026-10-25", slot: "both", kind: "holiday", reason: "Closed" }, { hallId: "main-hall", now: NOW })).ok);
    const occ = computeOccupancy(s.allLocks(), TODAY, ["day", "night"], NOW);
    // 30 days (Oct 1–30): booked Oct 5 day + night = 2; held Oct 20 pending = 1; blocked Oct 25 ×2.
    assert.deepEqual(occ[0], { days: 30, slots: 60, booked: 2, held: 1, blocked: 2, free: 55, occupancy: 2 / 60 });
    // 60 days (to Nov 29): + Nov 2 night booked, + Nov 15 under review held.
    assert.deepEqual([occ[1].slots, occ[1].booked, occ[1].held, occ[1].blocked], [120, 3, 2, 2]);
    // 90 days (to Dec 29): the January booking is outside.
    assert.deepEqual([occ[2].slots, occ[2].booked], [180, 3]);
    // Released slots (cancelled / rejected) are free.
    assert.equal(occ[0].booked + occ[0].held + occ[0].blocked + occ[0].free, occ[0].slots);
  });
});
