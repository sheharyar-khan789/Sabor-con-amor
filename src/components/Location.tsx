import Image from "next/image";
import { business, media } from "@/lib/config";
import { getWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";
import AmbientVideo from "./AmbientVideo";
import SectionHead from "./Section";
import Icon, { TikTokGlyph, WhatsAppGlyph } from "./Icon";

export default function Location() {
  const whatsappUrl = getWhatsAppUrl(
    `Assalam o Alaikum, I would like to inquire about visiting ${business.name} or getting directions.`
  );
  const hasDetails = Boolean(business.fullAddress || business.googleMapsUrl || business.phones.length || whatsappUrl || business.social.tiktok);
  const imageLabel = `Aerial view of ${business.name} beside the main road`;

  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-surface-low section-y">
      <span id="location" className="sr-only" />
      <div className="container-px mx-auto grid max-w-content gap-12 grid-cols-1 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHead
            id="contact-title"
            eyebrow="Visit & Contact"
            title={
              <>
                Plan your <em className="text-gold">visit</em>
              </>
            }
            intro={hasDetails ? undefined : "Address and contact details will be published here once they are confirmed."}
          />

          <div data-reveal className="mt-10 space-y-8">
            {(business.fullAddress || business.googleMapsUrl) && (
              <div>
                {business.fullAddress && (
                  <>
                    <h3 className="text-eyebrow font-semibold uppercase text-gold">Address</h3>
                    <address className="mt-3 font-display text-[1.625rem] not-italic leading-snug text-ink">{business.fullAddress}</address>
                  </>
                )}
                {business.googleMapsUrl && (
                  <a href={business.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-5">
                    <Icon name="pin" className="h-4 w-4" />
                    Get directions
                  </a>
                )}
              </div>
            )}

            {business.phones.length > 0 && (
              <div className="border-t border-line pt-8">
                <h3 className="text-eyebrow font-semibold uppercase text-gold">Phone</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {business.phones.map((p) => (
                    <li key={p.href}>
                      <a
                        href={p.href}
                        className="flex min-h-[48px] items-center gap-2.5 whitespace-nowrap rounded-md border border-line bg-surface px-4 text-[0.9375rem] font-semibold text-ink transition-colors hover:border-ink/40"
                      >
                        <Icon name="phone" className="h-4 w-4 text-gold" />
                        {p.display}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(whatsappUrl || business.social.tiktok) && (
              <div className="border-t border-line pt-8">
                {whatsappUrl && (
                  <>
                    <h3 className="text-eyebrow font-semibold uppercase text-gold">WhatsApp inquiries</h3>
                    <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                      For dates, guest numbers and menus, message us on{" "}
                      <strong className="font-semibold text-ink">{WHATSAPP_DISPLAY_NUMBER}</strong>.
                    </p>
                  </>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                      <WhatsAppGlyph className="h-[18px] w-[18px]" />
                      Message on WhatsApp
                    </a>
                  )}
                  {business.social.tiktok && (
                    <a
                      href={business.social.tiktok}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                      aria-label={`TikTok ${business.social.tiktokHandle ?? ""}`}
                    >
                      <TikTokGlyph className="h-4 w-4" />
                      {business.social.tiktokHandle}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div data-reveal="depth" className="relative lg:sticky lg:top-28">
            {media.aerialVideo ? (
              <AmbientVideo
                src={media.aerialVideo}
                poster={media.aerialPoster}
                label={imageLabel}
                sizes="(min-width: 1024px) 700px, 100vw"
                className="media-grade aspect-video rounded-lg bg-noir"
              />
            ) : (
              // No approved aerial clip yet: show the approved still (frame from the venue's own video).
              <div className="media-grade relative aspect-video overflow-hidden rounded-lg bg-noir">
                <Image src={media.aerialPoster} alt={imageLabel} fill sizes="(min-width: 1024px) 700px, 100vw" className="object-cover" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] rounded-b-lg bg-gradient-to-t from-noir/85 to-transparent p-6 pt-20 text-white sm:p-8">
              <p className="text-eyebrow font-semibold uppercase text-gold-light">From above</p>
              <p className="mt-1.5 font-display text-2xl leading-tight sm:text-3xl">The building and the main road</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
