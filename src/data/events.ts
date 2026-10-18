// Sabor con Amor event / occasion catalog — NONE CONFIRMED YET.
// The reference project's categories and descriptions were removed in Phase 2.
// Add a category only when the business confirms it, with an approved photo
// from media/MEDIA_INVENTORY.md that actually shows that kind of event.
// Set `enabled: false` to hide a category without deleting it.

export interface EventCategory {
  slug: string;
  title: string;
  urduLabel?: string;
  description: string;
  image: string;
  imageAlt: string;
  enabled: boolean;
}

export const eventCategories: EventCategory[] = [];
