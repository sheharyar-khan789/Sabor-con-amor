"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { menuPdf, menuSheets, mehndiMenus, sweetsAndSides, terms, weddingMenus, type MenuSet } from "@/data/menu";
import { business } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { useBooking } from "./BookingContext";
import SectionHead from "./Section";
import { useDialog } from "./useDialog";
import Icon, { WhatsAppGlyph } from "./Icon";

const ALL_TABS = [
  { key: "wedding", label: "Wedding menus", count: weddingMenus.length },
  { key: "mehndi", label: "Mehndi menus", count: mehndiMenus.length },
  { key: "sweets", label: "Desserts & drinks", count: sweetsAndSides.length },
  { key: "card", label: "Printed card", count: menuSheets.length },
] as const;
type TabKey = (typeof ALL_TABS)[number]["key"];
// Only categories that actually have confirmed content (src/data/menu.ts).
const tabs = ALL_TABS.filter((t) => t.count > 0);

export default function Menus() {
  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? "wedding");
  const [lightbox, setLightbox] = useState<number | null>(null);
  // Sheets whose image failed to load: show a text fallback instead of a broken image.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const markFailed = useCallback((src: string) => setFailed((f) => new Set(f).add(src)), []);
  const { openTerms } = useBooking();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closeLightbox = useCallback(() => setLightbox(null), []);
  const closeRef = useDialog(lightbox !== null, closeLightbox, dialogRef);
  const step = useCallback(
    (d: number) => setLightbox((c) => (c === null ? null : (c + d + menuSheets.length) % menuSheets.length)),
    []
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, step]);

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(tabs[next].key);
    tabRefs.current[next]?.focus();
  };

  const sheet = lightbox !== null ? menuSheets[lightbox] : null;
  const ratesUrl = getWhatsAppUrl(`Assalam o Alaikum, I would like to inquire about the menu options and per-head rates at ${business.name}.`);

  return (
    <section id="menus" aria-labelledby="menus-title" className="bg-surface-low section-y">
      <div className="container-px mx-auto max-w-content">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHead
            id="menus-title"
            eyebrow="Catering & Menus"
            title={
              <>
                Our <em className="text-gold">menus</em>
              </>
            }
            intro={
              tabs.length
                ? "Menus from our menu card. Ask us for current per-head rates."
                : "Menus and rates will be published here once they are confirmed."
            }
          />
          {(ratesUrl || menuPdf) && (
            <div data-reveal data-reveal-delay="120" className="flex flex-wrap gap-3">
              {ratesUrl && (
                <a href={ratesUrl} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                  <WhatsAppGlyph className="h-[18px] w-[18px]" />
                  Ask for menu rates
                </a>
              )}
              {menuPdf && (
                <a href={menuPdf} download className="btn btn-outline">
                  <Icon name="download" className="h-4 w-4" />
                  Menu card (PDF)
                </a>
              )}
            </div>
          )}
        </div>

        {tabs.length > 0 && (
        <>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Menu categories"
          className="no-scrollbar -mx-5 mt-12 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0 lg:mt-14"
        >
          {tabs.map((t, i) => {
            const selected = active === t.key;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`menu-tab-${t.key}`}
                aria-selected={selected}
                aria-controls={`menu-panel-${t.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(t.key)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-md border px-5 text-label font-semibold uppercase transition-colors ${
                  selected
                    ? "border-noir bg-noir text-surface"
                    : "border-line bg-transparent text-ink-soft hover:border-ink/40 hover:text-ink"
                }`}
              >
                {t.label}
                <span className={`text-xs ${selected ? "text-gold-light" : "text-ink-muted"}`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`menu-panel-${active}`}
          aria-labelledby={`menu-tab-${active}`}
          tabIndex={0}
          className="mt-8 focus-visible:outline-offset-8"
        >
          {active === "wedding" && (
            <ul className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {weddingMenus.map((m, i) => (
                <MenuCard key={m.id} menu={m} index={i} />
              ))}
              {ratesUrl && (
                <li className="flex flex-col justify-between rounded-lg bg-noir p-7 text-white">
                  <div>
                    <p className="text-eyebrow font-medium uppercase text-gold-light">Need help choosing?</p>
                    <p className="mt-3 font-display text-[1.625rem] font-normal leading-tight">
                      Ask for current per-head rates for any menu.
                    </p>
                  </div>
                  <a href={ratesUrl} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-sm mt-6 self-start">
                    <WhatsAppGlyph className="h-4 w-4" />
                    Ask on WhatsApp
                  </a>
                </li>
              )}
            </ul>
          )}
          {active === "mehndi" && (
            <ul className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:max-w-4xl">
              {mehndiMenus.map((m, i) => (
                <MenuCard key={m.id} menu={m} index={i} />
              ))}
            </ul>
          )}
          {active === "sweets" && (
            <ul className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {sweetsAndSides.map((m, i) => (
                <MenuCard key={m.id} menu={m} index={i} plain />
              ))}
            </ul>
          )}
          {active === "card" && (
            <>
              <p className="mb-6 max-w-2xl text-sm text-ink-soft">Scans of our printed menu card. Tap a sheet to enlarge it.</p>
              <ul className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
                {menuSheets.map((s, i) => (
                  <li key={s.src} className="w-[72%] shrink-0 snap-center sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setLightbox(i)}
                      aria-haspopup="dialog"
                      className="group block w-full text-left"
                    >
                      <span className="relative block aspect-[9/16] overflow-hidden rounded-lg bg-surface-high ring-1 ring-line">
                        {failed.has(s.src) ? (
                          <span className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-ink-soft">
                            This sheet could not be loaded.
                          </span>
                        ) : (
                          <Image
                            src={s.src}
                            alt={s.alt}
                            fill
                            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 72vw"
                            onError={() => markFailed(s.src)}
                            className="object-contain transition-transform duration-700 ease-elegant group-hover:scale-[1.03]"
                          />
                        )}
                        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-noir/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                          <Icon name="expand" className="h-3.5 w-3.5 text-gold-light" />
                          Enlarge
                        </span>
                      </span>
                      <span className="mt-3 block text-sm font-semibold text-ink">Sheet {i + 1}</span>
                      <span className="block text-xs text-ink-muted">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        </>
        )}

        {/* Booking terms: shown only once confirmed terms exist (src/data/policies.ts). */}
        {terms.length > 0 && (
          <div
            data-reveal
            className="mt-14 flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between"
          >
            <p className="eyebrow">Good to know</p>
            <button type="button" onClick={openTerms} aria-haspopup="dialog" className="btn btn-outline shrink-0">
              <Icon name="doc" className="h-4 w-4" />
              Read all booking terms
            </button>
          </div>
        )}
      </div>

      {/* Printed-card lightbox */}
      {sheet && lightbox !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Menu card sheet ${lightbox + 1}: ${sheet.title}`}
          className="fixed inset-0 z-[80] flex flex-col bg-noir/95 text-white backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-eyebrow font-semibold uppercase text-gold-light">
                Sheet {lightbox + 1} of {menuSheets.length}
              </p>
              <p className="font-display text-lg">{sheet.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={sheet.src}
                target="_blank"
                rel="noopener"
                aria-label={`Open ${sheet.title} at full size in a new tab`}
                className="grid h-11 w-11 place-items-center rounded-full text-white/80 hover:bg-white/10"
              >
                <Icon name="expand" className="h-5 w-5" />
              </a>
              {menuPdf && (
                <a
                  href={menuPdf}
                  download
                  aria-label="Download menu card PDF"
                  className="grid h-11 w-11 place-items-center rounded-full text-white/80 hover:bg-white/10"
                >
                  <Icon name="download" className="h-5 w-5" />
                </a>
              )}
              <button
                ref={closeRef}
                type="button"
                onClick={closeLightbox}
                aria-label="Close"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/20 hover:bg-white/10"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 p-3 sm:p-6">
            {failed.has(sheet.src) ? (
              <p className="absolute inset-0 grid place-items-center p-6 text-center text-white/80">
                This sheet could not be loaded.
              </p>
            ) : (
              <Image
                key={sheet.src}
                src={sheet.src}
                alt={sheet.alt}
                fill
                sizes="100vw"
                onError={() => markFailed(sheet.src)}
                className="object-contain p-3 sm:p-6"
              />
            )}
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous sheet"
              className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <Icon name="prev" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next sheet"
              className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <Icon name="next" className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MenuCard({
  menu,
  index,
  hideItems,
  plain,
}: {
  menu: MenuSet;
  index: number;
  hideItems?: string[];
  plain?: boolean;
}) {
  const items = hideItems ? menu.items.filter((i) => !hideItems.includes(i)) : menu.items;
  const rateUrl = getWhatsAppUrl(`Assalam o Alaikum, I would like to inquire about the per-head rate for ${menu.title} at ${business.name}.`);
  return (
    <li className="flex flex-col border-t border-ink/15 pt-6">
      <div className="flex items-baseline justify-between gap-3 pb-4">
        <h3 className="font-display text-[1.75rem] font-normal leading-none text-ink">{menu.title}</h3>
        {!plain && <span className="font-display text-base italic text-gold">{String(index + 1).padStart(2, "0")}</span>}
      </div>
      <ul className="mt-2 flex-1 space-y-2.5 text-[0.9375rem] leading-relaxed text-ink-soft">
        {items.map((item, i) => (
          <li key={item} className={i === 0 && !plain ? "font-semibold text-ink" : ""}>
            {item}
          </li>
        ))}
      </ul>
      {!plain && rateUrl && (
        <a
          href={rateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-[44px] items-center self-start text-label font-semibold uppercase text-ink-muted underline decoration-line-strong/60 underline-offset-[6px] transition-colors hover:text-ink hover:decoration-ink"
        >
          Ask per-head rate
        </a>
      )}
    </li>
  );
}
