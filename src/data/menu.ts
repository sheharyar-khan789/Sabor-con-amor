// Sabor con Amor menus — NONE CONFIRMED YET.
// The reference project's transcribed menu card was removed in Phase 2: it
// belonged to another venue. Add menus here only from Sabor con Amor's own,
// confirmed menu card (and add its scans under public/menu/ if they are shown).
// Never invent dishes or prices.

export interface MenuImage {
  src: string;
  width: number;
  height: number;
}

export interface MenuSet {
  id: string;
  title: string;
  items: string[];
  sheet?: number; // which printed sheet shows this menu
  /** This menu's own section of the printed card (cut from its sheet; no other menu on it). */
  image?: MenuImage;
}

export const weddingMenus: MenuSet[] = [];

export const mehndiMenus: MenuSet[] = [];

export const sweetsAndSides: MenuSet[] = [];

/**
 * The printed-card image for a configured menu, or null. Matched by the menu's
 * ID AND its printed title: if the venue renames a menu in Admin -> Settings, or
 * adds a new one, no (possibly wrong) printed image is shown for it.
 */
export function printedMenuImage(menu: { id: string; name: string }): MenuImage | null {
  const norm = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
  const set = [...weddingMenus, ...mehndiMenus].find((m) => m.id === menu.id);
  return set?.image && norm(set.title) === norm(menu.name) ? set.image : null;
}

export interface MenuSheet {
  src: string;
  title: string;
  alt: string;
  width: number;
  height: number;
}

/** Scans of the printed menu card, in the card's own order. None supplied yet. */
export const menuSheets: MenuSheet[] = [];

/** Downloadable menu card PDF, or null when none has been supplied. */
export const menuPdf: string | null = null;

// Terms & conditions: the venue terms live in ./policies.ts (single source);
// re-exported here for the existing menu / terms components.
export { OFFICIAL_VENUE_TERMS as terms } from "./policies.ts";
