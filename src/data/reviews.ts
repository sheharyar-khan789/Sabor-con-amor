// Sabor con Amor public reviews — NONE.
// The reference project's Google reviews (another venue, real reviewer names)
// were removed in Phase 2. Never invent testimonials. Add entries only from
// real, attributable reviews the business supplies and agrees to show.

export interface Review {
  author: string;
  rating: number; // out of 5
  text: string;
  context?: string; // e.g. what the reviewer selected (dining type)
}

export const reviews: Review[] = [];

/** Google's own listing summary, shown as a Google-attributed highlight. None yet. */
export const googleHighlights: string[] = [];
