import Image from "next/image";
import { business } from "@/lib/config";
import SectionHead from "./Section";
import Icon, { Stars } from "./Icon";

// Only verified facts: the three services named on the venue's own signage,
// plus a third-party rating once one is confirmed in config.ts.
const trust: { value: string; label: string; stars?: boolean }[] = [
  { value: "Banquet Hall", label: "Events & celebrations" },
  { value: "Restaurant", label: "Dining" },
  { value: "Rooftop BBQ", label: "Rooftop dining" },
  ...(business.rating !== null ? [{ value: `${business.rating}`, label: `Google rating · ${business.reviewCount} reviews`, stars: true }] : []),
];

export default function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="relative overflow-hidden bg-surface-low">
      {/* Trust strip */}
      <div className="border-b border-line bg-surface">
        <ul className="container-px mx-auto grid max-w-content grid-cols-2 lg:grid-cols-4">
          {trust.map((t, i) => (
            <li
              key={t.value}
              data-reveal
              data-reveal-delay={i * 80}
              className={`flex flex-col justify-center gap-2 py-8 sm:py-10 ${
                i % 2 === 1 ? "border-l border-line pl-5 sm:pl-8" : "pr-4"
              } ${i >= 2 ? "border-t border-line lg:border-t-0" : ""} ${
                i === 2 ? "lg:border-l lg:pl-8" : ""
              }`}
            >
              <span className="flex items-center gap-2 font-display text-[1.5rem] font-normal leading-none text-ink sm:text-[1.75rem]">
                {t.value}
                {t.stars && business.rating !== null && <Stars value={business.rating} className="h-3 w-3 text-gold" />}
              </span>
              <span className="text-label uppercase text-ink-muted">{t.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="container-px section-y mx-auto grid max-w-content items-center gap-16 grid-cols-1 lg:grid-cols-12 lg:gap-24">
        <div className="lg:col-span-5">
          <SectionHead
            id="about-title"
            eyebrow={`About ${business.name}`}
            title={
              <>
                Banquet hall, restaurant &amp; <em className="text-gold">rooftop BBQ</em>
              </>
            }
            intro={`${business.name} brings together a banquet hall, a restaurant and a rooftop BBQ in one building.`}
          />
          <div data-reveal data-reveal-delay="180" className="mt-11 flex flex-wrap items-center gap-x-10 gap-y-4">
            <a href="#venue" className="btn btn-primary">
              Explore the venue
              <Icon name="arrow" className="h-4 w-4" />
            </a>
            {business.googleMapsUrl && (
              <a
                href={business.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline inline-flex min-h-[44px] items-center gap-2 text-label font-semibold uppercase text-ink"
              >
                <Icon name="pin" className="h-4 w-4 text-gold" />
                Get directions
              </a>
            )}
          </div>
        </div>

        {/* Layered depth composition */}
        <div className="relative lg:col-span-7">
          <div className="relative mx-auto max-w-[560px] pb-16 pl-10 sm:pb-20 sm:pl-24 lg:ml-auto lg:mr-0">
            <div data-parallax="0.05" className="relative">
              <div
                data-reveal="depth"
                className="media-grade relative aspect-[4/5] rounded-lg bg-surface-high ring-1 ring-line"
              >
                <Image
                  src="/images/venue/frame_tour_hall-aisle-chandeliers_t014s63.jpg"
                  alt={`The central aisle and chandelier of the banquet hall at ${business.name}`}
                  fill
                  sizes="(min-width: 1024px) 460px, (min-width: 640px) 440px, 85vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div
              data-parallax="0.13"
              className="absolute bottom-0 left-0 w-[46%] max-w-[240px]"
            >
              <div
                data-reveal="depth"
                data-reveal-delay="150"
                className="media-grade relative aspect-[4/5] rounded-lg bg-surface-high ring-1 ring-line outline outline-[10px] outline-surface-low"
              >
                <Image
                  src="/images/venue/lobby_marble-floral-chandeliers.jpg"
                  alt="Floral arrangements and chandeliers in the lobby"
                  fill
                  sizes="240px"
                  className="object-cover"
                />
              </div>
            </div>
            <div data-parallax="0.09" className="absolute right-0 top-10 hidden sm:block">
              <div
                data-reveal
                data-reveal-delay="260"
                className="border-l border-gold/50 pl-4"
              >
                <p className="text-eyebrow font-medium uppercase text-gold">Interior</p>
                <p className="mt-1 font-display text-lg leading-tight text-[#f4f2ee] drop-shadow">Banquet hall</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
