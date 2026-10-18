import Image from "next/image";
import { eventCategories } from "@/data/events";
import { business } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import BookNowButton from "./BookNowButton";
import SectionHead from "./Section";
import Icon from "./Icon";

export default function Events() {
  const events = eventCategories.filter((e) => e.enabled);
  // Hidden until the business confirms its event categories (src/data/events.ts).
  if (events.length === 0) return null;

  return (
    <section id="events" aria-labelledby="events-title" className="bg-surface-low section-y">
      <div className="container-px mx-auto max-w-content">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHead
            id="events-title"
            eyebrow="Occasions"
            title={
              <>
                For every family <em className="text-gold">milestone</em>
              </>
            }
            intro={`Celebrations and gatherings at ${business.name}.`}
          />
          <div data-reveal data-reveal-delay="120" className="shrink-0">
            <BookNowButton className="btn btn-primary">
              Book Your Event
              <Icon name="arrow" className="h-4 w-4" />
            </BookNowButton>
          </div>
        </div>

        <ul
          aria-label="Event types"
          className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:mt-16 lg:grid lg:grid-cols-3 lg:gap-x-6 lg:gap-y-12 lg:overflow-visible lg:px-0"
        >
          {events.map((e, i) => (
            <li key={e.slug} className="w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-auto">
              <article data-reveal data-reveal-delay={(i % 3) * 90} className="group flex h-full flex-col">
                <div
                  data-tilt
                  className="media-grade relative aspect-[4/5] rounded-lg bg-surface-high"
                >
                  <Image
                    src={e.image}
                    alt={e.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 400px, (min-width: 640px) 46vw, 80vw"
                    className="object-cover transition-transform duration-[1600ms] ease-elegant group-hover:scale-[1.02]"
                  />
                  <div aria-hidden="true" className="absolute inset-0 z-[1] bg-gradient-to-t from-noir/70 via-transparent to-transparent" />
                  {e.urduLabel && (
                    <span lang="ur" dir="rtl" className="absolute bottom-4 right-5 z-[2] text-xl text-[#f4f2ee] drop-shadow">
                      {e.urduLabel}
                    </span>
                  )}
                  <span className="absolute left-5 top-5 z-[2] font-display text-sm italic text-white/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex flex-1 flex-col pt-6">
                  <h3 className="font-display text-[1.875rem] font-normal leading-tight text-ink">{e.title}</h3>
                  <p className="mt-3 flex-1 text-[0.9375rem] leading-[1.7] text-ink-soft">{e.description}</p>
                  {getWhatsAppUrl() && (
                    <a
                      href={
                        getWhatsAppUrl(
                          `Assalam o Alaikum, I am interested in booking ${business.name} for a ${e.title} event. Please share availability.`
                        ) ?? undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex min-h-[44px] items-center self-start text-label font-semibold uppercase text-ink-muted underline decoration-line-strong/60 underline-offset-[6px] transition-colors hover:text-ink hover:decoration-ink"
                    >
                      Inquire about {e.title.toLowerCase()}
                    </a>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
