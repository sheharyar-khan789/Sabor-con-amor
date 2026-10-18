// Venue terms and pricing rules: the single terms source, the guest surcharge
// and service charge applied by the ONE pricing engine (quote()), and the terms
// copied into new quotations (old quotations unchanged).
//
// Phase 2 (Sabor con Amor): the reference venue's printed policy card was
// removed, so no terms or pricing rules are configured by default. The
// surcharge / service-charge values and the terms below are TEST FIXTURES that
// exercise the same engine behaviour; they are not Sabor con Amor's policies.
// IN-MEMORY transactional store (not Firestore). Run: npm run test:booking
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { OFFICIAL_VENUE_TERMS, type VenueTerm } from "../../src/data/policies.ts";
import { terms as menuTerms } from "../../src/data/menu.ts";
import { quotationPdf } from "../../src/lib/booking/documents-pdf.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { generateQuotation } from "../../src/lib/booking/finance.ts";
import type { BusinessSnapshot } from "../../src/lib/booking/finance-model.ts";
import { quote } from "../../src/lib/booking/pricing.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { DEFAULT_CONFIG, type BusinessConfig } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const BUSINESS: BusinessSnapshot = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };
/** TEST FIXTURE pricing rules (below 300 guests: +300 per guest; 5% service charge) + test base prices. */
const RULES: BusinessConfig = {
  ...structuredClone(DEFAULT_CONFIG),
  pricing: {
    ...DEFAULT_CONFIG.pricing,
    hallRent: { "main-hall": 100_000 },
    perGuestRate: 1_000,
    smallEventSurcharge: { belowGuests: 300, perGuest: 300 },
    serviceChargePercent: 5,
  },
};
const FIXTURE_TERMS: VenueTerm[] = [
  { title: "Test term one", body: "First fixture term." },
  { title: "Test term two", body: "Second fixture term." },
];
const req = (guestCount: number) => ({ hallId: "main-hall", guestCount, serviceIds: [], menuId: null, packageId: null });

describe("venue terms", () => {
  it("one source: the public terms sheet re-exports the same list", () => {
    assert.equal(menuTerms, OFFICIAL_VENUE_TERMS);
  });

  it("the defaults invent no pricing rules or prices (Pricing pending)", () => {
    assert.equal(DEFAULT_CONFIG.pricing.smallEventSurcharge, null, "no guest surcharge invented");
    assert.equal(DEFAULT_CONFIG.pricing.serviceChargePercent, null, "no service charge invented");
    assert.equal(DEFAULT_CONFIG.pricing.advance, null);
    assert.equal(DEFAULT_CONFIG.pricing.hallRent["main-hall"], null, "no base price invented");
    assert.equal(DEFAULT_CONFIG.pricing.perGuestRate, null, "no base price invented");
    assert.equal(quote(DEFAULT_CONFIG, req(250), NOW).status, "unpriced", "without base prices: Pricing pending");
  });
});

describe("guest surcharge and service charge through quote()", () => {
  it("below the threshold: + surcharge per guest; then the service charge", () => {
    const q = quote(RULES, req(250), NOW);
    assert.equal(q.status, "priced");
    if (q.status !== "priced") return;
    const surcharge = q.snapshot.lines.find((l) => l.code === "small_event_surcharge");
    assert.deepEqual([surcharge?.quantity, surcharge?.unitAmount, surcharge?.amount], [250, 300, 75_000]);
    assert.equal(q.snapshot.subtotal, 100_000 + 250 * 1_000 + 75_000);
    assert.equal(q.snapshot.serviceCharge, Math.round((425_000 * 5) / 100));
    assert.equal(q.snapshot.total, 425_000 + 21_250);
  });

  it("at or above the threshold: no guest surcharge (the service charge still applies)", () => {
    for (const guests of [300, 450]) {
      const q = quote(RULES, req(guests), NOW);
      assert.ok(q.status === "priced");
      if (q.status !== "priced") return;
      assert.equal(q.snapshot.lines.some((l) => l.code === "small_event_surcharge"), false, String(guests));
      assert.equal(q.snapshot.serviceCharge, Math.round((q.snapshot.subtotal * 5) / 100));
    }
  });
});

describe("terms in quotations", () => {
  it("a NEW quotation carries a copy of the venue terms and its PDF renders; an older one without terms still renders", async () => {
    // The venue has no confirmed terms yet, so fixture terms are placed in the
    // single source for this test only and removed afterwards.
    const saved = OFFICIAL_VENUE_TERMS.splice(0, OFFICIAL_VENUE_TERMS.length, ...FIXTURE_TERMS);
    try {
      const s = new MemoryBookingStore();
      const r = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input({ date: "2026-10-15", guestCount: 250 }), { now: NOW, config: RULES });
      assert.ok(r.ok, JSON.stringify(r));
      const g = await generateQuotation(s, ADMIN, r.booking.bookingId, { now: NOW, config: RULES, business: BUSINESS });
      assert.ok(g.ok, JSON.stringify(g));
      const snap = g.quotation.snapshot;
      assert.deepEqual(snap.terms, FIXTURE_TERMS);
      assert.notEqual(snap.terms, OFFICIAL_VENUE_TERMS, "a copy, not a live reference");
      const withTerms = await PDFDocument.load(await quotationPdf(g.quotation, null));
      const { terms: _old, ...legacy } = snap;
      void _old;
      const without = await PDFDocument.load(await quotationPdf({ ...g.quotation, snapshot: legacy }, null));
      assert.ok(withTerms.getPageCount() >= without.getPageCount() && without.getPageCount() >= 1);
    } finally {
      OFFICIAL_VENUE_TERMS.splice(0, OFFICIAL_VENUE_TERMS.length, ...saved);
    }
  });
});
