"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { eventCategories } from "@/data/events";
import { reels } from "@/data/gallery";
import { googleHighlights, reviews } from "@/data/reviews";
import { business, media } from "@/lib/config";
import { getWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";
import AccountMenu from "./AccountMenu";
import BookNowButton from "./BookNowButton";
import Icon, { WhatsAppGlyph } from "./Icon";
import { endSession } from "./SignOutButton";
import { useDialog } from "./useDialog";
import { useSessionStatus } from "./useSessionStatus";

const mobileAccountItem =
  "flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-center text-[0.75rem] font-semibold text-white/85 hover:bg-white/10 hover:text-white";

// Home-page sections. Décor, Events and Reviews render only when they have
// confirmed content (see DecorReels / Events / Reviews), so they're listed only
// then — never a link to a section that isn't on the page.
const hasEvents = eventCategories.some((e) => e.enabled);
const hasHomeReviews = business.rating !== null || reviews.length > 0 || googleHighlights.length > 0;
export const navLinks = [
  { id: "about", label: "About" },
  { id: "venue", label: "The Venue" },
  ...(reels.length > 0 ? [{ id: "decor", label: "Stages & Décor" }] : []),
  ...(hasEvents ? [{ id: "events", label: "Events" }] : []),
  { id: "menus", label: "Menus" },
  { id: "gallery", label: "Gallery" },
  ...(hasHomeReviews ? [{ id: "reviews", label: "Reviews" }] : []),
  { id: "contact", label: "Contact" },
];

function subscribeScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}
const getScrolled = () => window.scrollY > 24;
const getServerScrolled = () => false;

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const scrolled = useSyncExternalStore(subscribeScroll, getScrolled, getServerScrolled);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const closeRef = useDialog(open, close, panelRef);
  const router = useRouter();
  const { status, markSignedOut } = useSessionStatus();
  const [signingOut, setSigningOut] = useState(false);

  const onMobileLogout = async () => {
    setSigningOut(true);
    await endSession();
    setSigningOut(false);
    markSignedOut();
    setOpen(false);
    router.refresh();
  };

  const solid = !isHome || scrolled;
  const href = (id: string) => (isHome ? `#${id}` : `/#${id}`);
  const whatsappUrl = getWhatsAppUrl();

  // In the mobile menu, close first, then scroll, so the scroll lock is released.
  const onMenuLink = (e: React.MouseEvent, id: string) => {
    if (!isHome) {
      setOpen(false);
      return;
    }
    e.preventDefault();
    setOpen(false);
    window.setTimeout(() => {
      const target = document.getElementById(id);
      if (!target) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      history.replaceState(null, "", `#${id}`);
    }, 60);
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-500 ease-elegant ${
          solid
            ? "border-white/[0.08] bg-noir/95 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="container-px mx-auto flex h-[68px] max-w-content items-center justify-between gap-6 lg:h-20">
          <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label={`${business.name}, home`}>
            {media.logo && (
              <span className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-gold-light/50">
                <Image src={media.logo} alt="" fill sizes="40px" className="object-cover" />
              </span>
            )}
            <span className="leading-none">
              <span className="block font-display text-[1.375rem] font-normal tracking-[0.01em] text-white transition-colors duration-500">
                {business.name}
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-6 xl:flex 2xl:gap-9">
            {navLinks.map((item) =>
              isHome ? (
                <a
                  key={item.id}
                  href={href(item.id)}
                  className={`link-underline whitespace-nowrap py-2 text-[0.8125rem] font-medium tracking-[0.02em] transition-colors ${
                    solid ? "text-white/85 hover:text-gold-light" : "text-white/85 hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.id}
                  href={href(item.id)}
                  className="link-underline whitespace-nowrap py-2 text-[0.8125rem] font-medium tracking-[0.02em] text-white/85 transition-colors hover:text-gold-light"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="flex items-center gap-2.5">
            {/* Customer sign-in (never admin). Hidden until the session is known, so it doesn't flicker. */}
            <div className={`hidden items-center gap-2.5 lg:flex ${status.state === "loading" ? "invisible" : ""}`}>
              {status.state === "signed-in" ? (
                <AccountMenu name={status.name} email={status.email} solid={false} onSignedOut={markSignedOut} />
              ) : (
                <>
                  <Link
                    href="/login"
                    className={`inline-flex h-11 items-center whitespace-nowrap px-2 text-[0.8125rem] font-semibold transition-colors ${
                      solid ? "text-white/85 hover:text-gold-light" : "text-white/85 hover:text-white"
                    }`}
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className={`inline-flex h-11 items-center whitespace-nowrap rounded-md border px-4 text-[0.8125rem] font-semibold transition-colors ${
                      solid
                        ? "border-gold-light/50 text-white hover:border-gold-light hover:bg-white/10"
                        : "border-white/35 text-white hover:border-white/70 hover:bg-white/10"
                    }`}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
            <BookNowButton className={`btn btn-sm hidden whitespace-nowrap lg:inline-flex btn-accent`}>
              Book Your Event
            </BookNowButton>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="site-menu"
              className={`inline-flex h-11 items-center gap-2 rounded-md border pl-4 pr-3.5 text-[0.8125rem] font-semibold transition-colors xl:hidden ${
                solid ? "border-gold-light/50 text-white" : "border-white/40 text-white"
              }`}
            >
              Menu
              <Icon name="menu" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu: a full-screen sheet. `inert` keeps it out of the tab order when closed. */}
      <div
        id="site-menu"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        inert={!open}
        // Visibility turns on instantly when opening (so focus can move in) and
        // turns off only after the fade-out when closing.
        className={`fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-noir text-surface xl:hidden ${
          open
            ? "visible opacity-100 [transition:opacity_0.5s_cubic-bezier(0.16,1,0.3,1)]"
            : "invisible opacity-0 [transition:opacity_0.5s_cubic-bezier(0.16,1,0.3,1),visibility_0s_linear_0.5s]"
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_55%_at_100%_0%,rgba(212,175,55,0.12),transparent_60%)]"
        />
        <div className="container-px relative flex h-[68px] items-center justify-between">
          <span className="leading-none">
            <span className="block font-display text-[1.375rem] font-normal">{business.name}</span>
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Mobile" className="container-px relative flex-1 pt-6">
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {navLinks.map((item, i) => (
              <li
                key={item.id}
                className={`transition-[opacity,transform] duration-700 ease-elegant ${
                  open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
                style={{ transitionDelay: open ? `${80 + i * 45}ms` : "0ms" }}
              >
                <a
                  href={href(item.id)}
                  onClick={(e) => onMenuLink(e, item.id)}
                  className="flex min-h-[60px] items-center justify-between py-3 font-display text-[1.75rem] leading-none text-white"
                >
                  <span>{item.label}</span>
                  <span className="text-xs font-body font-semibold tracking-[0.2em] text-gold-light/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/gallery"
            onClick={() => setOpen(false)}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-gold-light"
          >
            View the full photo gallery
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </nav>

        <div className="container-px relative space-y-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
          {/* Customer account (never admin). */}
          {status.state === "signed-in" ? (
            <div className="rounded-2xl border border-white/10 p-2">
              <p className="truncate px-3 pb-1 pt-2 text-xs text-white/60">
                Signed in{status.email ? ` as ${status.email}` : ""}
              </p>
              <div className="grid grid-cols-3 gap-1">
                <Link href="/account" onClick={close} className={mobileAccountItem}>
                  <Icon name="user" className="h-4 w-4 text-gold-light" />
                  My Account
                </Link>
                <Link href="/account/bookings" onClick={close} className={mobileAccountItem}>
                  <Icon name="calendar" className="h-4 w-4 text-gold-light" />
                  My Bookings
                </Link>
                <button type="button" onClick={onMobileLogout} disabled={signingOut} className={mobileAccountItem}>
                  <Icon name="logout" className="h-4 w-4 text-gold-light" />
                  {signingOut ? "Signing out…" : "Logout"}
                </button>
              </div>
            </div>
          ) : status.state === "signed-out" ? (
            <div className="grid grid-cols-2 gap-3">
              <Link href="/login" onClick={close} className="btn btn-outline-light w-full">
                Login
              </Link>
              <Link href="/signup" onClick={close} className="btn btn-outline-light w-full">
                Sign Up
              </Link>
            </div>
          ) : null}
          <BookNowButton onClick={close} className="btn btn-accent w-full">
            Book Your Event
          </BookNowButton>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full">
              <WhatsAppGlyph className="h-[18px] w-[18px]" />
              WhatsApp {WHATSAPP_DISPLAY_NUMBER}
            </a>
          )}
          {business.phones.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {business.phones.map((phone) => (
              <a
                key={phone.href}
                href={phone.href}
                className="flex min-h-[48px] flex-col items-center justify-center rounded-xl border border-white/10 px-1 text-center text-[0.75rem] font-medium text-white/85"
              >
                <Icon name="phone" className="mb-1 h-3.5 w-3.5 text-gold-light" />
                {phone.display}
              </a>
            ))}
          </div>
          )}
          {business.fullAddress && (
            <p className="flex items-start gap-2 pt-2 text-xs leading-relaxed text-white/60">
              <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-gold-light" />
              {business.fullAddress}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
