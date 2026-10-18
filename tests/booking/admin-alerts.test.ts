// Admin improvements, step 5: new-request alerts (in-app). In-memory store.
// Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { loadAlertSummary, markAlertsSeen } from "../../src/lib/booking/admin-alerts.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { DEFAULT_CONFIG } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const ADMIN2 = { uid: "admin-2", email: "admin2@example.test" };
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

async function request(s: MemoryBookingStore, uid: string, date: string, minutes: number) {
  const r = await createCustomerBookingRequest(s, { uid, email: null }, input({ date }), { now: at(minutes) });
  assert.ok(r.ok, JSON.stringify(r));
  return r.booking;
}

describe("admin new-request alerts", () => {
  it("counts pending + under review + open change requests, newest first, 'New' since the last visit", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, "c1", "2026-10-20", 0);
    const b = await request(s, "c2", "2026-10-21", 10);
    const c = await request(s, "c3", "2026-10-22", 20);
    assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, "under_review", { now: at(25) })).ok);
    assert.ok((await adminSetStatus(s, ADMIN, c.bookingId, "confirmed", { now: at(26) })).ok);
    const v = validateChangeRequest({ type: "cancellation", requestKey: randomUUID() }, "2026-10-01", DEFAULT_CONFIG);
    assert.ok(v.ok);
    const req = await submitChangeRequest(s, { uid: "c3" }, c.bookingId, v.value, { now: at(30) });
    assert.ok(req.ok);

    const first = await loadAlertSummary(s, ADMIN.uid);
    assert.deepEqual([first.count, first.pending, first.underReview, first.openRequests], [3, 1, 1, 1]);
    assert.equal(first.newCount, 3, "never visited: everything is new");
    assert.deepEqual(first.items.map((i) => [i.kind, i.bookingId]), [["request", c.bookingId], ["booking", b.bookingId], ["booking", a.bookingId]], "newest first");
    assert.equal(first.items[0].label, "Cancellation request");
    assert.equal(first.lastSeenAt, null);

    // The admin views the dashboard: marker moves up to the newest item shown.
    await markAlertsSeen(s, ADMIN, new Date(first.items[0].createdAt), { now: at(31) });
    const second = await loadAlertSummary(s, ADMIN.uid);
    assert.equal(second.count, 3, "count unchanged");
    assert.equal(second.newCount, 0, "markers cleared after viewing");
    assert.ok(second.items.every((i) => !i.isNew));

    // A new request after the visit is New again; another admin has their own marker.
    const d = await request(s, "c4", "2026-10-23", 40);
    const third = await loadAlertSummary(s, ADMIN.uid);
    assert.deepEqual([third.count, third.newCount, third.items[0].bookingId, third.items[0].isNew], [4, 1, d.bookingId, true]);
    assert.equal((await loadAlertSummary(s, ADMIN2.uid)).newCount, 4);
  });

  it("deciding a request removes it from the count", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, "c1", "2026-10-20", 0);
    assert.equal((await loadAlertSummary(s, ADMIN.uid)).count, 1);
    assert.ok((await adminSetStatus(s, ADMIN, a.bookingId, "rejected", { now: at(5) })).ok);
    const after = await loadAlertSummary(s, ADMIN.uid);
    assert.deepEqual([after.count, after.items.length], [0, 0]);
  });

  it("the marker never moves backwards and never past 'now'", async () => {
    const s = new MemoryBookingStore();
    const r1 = await markAlertsSeen(s, ADMIN, at(60), { now: at(10) });
    assert.equal(r1.lastSeenAt.getTime(), at(10).getTime(), "a future time is clamped to now");
    const r2 = await markAlertsSeen(s, ADMIN, at(5), { now: at(20) });
    assert.deepEqual([r2.changed, r2.lastSeenAt.getTime()], [false, at(10).getTime()]);
    const r3 = await markAlertsSeen(s, ADMIN, at(15), { now: at(20) });
    assert.deepEqual([r3.changed, r3.lastSeenAt.getTime()], [true, at(15).getTime()]);
    assert.equal((await s.getAdminState(ADMIN.uid))?.lastSeenAt?.getTime(), at(15).getTime());
    assert.equal(await s.getAdminState(ADMIN2.uid), null);
  });
});
