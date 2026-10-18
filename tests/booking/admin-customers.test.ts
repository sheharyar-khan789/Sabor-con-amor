// Admin improvements, step 6: customer profile edit + internal notes.
// In-memory stores (profile store linked to the booking store, as in E2E mode).
// Run: npm run test:booking
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryProfileStore } from "../../src/lib/account/profile.ts";
import { adminSaveCustomerNotes, adminUpdateCustomerProfile } from "../../src/lib/booking/admin-customers.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { toCustomerView } from "../../src/lib/booking/portal.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { input, NOW } from "./engine-scenarios.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const UPDATED = "2026-09-01T10:00:00.000Z";

function stores() {
  const bookings = new MemoryBookingStore();
  const profiles = new MemoryProfileStore();
  profiles.linkSideWrites((audit, notification) =>
    bookings.runTransaction(async (tx) => {
      tx.createAudit(audit);
      tx.createNotification(notification);
    })
  );
  profiles.seed([{ uid: "cust-1", email: "farah@example.test", name: "Farah", phone: "0300 1111111", authProvider: "password", emailVerified: true, updatedAt: UPDATED }]);
  return { bookings, profiles };
}

describe("admin customer profile edit", () => {
  it("edits name and phone (never the sign-in email); audited; the customer is notified", async () => {
    const { bookings, profiles } = stores();
    const r = await adminUpdateCustomerProfile(profiles, ADMIN, "cust-1", { name: "Farah Khan", phone: "0301 2222222" }, { expectedUpdatedAt: UPDATED, now: NOW });
    assert.ok(r.ok, JSON.stringify(r));
    assert.deepEqual(r.ok && r.changed, ["name", "phone"]);
    const p = await profiles.get("cust-1");
    assert.deepEqual([p?.name, p?.phone, p?.email, p?.emailVerified], ["Farah Khan", "0301 2222222", "farah@example.test", true]);
    const [audit] = await bookings.listAuditForEntity("customer", "cust-1", 5);
    assert.deepEqual([audit.action, audit.before?.name, audit.after?.name, audit.after?.phone], ["customer_profile_updated", "Farah", "Farah Khan", "0301 2222222"]);
    const n = bookings.allNotifications().find((x) => x.type === "PROFILE_UPDATED");
    assert.equal(n?.customerId, "cust-1");
    assert.equal(n?.actionUrl, "/account/profile");
    assert.match(n!.message, /name and phone number/);
  });

  it("refused: stale page, no change, invalid values, unknown customer — nothing changes", async () => {
    const { bookings, profiles } = stores();
    assert.deepEqual(await adminUpdateCustomerProfile(profiles, ADMIN, "cust-1", { name: "X Y", phone: null }, { expectedUpdatedAt: "2020-01-01T00:00:00.000Z" }), { ok: false, code: "stale" });
    assert.deepEqual(await adminUpdateCustomerProfile(profiles, ADMIN, "cust-1", { name: "Farah", phone: "0300 1111111" }, { expectedUpdatedAt: UPDATED }), { ok: false, code: "no_change" });
    const bad = await adminUpdateCustomerProfile(profiles, ADMIN, "cust-1", { name: "F", phone: "12" }, { expectedUpdatedAt: UPDATED });
    assert.equal(!bad.ok && bad.code, "invalid_request");
    assert.ok(!bad.ok && bad.fields?.name && bad.fields?.phone);
    assert.deepEqual(await adminUpdateCustomerProfile(profiles, ADMIN, "nobody", { name: "Some One", phone: null }, { expectedUpdatedAt: null }), { ok: false, code: "not_found" });
    assert.deepEqual(await adminUpdateCustomerProfile(profiles, ADMIN, "../x", { name: "Some One", phone: null }, { expectedUpdatedAt: null }), { ok: false, code: "not_found" });
    assert.equal((await profiles.get("cust-1"))?.name, "Farah");
    assert.equal((await bookings.listAuditForEntity("customer", "cust-1", 5)).length, 0);
    // A second edit from the same (now old) page is refused.
    assert.ok((await adminUpdateCustomerProfile(profiles, ADMIN, "cust-1", { name: "Farah K", phone: null }, { expectedUpdatedAt: UPDATED })).ok);
    assert.deepEqual(await adminUpdateCustomerProfile(profiles, ADMIN, "cust-1", { name: "Farah Z", phone: null }, { expectedUpdatedAt: UPDATED }), { ok: false, code: "stale" });
  });
});

describe("admin internal customer notes", () => {
  it("saved and audited (lengths only); never part of what the customer sees", async () => {
    const { bookings } = stores();
    const b = await createCustomerBookingRequest(bookings, { uid: "cust-1", email: null }, input(), { now: NOW });
    assert.ok(b.ok);
    const r = await adminSaveCustomerNotes(bookings, ADMIN, "cust-1", "Prefers calls after 6 pm. VIP family.", { expectedUpdatedAt: null, now: NOW });
    assert.ok(r.ok);
    assert.equal((await bookings.getCustomerNotes("cust-1"))?.notes, "Prefers calls after 6 pm. VIP family.");
    const [audit] = await bookings.listAuditForEntity("customer", "cust-1", 5);
    assert.deepEqual([audit.action, audit.before?.notesLength, audit.after?.notesLength], ["customer_notes_updated", 0, 37]);
    assert.ok(!JSON.stringify(audit).includes("VIP"), "the note text is not copied into the audit trail");
    // Customer-facing data: the booking view and notifications never contain it.
    const view = toCustomerView((await bookings.getBooking(b.booking.bookingId))!, NOW);
    assert.ok(!JSON.stringify(view).includes("VIP"));
    assert.ok(!JSON.stringify(bookings.allNotifications()).includes("VIP"));
    assert.ok(!bookings.allNotifications().some((n) => n.type === "PROFILE_UPDATED"), "internal notes don't notify the customer");
  });

  it("stale and invalid notes are refused", async () => {
    const { bookings } = stores();
    const first = await adminSaveCustomerNotes(bookings, ADMIN, "cust-1", "One", { expectedUpdatedAt: null, now: NOW });
    assert.ok(first.ok);
    assert.deepEqual(await adminSaveCustomerNotes(bookings, ADMIN, "cust-1", "Two", { expectedUpdatedAt: null, now: NOW }), { ok: false, code: "stale" });
    assert.ok((await adminSaveCustomerNotes(bookings, ADMIN, "cust-1", "Two", { expectedUpdatedAt: first.ok ? first.updatedAt : null, now: new Date(NOW.getTime() + 1000) })).ok);
    assert.deepEqual(await adminSaveCustomerNotes(bookings, ADMIN, "cust-1", "x".repeat(4001), { expectedUpdatedAt: null }), { ok: false, code: "invalid_notes" });
    assert.deepEqual(await adminSaveCustomerNotes(bookings, ADMIN, "cust-1", 42, { expectedUpdatedAt: null }), { ok: false, code: "invalid_notes" });
  });
});
