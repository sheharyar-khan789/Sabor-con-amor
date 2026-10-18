import Image from "next/image";
import { highlights } from "@/data/highlights";
import { venueFeatures } from "@/lib/config";
import SectionHead from "./Section";
import Icon, { type IconName } from "./Icon";

const icons: IconName[] = ["dining", "groups", "parking", "light"];

export default function Amenities() {
  // Hidden until confirmed highlights or features exist (src/data/highlights.ts, config.ts).
  if (highlights.length === 0 && venueFeatures.length === 0) return null;
  return (
    <section id="amenities" aria-labelledby="amenities-title" className="overflow-hidden bg-band py-20 text-white sm:py-28 lg:py-36">
      <div className="container-px mx-auto grid max-w-content items-center gap-14 grid-cols-1 lg:grid-cols-12 lg:gap-20">
        <div className="relative order-2 lg:order-1 lg:col-span-5">
          <div data-parallax="0.06" className="relative mx-auto max-w-[420px]">
            <div
              data-reveal="depth"
              className="media-grade relative aspect-[4/5] rounded-lg bg-noir-700"
            >
              <Image
                src="/images/stage-decor/frame_tour_ceiling-chandelier_t018s47.jpg"
                alt="Gilded ceiling with a crystal chandelier"
                fill
                sizes="(min-width: 1024px) 420px, 90vw"
                className="object-cover"
              />
            </div>
            <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-xl border border-white/[0.08]" />
          </div>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-7">
          <SectionHead
            id="amenities-title"
            tone="dark"
            eyebrow="Amenities"
            title={
              <>
                Comfort, service &amp; <em className="text-gold-light">easy access</em>
              </>
            }
            intro="The essentials families ask about first."
          />

          <ol className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {highlights.map((h, i) => (
              <li
                key={h.number}
                data-reveal
                data-reveal-delay={i * 80}
                className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 py-6 sm:grid-cols-[3rem_auto_1fr] sm:items-baseline sm:gap-x-6"
              >
                <span className="hidden font-display text-lg italic text-gold-light sm:block">{h.number}</span>
                <span className="row-span-2 mt-0.5 grid h-11 w-11 place-items-center rounded-full border border-gold-light/40 bg-white/5 text-gold-light sm:row-span-1 sm:mt-0">
                  <Icon name={icons[i % icons.length]} className="h-5 w-5" />
                </span>
                <div className="sm:col-start-3">
                  <h3 className="font-display text-2xl leading-tight text-white">{h.title}</h3>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-white/70">{h.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <ul aria-label="Venue features" data-reveal className="mt-8 flex flex-wrap gap-2">
            {venueFeatures.map((f) => (
              <li key={f} className="rounded-md border border-white/10 px-4 py-2 text-[0.8125rem] font-medium text-white/85">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
