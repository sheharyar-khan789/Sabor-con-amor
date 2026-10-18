// ============================================================================
// VENUE TERMS — single source.
// ----------------------------------------------------------------------------
// Shown on the public "Booking terms" sheet, in the booking review, on the
// customer's booking page, in Admin → Settings → Policies (read-only) and
// copied into every NEW quotation (historical quotations keep what they were
// issued with).
//
// SABOR CON AMOR: NO TERMS CONFIRMED YET. The reference venue's printed policy
// card was removed in Phase 2. Add terms only from Sabor con Amor's own,
// confirmed policies; do not add or reword a term without the venue's
// confirmation. Pricing rules (e.g. a guest surcharge or service charge) are
// configured separately in the business configuration's `pricing` section.
// Pure data: safe for server and client code.
// ============================================================================

export interface VenueTerm {
  title: string;
  body: string;
}

export const OFFICIAL_VENUE_TERMS: VenueTerm[] = [];
