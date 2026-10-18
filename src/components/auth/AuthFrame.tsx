import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/config";
import Icon, { type IconName } from "../Icon";

/** The three services named on the venue's own signage (the only verified ones). */
export const SERVICES_LINE = "Banquet Hall · Restaurant · Rooftop BBQ";

/** Brand lock-up: the name in the display face over the signage services line. */
function Brand({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className="leading-none">
      <span className={`block font-display text-[1.375rem] font-semibold tracking-[-0.01em] ${dark ? "text-white" : "text-imperial"}`}>
        {business.name}
      </span>
      {/* compact (header): hidden on narrow phones, where the line would wrap beside the back link */}
      <span className={`mt-1.5 block text-[0.625rem] font-semibold uppercase tracking-[0.14em] ${compact ? "max-[420px]:hidden" : ""} ${dark ? "text-brass-light" : "text-brass-text"}`}>
        {SERVICES_LINE}
      </span>
    </span>
  );
}

/** Shared chrome for sign-in, sign-up and account pages (brand + back link). */
export function AuthTopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="container-px mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4">
      <Link href="/" className="py-2" aria-label={`${business.name}, home`}>
        <Brand compact />
      </Link>
      <div className="flex items-center gap-2">
        {children}
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm font-semibold text-ink-soft hover:text-imperial"
        >
          <Icon name="prev" className="h-4 w-4" />
          <span className="hidden sm:inline">Back to website</span>
          <span className="sm:hidden">Website</span>
        </Link>
      </div>
    </header>
  );
}

// What the customer account actually does (each item is an implemented feature).
const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "calendar", title: "Booking requests", text: "Check free dates, send a request and follow its status." },
  { icon: "doc", title: "Your bookings", text: "Every booking with its details, pricing once confirmed, quotations and receipts." },
  { icon: "chat", title: "Changes & updates", text: "Ask for a change or cancellation and read messages from our team." },
  { icon: "user", title: "Your profile", text: "Keep your name, phone and sign-in details up to date." },
];

/**
 * Split card (Stitch "Customer Login / Sign Up / Password Recovery"): an
 * Imperial Emerald panel over a real venue photo beside the form panel. The
 * panel is hidden on small screens, where the form comes first.
 */
export default function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-sabor min-h-svh bg-surface-low">
      <AuthTopBar />
      <main id="main" className="container-px mx-auto max-w-6xl pb-16 pt-2 sm:pt-6">
        <div className="grid overflow-hidden rounded-xl border border-line bg-surface shadow-lift lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <aside className="relative isolate hidden flex-col justify-between gap-12 overflow-hidden bg-imperial p-10 text-white lg:flex xl:p-12">
            <Image
              src="/images/venue/hall_sofa-aisle-central-chandelier.jpg"
              alt=""
              fill
              sizes="(min-width: 1152px) 520px, 45vw"
              loading="eager"
              className="-z-10 object-cover opacity-30"
            />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-imperial/80 via-imperial/90 to-imperial-deep" />
            <div>
              <p className="chip chip-dark">
                <Icon name="shield" className="h-3.5 w-3.5" />
                Customer panel
              </p>
              <p className="mt-6 max-w-sm font-display text-[2.75rem] font-medium italic leading-[1.08] text-white">{business.tagline}.</p>
              <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-white/75">
                Your bookings with {business.name}, in one place.
              </p>
            </div>
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brass/15 text-brass-light">
                    <Icon name={f.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="block text-[0.9375rem] font-semibold text-white">{f.title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-white/70">{f.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Brand dark />
          </aside>
          <div className="px-5 py-10 sm:px-12 sm:py-14 lg:px-14 xl:px-16">
            <div className="mx-auto w-full max-w-md">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthHeading({ eyebrow, title, intro }: { eyebrow: string; title: React.ReactNode; intro?: string }) {
  return (
    <div className="mb-8">
      <p className="chip">{eyebrow}</p>
      <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.75rem]">{title}</h1>
      {intro && <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{intro}</p>}
    </div>
  );
}
