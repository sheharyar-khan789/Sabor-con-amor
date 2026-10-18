// Sabor con Amor gallery data — approved media only (media/MEDIA_INVENTORY.md).
// Every entry is a real Sabor con Amor photo or a frame extracted from the
// venue's own videos (the filename keeps the source timestamp, "_tNNNsNN").
// Captions describe only what the image visibly shows; no hall names,
// capacities or event types are claimed.
// width/height are the files' measured pixel dimensions.
//
// Deliberately NOT published (see the inventory): the frame marked "do not
// publish", frames with identifiable staff or guests (consent needed), frames
// with readable vehicle plates, and the roadside sign frames (they show a phone
// number that is not yet confirmed).

export type GalleryCategory = "all" | "interior" | "decoration" | "exterior" | "dining";

export interface GalleryItem {
  id: string;
  category: Exclude<GalleryCategory, "all">;
  title: string;
  caption: string;
  image: string;
  width: number;
  height: number;
  /** Shown in the curated home-page selection. */
  featured?: boolean;
}

export const galleryCategories: { key: GalleryCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "interior", label: "Hall & Lobby" },
  { key: "decoration", label: "Stage & Décor" },
  { key: "exterior", label: "Exterior" },
  { key: "dining", label: "Dining" },
];

export const categoryLabel: Record<GalleryItem["category"], string> = {
  interior: "Hall & Lobby",
  decoration: "Stage & Décor",
  exterior: "Exterior",
  dining: "Dining",
};

const PORTRAIT = { width: 576, height: 1024 } as const;

export const galleryItems: GalleryItem[] = [
  // HALL & LOBBY
  {
    id: "hall-aisle",
    category: "interior",
    title: "Hall Aisle",
    caption: "Rows of sofas along a central aisle beneath a crystal chandelier.",
    image: "/images/venue/hall_sofa-aisle-central-chandelier.jpg",
    width: 1079,
    height: 712,
    featured: true,
  },
  {
    id: "lobby",
    category: "interior",
    title: "Lobby",
    caption: "Marble floor, crystal chandeliers and floral arrangements by the staircase.",
    image: "/images/venue/lobby_marble-floral-chandeliers.jpg",
    width: 1280,
    height: 851,
    featured: true,
  },
  {
    id: "hall-dining-lounge",
    category: "interior",
    title: "Dining & Lounge Seating",
    caption: "Dining tables and lounge seating under a gilded ceiling.",
    image: "/images/venue/hall_wide-dining-and-lounge.jpg",
    width: 1079,
    height: 712,
  },
  {
    id: "hall-chandelier-row",
    category: "interior",
    title: "Chandeliers",
    caption: "A row of lit crystal chandeliers above planters.",
    image: "/images/venue/hall_chandelier-row-planters-night.jpg",
    width: 1079,
    height: 682,
  },
  {
    id: "hall-crystal-chandelier",
    category: "interior",
    title: "Crystal Chandelier",
    caption: "A long crystal chandelier over carved dining chairs.",
    image: "/images/venue/hall_crystal-chandelier-dining-chairs.jpg",
    width: 1079,
    height: 717,
  },
  {
    id: "hall-aisle-portrait",
    category: "interior",
    title: "Central Aisle",
    caption: "The central aisle, lined with sofas, under the main chandelier.",
    image: "/images/venue/frame_tour_hall-aisle-chandeliers_t014s63.jpg",
    ...PORTRAIT,
  },
  {
    id: "hall-wide",
    category: "interior",
    title: "Hall",
    caption: "Decorated columns and lounge seating across the hall.",
    image: "/images/venue/frame_tour_hall-wide-a_t029s90.jpg",
    ...PORTRAIT,
  },
  {
    id: "hall-lounge-tables",
    category: "interior",
    title: "Lounge Seating",
    caption: "Lounge seating with laid tables.",
    image: "/images/venue/frame_tour_hall-wide-b_t030s93.jpg",
    ...PORTRAIT,
  },
  {
    id: "hall-cream-sofas",
    category: "interior",
    title: "Sofas & Tables",
    caption: "Cream sofas around laid marble-top tables.",
    image: "/images/venue/frame_tour_lounge-sofa-seating_t020s47.jpg",
    ...PORTRAIT,
  },

  // STAGE & DÉCOR
  {
    id: "stage-floral",
    category: "decoration",
    title: "Floral Stage",
    caption: "A floral stage set with arches and teal sofas.",
    image: "/images/stage-decor/stage_floral-arches-teal-sofas.jpg",
    width: 1079,
    height: 712,
    featured: true,
  },
  {
    id: "stage-floral-portrait",
    category: "decoration",
    title: "Stage",
    caption: "The floral stage seen from the hall.",
    image: "/images/stage-decor/frame_tour_stage-floral-teal_t016s70.jpg",
    ...PORTRAIT,
  },
  {
    id: "ceiling",
    category: "decoration",
    title: "Ceiling",
    caption: "Ornate gilded ceiling with a crystal chandelier.",
    image: "/images/stage-decor/frame_tour_ceiling-chandelier_t018s47.jpg",
    ...PORTRAIT,
    featured: true,
  },
  {
    id: "horse-sculpture",
    category: "decoration",
    title: "Lobby Sculpture",
    caption: "A white and gold horse sculpture in the lobby.",
    image: "/images/stage-decor/frame_tour_decor-horse-sculpture_t008s53.jpg",
    ...PORTRAIT,
  },

  // EXTERIOR
  {
    id: "exterior-dusk",
    category: "exterior",
    title: "Building at Dusk",
    caption: "The building at dusk with its lit signs.",
    image: "/images/exterior/frame_tour_exterior-drone-dusk-b_t036s20.jpg",
    ...PORTRAIT,
    featured: true,
  },
  {
    id: "exterior-roof",
    category: "exterior",
    title: "Rooftop Sign",
    caption: "Aerial view of the roof and its lit sign.",
    image: "/images/exterior/frame_tour_exterior-drone-dusk-a_t033s63.jpg",
    ...PORTRAIT,
  },
  {
    id: "exterior-side",
    category: "exterior",
    title: "Upper Floors",
    caption: "Aerial view of the upper floors at dusk.",
    image: "/images/exterior/frame_tour_exterior-drone-approach_t003s57.jpg",
    ...PORTRAIT,
  },
  {
    id: "exterior-road",
    category: "exterior",
    title: "From the Road",
    caption: "Aerial view of the building beside the main road.",
    image: "/images/exterior/frame_event_exterior-drone-road-a_t044s53.jpg",
    ...PORTRAIT,
  },
  {
    id: "exterior-road-high",
    category: "exterior",
    title: "Aerial View",
    caption: "Higher aerial view showing the road approach.",
    image: "/images/exterior/frame_event_exterior-drone-road-b_t047s87.jpg",
    ...PORTRAIT,
  },

  // DINING
  {
    id: "table-setting",
    category: "dining",
    title: "Table Setting",
    caption: "A laid dining table with candles and flowers.",
    image: "/images/dining/frame_tour_dining-table-setting-a_t010s47.jpg",
    ...PORTRAIT,
  },
  {
    id: "table-setting-gold",
    category: "dining",
    title: "Dining Table",
    caption: "A laid dining table with gold chairs.",
    image: "/images/dining/frame_tour_dining-table-setting-b_t023s73.jpg",
    ...PORTRAIT,
  },
  {
    id: "desserts-logo-wall",
    category: "dining",
    title: "Dessert Service",
    caption: "Dessert bowls ready to serve in front of the Sabor con Amor logo wall.",
    image: "/images/dining/frame_event_food-desserts-logo-wall_t034s33.jpg",
    ...PORTRAIT,
    featured: true,
  },
];

export interface VideoItem {
  id: string;
  title: string;
  caption: string;
  src: string;
  poster: string;
  width: number;
  height: number;
}

// Portrait (9:16) films shown as "reels". None prepared yet: the supplied
// videos include an on-camera presenter, burnt-in text and identifiable
// guests, so clips must be cut and approved first (see IMPLEMENTATION_ROADMAP.md).
export const reels: VideoItem[] = [];
