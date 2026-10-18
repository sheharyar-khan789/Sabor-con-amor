import Image from "next/image";
import SectionHead from "./Section";
import Icon from "./Icon";

// Approved Sabor con Amor media only (src/data/gallery.ts captions). No
// capacity, size or service claims: those are unconfirmed and not published.
const spaces = [
  {
    title: "Stage",
    label: "Décor",
    caption: "A floral stage set with teal sofas.",
    image: "/images/stage-decor/frame_tour_stage-floral-teal_t016s70.jpg",
    alt: "Floral stage with teal sofas seen from the hall",
  },
  {
    title: "Lobby",
    label: "Arrival",
    caption: "Marble floor, crystal chandeliers and flowers by the staircase.",
    image: "/images/venue/lobby_marble-floral-chandeliers.jpg",
    alt: "Lobby with a marble floor, crystal chandeliers and floral arrangements",
  },
  {
    title: "Lounge Seating",
    label: "Hall",
    caption: "Cream sofas around laid marble-top tables.",
    image: "/images/venue/frame_tour_lounge-sofa-seating_t020s47.jpg",
    alt: "Cream sofas around laid tables in the hall",
  },
  {
    title: "Rooftop Sign",
    label: "Exterior",
    caption: "The roof and its lit sign at dusk.",
    image: "/images/exterior/frame_tour_exterior-drone-dusk-a_t033s63.jpg",
    alt: "Aerial view of the roof with its lit sign at dusk",
  },
];

export default function VenueShowcase() {
  return (
    <section id="venue" aria-labelledby="venue-title" className="section-y bg-surface-low">
      <div className="container-px mx-auto max-w-content">
        <div className="grid items-end gap-12 grid-cols-1 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-5 lg:pb-6">
            <SectionHead
              id="venue-title"
              eyebrow="The Venue"
              title={
                <>
                  Spaces made for <em className="text-gold">gathering</em>
                </>
              }
              intro="The banquet hall, stage décor, the lobby and the building itself — each photographed as it is."
            />
          </div>

          <figure data-reveal="depth" className="group relative lg:col-span-7">
            <div className="media-grade relative aspect-[16/10] rounded-lg bg-surface-high">
              <Image
                src="/images/venue/hall_wide-dining-and-lounge.jpg"
                alt="Banquet hall with dining tables and lounge seating under a gilded ceiling"
                fill
                sizes="(min-width: 1320px) 740px, (min-width: 1024px) 56vw, 100vw"
                className="object-cover transition-transform duration-[1600ms] ease-elegant group-hover:scale-[1.02]"
              />
              <div aria-hidden="true" className="absolute inset-0 z-[1] bg-gradient-to-t from-noir/90 via-noir/40 to-transparent" />
            </div>
            <figcaption className="absolute inset-x-0 bottom-0 z-[2] p-6 text-[#f4f2ee] sm:p-10">
              <p className="text-eyebrow font-medium uppercase text-gold-light">Banquet Hall</p>
              <p className="mt-3 max-w-md font-display text-2xl font-normal leading-tight sm:text-[2rem]">
                Dining tables and lounge seating under a gilded ceiling
              </p>
            </figcaption>
          </figure>
        </div>

        {/* Focusable so keyboard users can scroll the swipe row (it holds no links). */}
        <ul
          aria-label="Venue spaces"
          tabIndex={0}
          className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:mt-20 lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible lg:px-0"
        >
          {spaces.map((s, i) => (
            <li key={s.title} className="w-[78%] shrink-0 snap-start sm:w-[44%] lg:w-auto">
              <div data-reveal data-reveal-delay={i * 90}>
                <figure className="media-grade group relative aspect-[4/5] rounded-lg bg-surface-high">
                  <Image
                    src={s.image}
                    alt={s.alt}
                    fill
                    sizes="(min-width: 1024px) 300px, (min-width: 640px) 44vw, 78vw"
                    className="object-cover transition-transform duration-[1600ms] ease-elegant group-hover:scale-[1.02]"
                  />
                  <div aria-hidden="true" className="absolute inset-0 z-[1] bg-gradient-to-t from-noir/90 via-noir/25 to-transparent" />
                  <figcaption className="absolute inset-x-0 bottom-0 z-[2] p-6 text-[#f4f2ee]">
                    <p className="text-eyebrow font-medium uppercase text-gold-light">{s.label}</p>
                    <p className="mt-2 font-display text-2xl font-normal leading-tight">{s.title}</p>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-[#b9b6af]">{s.caption}</p>
                  </figcaption>
                </figure>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted lg:hidden" aria-hidden="true">
          <Icon name="arrow" className="h-3.5 w-3.5" />
          Swipe to explore
        </p>
      </div>
    </section>
  );
}
