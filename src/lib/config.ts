// ============================================================================
// CENTRAL BUSINESS CONFIGURATION
// ----------------------------------------------------------------------------
// Edit this file to update business-wide information across the entire site.
// Do not hardcode business details anywhere else — import from here instead.
//
// CONTENT STATUS KEY (see comments on each field):
//   CONFIRMED     -> verified from Sabor con Amor (signage or the business itself)
//   NOT CONFIRMED -> null/empty and hidden until the business confirms it
//   PLACEHOLDER -> safe default, easy to edit, not presented as verified fact
// ============================================================================

// ----------------------------------------------------------------------------
// SABOR CON AMOR — Phase 2: the reference venue's contact details, rating,
// map link, social accounts, feature list and media were removed. Fields the
// business has not confirmed are null/empty, and every component hides them
// when absent. Fill them in only from confirmed Sabor con Amor information.
// ----------------------------------------------------------------------------

// PLACEHOLDER — the production domain is not confirmed. The fallback uses the
// reserved ".invalid" TLD so it can never point at a real site. It is kept in
// this one place so metadata, canonical URLs, sitemap, robots and structured
// data all change together. Set the real domain at build time with
// NEXT_PUBLIC_SITE_URL (e.g. "https://example.com", no trailing slash).
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
export const siteUrl =
  configuredSiteUrl && /^https:\/\/[a-z0-9.-]+$/i.test(configuredSiteUrl) ? configuredSiteUrl : "https://sabor-con-amor.invalid";

export interface PhoneEntry {
  display: string;
  href: string;
}

function toPhone(raw: string): PhoneEntry {
  return { display: raw.replace(/(\d{4})(\d+)/, "$1 $2"), href: `tel:${raw}` };
}

export const business = {
  // CONFIRMED — name as shown on the venue's lit signage.
  name: "Sabor con Amor",
  shortName: "Sabor con Amor",
  // From the venue's roadside sign ("TASTE WITH LOVE"); confirm wording with the business.
  tagline: "Taste with love",

  // NOT CONFIRMED — business call numbers (plain tel: links). First is the
  // "primary" number for compact UI. Empty until the business confirms them.
  // Use toPhone("03XXXXXXXXX") per number.
  phones: [] as PhoneEntry[],
  get phoneDisplay(): string | null {
    return this.phones[0]?.display ?? null;
  },
  get phoneHref(): string | null {
    return this.phones[0]?.href ?? null;
  },

  // NOT CONFIRMED — WhatsApp number that receives inquiries, international
  // format without "+". Every WhatsApp link/button reads it via lib/whatsapp.ts
  // and is hidden while it is null.
  whatsappNumber: null as string | null,
  get whatsappHref(): string | null {
    return this.whatsappNumber ? `https://wa.me/${this.whatsappNumber}` : null;
  },

  // NOT CONFIRMED — postal address.
  addressLine1: null as string | null,
  addressLine2: null as string | null,
  get fullAddress(): string | null {
    const parts = [this.addressLine1, this.addressLine2].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  },

  // NOT CONFIRMED — third-party (Google) rating. Hidden while null.
  rating: null as number | null,
  reviewCount: null as number | null,

  // NOT CONFIRMED — Google Maps link.
  googleMapsUrl: null as string | null,

  // NOT CONFIRMED — social accounts (hidden while null).
  social: {
    instagram: null as string | null,
    facebook: null as string | null,
    tiktok: null as string | null,
    tiktokHandle: null as string | null,
  },

  copyrightYear: new Date().getFullYear(),
};

/** Venue features (amenities). None confirmed yet. */
export const venueFeatures: string[] = [];

/** Builds a phone entry for `business.phones` from a raw local number. */
export { toPhone };

// ----------------------------------------------------------------------------
// CORE MEDIA PATHS — approved Sabor con Amor media under /public/images
// (copied from media/04_website_ready; see media/MEDIA_INVENTORY.md).
// null = not available yet; components hide or fall back.
// ----------------------------------------------------------------------------
export const media = {
  /** No logo file supplied yet (inventory: missing media). */
  logo: null as string | null,
  /** Desktop hero still: the hall aisle photo (landscape, 1079×712). */
  hero: "/images/venue/hall_sofa-aisle-central-chandelier.jpg",
  heroWidth: 1079,
  heroHeight: 712,
  /**
   * Portrait hero film. No approved clip has been cut yet (the recommended
   * drone segment of the tour video is a later-phase task), so the hero shows
   * its poster still instead.
   */
  heroStageVideo: null as string | null,
  /** Portrait hero still: the building at dusk (frame from the tour video, 576×1024). */
  heroStagePoster: "/images/exterior/frame_tour_exterior-drone-dusk-b_t036s20.jpg",
  heroStagePosterWidth: 576,
  heroStagePosterHeight: 1024,
  /** Location-section film. None approved yet; the poster still is shown. */
  aerialVideo: null as string | null,
  aerialPoster: "/images/exterior/frame_event_exterior-drone-road-b_t047s87.jpg",
};
