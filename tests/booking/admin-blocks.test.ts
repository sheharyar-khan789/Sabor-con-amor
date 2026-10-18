// Admin improvements, step 4: blocked slots through the existing slot-lock
// mechanism. In-memory transactional store. Run: npm run test:booking
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminEditBooking } from "../../src/lib/booking/admin-edit.ts";
import { blockSlots, blocksOf, unblockSlot, validateBlockInput } from "../../src/lib/booking/admin-blocks.ts";
import { createCustomerBookingRequest, createManualBooking, getAvailability } from "../../src/lib/booking/engine.ts";
import { isBlockLock } from "../../src/lib/booking/model.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { input, NOW } from "./engine-scenarios.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const HALL = { hallId: "main-hall", now: NOW };
const DATE = "2026-10-20";
const block = (s: MemoryBookingStore, slot: "day" | "night" | "both", over: { date?: string; now?: Date } = {}) =>
  blockSlots(s, ADMIN, { date: over.date ?? DATE, slot, kind: "holiday", reason: "Eid holiday" }, { ...HALL, now: over.now ?? NOW });
const states = async (s: MemoryBookingStore, date = DATE, now = NOW) => {
  const a = await getAvailability(s, "main-hall", date, date, { now });
  assert.ok(a.ok);
  return Object.fromEntries(a.availability.days[0].slots.map((x) => [x.slotId, x.state]));
};

describe("admin blocked slots", () => {
  it("blocks Both: the public calendar shows them unavailable and customers / staff cannot book them", async () => {
    const s = new MemoryBookingStore();
    const r = await block(s, "both");
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(r.ok && r.blocked.length, 2);
    assert.deepEqual(await states(s), { day: "booked", night: "booked" });
    const a = await getAvailability(s, "main-hall", DATE, DATE, { now: NOW });
    assert.equal(a.ok && a.availability.days[0].status, "unavailable");
    assert.deepEqual(await createCustomerBookingRequest(s, { uid: "c1", email: null }, input(), { now: NOW }), { ok: false, code: "slot_unavailable" });
    const staff = await createManualBooking(s, ADMIN, { ...input({ slotId: "night" }), source: "walk_in", status: "confirmed", customerId: null, email: null }, { now: NOW });
    assert.deepEqual(staff, { ok: false, code: "slot_unavailable" });
    // Public data never carries the internal reason.
    assert.ok(!JSON.stringify(a).includes("Eid"));
    // Audited, one record per slot.
    for (const slot of ["day", "night"]) {
      const [audit] = await s.listAuditForEntity("slot", `${DATE}__main-hall__${slot}`, 5);
      assert.deepEqual([audit.action, audit.reason, audit.actor.uid], ["slot_blocked", "Eid holiday", ADMIN.uid]);
    }
  });

  it("refuses a slot with an active booking (and blocks nothing of a 'Both' request)", async () => {
    const s = new MemoryBookingStore();
    const b = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input({ slotId: "night" }), { now: NOW });
    assert.ok(b.ok);
    assert.deepEqual(await block(s, "night"), { ok: false, code: "slot_occupied", slotId: "night" });
    assert.deepEqual(await block(s, "both"), { ok: false, code: "slot_occupied", slotId: "night" });
    assert.deepEqual(await states(s), { day: "available", night: "held" }, "the free Day slot was not blocked either");
    assert.equal(blocksOf(s.allLocks()).length, 0);
  });

  it("an expired pending hold does not prevent blocking; that request is marked expired", async () => {
    const s = new MemoryBookingStore();
    const b = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input(), { now: NOW });
    assert.ok(b.ok);
    const later = new Date(NOW.getTime() + 49 * 3_600_000);
    const r = await block(s, "day", { now: later });
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal((await s.getBooking(b.booking.bookingId))?.status, "expired");
    assert.ok(isBlockLock(s.lockFor(b.booking.slotKey)!));
  });

  it("past dates, already-blocked slots and invalid input are refused", async () => {
    const s = new MemoryBookingStore();
    assert.deepEqual(await block(s, "day", { date: "2026-09-30" }), { ok: false, code: "past_date" });
    assert.ok((await block(s, "day")).ok);
    assert.deepEqual(await block(s, "day"), { ok: false, code: "already_blocked", slotId: "day" });
    assert.equal(validateBlockInput({ date: "2026-10-20", slot: "evening", kind: "holiday", reason: "x y z" }).ok, false);
    assert.equal(validateBlockInput({ date: "2026-10-20", slot: "day", kind: "party", reason: "x y z" }).ok, false);
    assert.equal(validateBlockInput({ date: "2026-10-20", slot: "day", kind: "holiday", reason: "x" }).ok, false);
    assert.equal(validateBlockInput({ date: "20-10-2026", slot: "day", kind: "holiday", reason: "Repairs" }).ok, false);
    assert.equal(validateBlockInput({ date: "2026-10-20", slot: "both", kind: "private_event", reason: "Owner's family event" }).ok, true);
  });

  it("unblock reopens the slot; a wrong / old block ID changes nothing", async () => {
    const s = new MemoryBookingStore();
    const r = await block(s, "day");
    assert.ok(r.ok);
    const lock = r.ok ? r.blocked[0] : null;
    assert.deepEqual(await unblockSlot(s, ADMIN, lock!.slotKey, "blk_000000000000000000000000", { now: NOW }), { ok: false, code: "not_blocked" });
    assert.equal((await states(s)).day, "booked");
    assert.deepEqual(await unblockSlot(s, ADMIN, lock!.slotKey, lock!.bookingId, { now: NOW }), { ok: true });
    assert.equal((await states(s)).day, "available");
    assert.ok((await createCustomerBookingRequest(s, { uid: "c1", email: null }, input(), { now: NOW })).ok, "bookable again");
    assert.deepEqual(await unblockSlot(s, ADMIN, lock!.slotKey, lock!.bookingId, { now: NOW }), { ok: false, code: "not_blocked" }, "a booking's lock is never removed by unblock");
  });

  it("an admin edit cannot move a booking into a blocked slot", async () => {
    const s = new MemoryBookingStore();
    const b = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input({ date: "2026-10-25" }), { now: NOW });
    assert.ok(b.ok);
    assert.ok((await block(s, "day")).ok);
    const r = await adminEditBooking(s, ADMIN, b.booking.bookingId, { date: DATE }, { expectedUpdatedAt: new Date(b.booking.updatedAt).toISOString(), now: NOW });
    assert.deepEqual(r, { ok: false, code: "slot_unavailable" });
  });
});
