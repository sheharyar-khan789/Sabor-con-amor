// Admin improvements (steps 2–6) against the REAL Firestore adapter on the
// Firestore EMULATOR (never a real project): edit with a slot move, delete
// (booking + lock + requests), archive / restore, block / unblock, the new
// adminState and customerNotes collections, and the profile store's
// admin edit (profile + audit + notification in one transaction).
// Refuses to run without FIRESTORE_EMULATOR_HOST. Run: npm run test:booking:firestore
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreProfileStore } from "../../src/lib/account/firestore-profile-store.ts";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { markAlertsSeen } from "../../src/lib/booking/admin-alerts.ts";
import { adminDeleteBooking, adminSetArchived } from "../../src/lib/booking/admin-archive.ts";
import { blockSlots, unblockSlot } from "../../src/lib/booking/admin-blocks.ts";
import { adminSaveCustomerNotes, adminUpdateCustomerProfile } from "../../src/lib/booking/admin-customers.ts";
import { adminEditBooking } from "../../src/lib/booking/admin-edit.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { firestoreBookingStore } from "../../src/lib/booking/firestore-store.ts";
import { bookingReference, type BookingRecord } from "../../src/lib/booking/model.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { DEFAULT_CONFIG } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "../booking/engine-scenarios.ts";

const projectId = "demo-sabor-con-amor";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set; refusing to run against a real Firestore.");
const db = getFirestore(initializeApp({ projectId }, "admin-improvements-test"));
const ADMIN = { uid: "admin-1", email: "admin@example.test" };
let s: BookingStore;

beforeEach(async () => {
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not reset the emulator (${res.status})`);
  s = firestoreBookingStore(db);
});

const seen = (b: BookingRecord) => new Date(b.updatedAt).toISOString();
async function request(uid: string, over = {}) {
  const r = await createCustomerBookingRequest(s, { uid, email: null }, input(over), { now: NOW });
  assert.ok(r.ok, JSON.stringify(r));
  return r.booking;
}
const lock = async (key: string) => (await db.collection("slotLocks").doc(key).get()).data() ?? null;

describe("firestore emulator: admin improvements", () => {
  it("edit: moves date/slot in one transaction (new lock claimed, old released); a taken slot changes nothing", async () => {
    const a = await request("c1");
    const other = await request("c2", { date: "2026-11-06" });
    const taken = await adminEditBooking(s, ADMIN, a.bookingId, { date: "2026-11-06", guestCount: 300 }, { expectedUpdatedAt: seen(a), now: NOW });
    assert.deepEqual(taken, { ok: false, code: "slot_unavailable" });
    assert.equal((await s.getBooking(a.bookingId))?.guestCount, 400);
    const moved = await adminEditBooking(s, ADMIN, a.bookingId, { date: "2026-11-05", slotId: "night", contactName: "New Name" }, { expectedUpdatedAt: seen(a), now: NOW });
    assert.ok(moved.ok, JSON.stringify(moved));
    assert.equal(await lock(a.slotKey), null);
    assert.equal((await lock("2026-11-05__main-hall__night"))?.bookingId, a.bookingId);
    assert.equal((await lock(other.slotKey))?.bookingId, other.bookingId);
    const after = await s.getBooking(a.bookingId);
    assert.deepEqual([after?.slotKey, after?.customer.name], ["2026-11-05__main-hall__night", "New Name"]);
    assert.equal((await s.listAuditForBooking(a.bookingId, 5))[0].action, "booking_edited");
    assert.equal((await s.listNotificationsForBooking(a.bookingId, 10)).filter((n) => n.type === "BOOKING_UPDATED").length, 1);
  });

  it("delete: booking, its lock and its change requests go together; audit kept; refused when it isn't allowed", async () => {
    const a = await request("c1");
    const v = validateChangeRequest({ type: "cancellation", requestKey: randomUUID() }, "2026-10-01", DEFAULT_CONFIG);
    assert.ok(v.ok);
    assert.ok((await submitChangeRequest(s, { uid: "c1" }, a.bookingId, v.value, { now: NOW })).ok);
    const r = await adminDeleteBooking(s, ADMIN, a.bookingId, { expectedUpdatedAt: seen(a), confirmReference: bookingReference(a.bookingId), reason: "Test booking", now: NOW });
    assert.deepEqual(r, { ok: true, reference: bookingReference(a.bookingId), removedRequests: 1 });
    assert.equal(await s.getBooking(a.bookingId), null);
    assert.equal(await lock(a.slotKey), null);
    assert.equal((await s.listRequestsForBooking(a.bookingId)).length, 0);
    assert.equal((await s.listAuditForBooking(a.bookingId, 5))[0].action, "booking_deleted");

    const b = await request("c2", { date: "2026-11-07" });
    assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, "confirmed", { now: NOW })).ok);
    const confirmed = (await s.getBooking(b.bookingId))!;
    assert.deepEqual(
      await adminDeleteBooking(s, ADMIN, b.bookingId, { expectedUpdatedAt: seen(confirmed), confirmReference: bookingReference(b.bookingId), reason: "Test", now: NOW }),
      { ok: false, code: "not_deletable_status" }
    );
  });

  it("archive / restore keep the record; block / unblock through the slot lock", async () => {
    const a = await request("c1");
    assert.ok((await adminSetStatus(s, ADMIN, a.bookingId, "rejected", { now: NOW })).ok);
    const later = new Date(NOW.getTime() + 1000);
    assert.ok((await adminSetArchived(s, ADMIN, a.bookingId, true, { expectedUpdatedAt: seen((await s.getBooking(a.bookingId))!), now: later })).ok);
    const archived = (await s.getBooking(a.bookingId))!;
    assert.ok(archived.archivedAt instanceof Date);
    assert.ok((await adminSetArchived(s, ADMIN, a.bookingId, false, { expectedUpdatedAt: seen(archived), now: new Date(later.getTime() + 1000) })).ok);
    assert.equal((await s.getBooking(a.bookingId))?.archivedAt, null);

    const blocked = await blockSlots(s, ADMIN, { date: "2026-12-01", slot: "both", kind: "maintenance", reason: "Roof repair" }, { hallId: "main-hall", now: NOW });
    assert.ok(blocked.ok, JSON.stringify(blocked));
    assert.equal((await lock("2026-12-01__main-hall__day"))?.block?.reason, "Roof repair");
    assert.deepEqual(await createCustomerBookingRequest(s, { uid: "c9", email: null }, input({ date: "2026-12-01" }), { now: NOW }), { ok: false, code: "slot_unavailable" });
    const day = blocked.ok ? blocked.blocked.find((l) => l.slotId === "day")! : null;
    assert.deepEqual(await unblockSlot(s, ADMIN, day!.slotKey, day!.bookingId, { now: NOW }), { ok: true });
    assert.ok((await createCustomerBookingRequest(s, { uid: "c9", email: null }, input({ date: "2026-12-01" }), { now: NOW })).ok);
  });

  it("adminState and customerNotes; profile edit writes profile + audit + notification together", async () => {
    const m = await markAlertsSeen(s, ADMIN, NOW, { now: NOW });
    assert.ok(m.changed);
    assert.equal((await s.getAdminState(ADMIN.uid))?.lastSeenAt?.getTime(), NOW.getTime());

    const n = await adminSaveCustomerNotes(s, ADMIN, "cust-1", "Prefers calls", { expectedUpdatedAt: null, now: NOW });
    assert.ok(n.ok);
    assert.equal((await s.getCustomerNotes("cust-1"))?.notes, "Prefers calls");
    assert.deepEqual(await adminSaveCustomerNotes(s, ADMIN, "cust-1", "Again", { expectedUpdatedAt: null, now: NOW }), { ok: false, code: "stale" });

    const profiles = firestoreProfileStore(db);
    await profiles.ensure({ uid: "cust-1", email: "farah@example.test", emailVerified: true, signInProvider: "password", name: "Farah", photoURL: null });
    const before = (await profiles.get("cust-1"))!;
    const r = await adminUpdateCustomerProfile(profiles, ADMIN, "cust-1", { name: "Farah Khan", phone: "0301 2222222" }, { expectedUpdatedAt: before.updatedAt, now: NOW });
    assert.ok(r.ok, JSON.stringify(r));
    const after = (await profiles.get("cust-1"))!;
    assert.deepEqual([after.name, after.phone, after.email], ["Farah Khan", "0301 2222222", "farah@example.test"]);
    assert.equal((await s.listAuditForEntity("customer", "cust-1", 5)).filter((x) => x.action === "customer_profile_updated").length, 1);
    const notes = await s.listNotificationsForCustomer("cust-1", { before: null, limit: 10 });
    assert.equal(notes.filter((x) => x.type === "PROFILE_UPDATED").length, 1);
    assert.deepEqual(
      await adminUpdateCustomerProfile(profiles, ADMIN, "cust-1", { name: "Other", phone: null }, { expectedUpdatedAt: before.updatedAt, now: NOW }),
      { ok: false, code: "stale" }
    );
  });
});
