import Link from "next/link";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import Icon, { WhatsAppGlyph, type IconName } from "../Icon";

export function WhatsAppLink({
  message,
  label = "Contact us on WhatsApp",
  className = "btn btn-whatsapp",
}: {
  message?: string;
  label?: string;
  className?: string;
}) {
  const href = getWhatsAppUrl(message);
  // Hidden until a WhatsApp number is configured.
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <WhatsAppGlyph className="h-[18px] w-[18px]" />
      {label}
    </a>
  );
}

/** Page header (Stitch dossier style): chip eyebrow, display title, optional intro and actions. */
export function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
  aside,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="chip">{eyebrow}</p>
        <h1 className="mt-4 break-words font-display text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.75rem]">
          {title}
        </h1>
        {intro && <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft">{intro}</p>}
        {aside && <div className="mt-3">{aside}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3 self-start sm:self-auto">{actions}</div>}
    </header>
  );
}

/** Calm, non-alarming empty state with a way forward. */
export function EmptyState({
  icon = "calendar",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-6 py-14 text-center shadow-soft sm:px-10">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brass-pale text-brass-text">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-5 font-display text-[1.625rem] font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">{children}</div>}
      {action && <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">{action}</div>}
    </div>
  );
}

/** Shown when bookings can't be loaded (database unavailable or not configured). */
export function PortalError({ retryHref, reason, subject = "bookings" }: { retryHref: string; reason: "unavailable" | "error"; subject?: string }) {
  return (
    <div role="alert" className="rounded-lg border border-status-cancelled/20 bg-status-cancelled-bg p-6 text-status-cancelled sm:p-8">
      <p className="font-semibold">
        {reason === "unavailable" ? `Your ${subject} can't be shown right now.` : `We couldn't load your ${subject}.`}
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        {reason === "unavailable"
          ? "Online booking details are temporarily unavailable. Please contact our team."
          : "This is usually temporary. Please try again in a moment, or contact our team."}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a href={retryHref} className="btn btn-ghost btn-sm border-red-300 text-red-900">
          Try again
        </a>
        <WhatsAppLink className="btn btn-whatsapp btn-sm" />
      </div>
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink">
      <Icon name="prev" className="h-4 w-4" />
      {label}
    </Link>
  );
}

/** Skeleton block for loading.tsx files (pulse only when motion is allowed). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-surface-mid/80 motion-safe:animate-pulse ${className}`} />;
}

export function PortalLoading({ label, blocks = 3 }: { label: string; blocks?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-2/3" />
      {Array.from({ length: blocks }, (_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-lg" />
      ))}
    </div>
  );
}
