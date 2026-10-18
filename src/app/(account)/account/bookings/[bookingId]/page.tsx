import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingTimeline, PaymentsAndDocuments, PricingSummary, Section } from "@/components/account/BookingSections";
import ChangeRequests from "@/components/account/ChangeRequests";
import { BackLink, PageHeader, PortalError, WhatsAppLink } from "@/components/account/PortalStates";
import StatusBadge from "@/components/account/StatusBadge";
import Icon from "@/components/Icon";
import VenueTermsList from "@/components/VenueTerms";
import { requireUser } from "@/lib/auth/server";
import { formatEventDate, formatTimestamp } from "@/lib/booking/format";
import { canRequestChanges } from "@/lib/booking/portal";
import { loadCustomerBooking } from "@/lib/booking/portal-server";
import { supportMessage } from "@/lib/booking/whatsapp-messages";
import ReviewForm from "@/components/account/ReviewForm";
import { loadCustomerReview } from "@/lib/booking/reviews-server";

export const metadata: Metadata = { title: "Booking details" };

export default async function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const path = `/account/bookings/${encodeURIComponent(bookingId)}`;
  const user = await requireUser(path);
  // Ownership is checked on the server: another customer's booking is "not found".
  const result = await loadCustomerBooking(user.uid, bookingId);

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <BackLink href="/account/bookings" label="My bookings" />
        <PortalError retryHref={path} reason={result.reason} />
      </div>
    );
  }
  if (!result.data) notFound();

  const { booking: b, requests, today, config, payments, quotations } = result.data;
  // Phase 10: the customer's own review (only for completed events).
  const review = b.status === "completed" ? await loadCustomerReview(user.uid, b.bookingId) : null;
  const openTypes = requests.filter((r) => r.status === "open").map((r) => r.type);
  const editable = canRequestChanges(b, today);
  // Customer -> venue support message (central template, real booking context only).
  const whatsappMessage = supportMessage({ bookingId: b.bookingId, eventDate: b.eventDate, slotLabel: b.slotLabel });

  const facts: [string, string][] = [
    ["Date", formatEventDate(b.eventDate)],
    ["Slot", b.slotLabel],
    ["Hall", b.hallName],
    ["Event", b.eventTypeLabel],
    ["Guests", b.guestCount.toLocaleString("en-US")],
    ["Reference", b.reference],
  ];

  return (
    <div className="space-y-6">
      <BackLink href="/account/bookings" label="My bookings" />

      <PageHeader
        eyebrow={b.eventTypeLabel}
        title={formatEventDate(b.eventDate)}
        intro={
          <>
            {b.slotLabel} slot · {b.hallName} · Ref <span className="font-mono">{b.reference}</span>
          </>
        }
        actions={<StatusBadge status={b.status} />}
      />

      {/* Dossier layout: event, status and requests on the left; money, documents and terms on the right. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="min-w-0 space-y-6">
      <Section id="event-title" title="Event">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[0.9375rem] sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className={`break-words font-semibold text-ink ${label === "Reference" ? "font-mono" : ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
        {(b.services.length > 0 || b.menuPreference || b.package || b.customerNotes) && (
          <dl className="mt-6 space-y-4 border-t border-line pt-6 text-[0.9375rem]">
            {b.services.length > 0 && (
              <div>
                <dt className="text-sm text-ink-muted">Selected services</dt>
                <dd className="font-semibold text-ink">{b.services.map((s) => s.label).join(", ")}</dd>
              </div>
            )}
            {b.package && (
              <div>
                <dt className="text-sm text-ink-muted">Package</dt>
                <dd className="font-semibold text-ink">{b.package.name}</dd>
              </div>
            )}
            {b.menuPreference && (
              <div>
                <dt className="text-sm text-ink-muted">Menu preference</dt>
                <dd className="font-semibold text-ink">{b.menuPreference.title}</dd>
              </div>
            )}
            {b.customerNotes && (
              <div>
                <dt className="text-sm text-ink-muted">Your notes</dt>
                <dd className="whitespace-pre-line break-words text-ink">{b.customerNotes}</dd>
              </div>
            )}
          </dl>
        )}
        <p className="mt-6 border-t border-line pt-4 text-sm text-ink-muted">
          Contact on this booking: <span className="font-semibold text-ink-soft">{b.contact.name}</span> ·{" "}
          <span className="font-semibold text-ink-soft">{b.contact.phone}</span>
        </p>
      </Section>

      {config.policies.active && (
        <Section id="policies-title" title="Booking policies">
          {config.policies.effectiveDate && <p className="mb-3 text-sm text-ink-muted">Effective {config.policies.effectiveDate}</p>}
          <dl className="space-y-4 text-[0.9375rem]">
            {(
              [
                ["Cancellation", config.policies.cancellationPolicy],
                ["Refunds", config.policies.refundPolicy],
                ["Changes", config.policies.modificationPolicy],
              ] as const
            )
              .filter(([, text]) => text)
              .map(([title, text]) => (
                <div key={title}>
                  <dt className="font-semibold text-ink">{title}</dt>
                  <dd className="whitespace-pre-line text-ink-soft">{text}</dd>
                </div>
              ))}
          </dl>
        </Section>
      )}

      {b.status === "completed" && (
        <Section id="review-title" title="Review your event">
          {review === "error" ? (
            <p role="alert" className="text-sm text-red-900">Your review couldn&rsquo;t be loaded right now. Please try again later.</p>
          ) : (
            <ReviewForm
              bookingId={b.bookingId}
              defaultName={b.contact.name}
              existing={review ? { rating: review.rating, text: review.text, displayName: review.displayName, status: review.status } : null}
            />
          )}
        </Section>
      )}

      <Section id="status-title" title="Status">
        <BookingTimeline booking={b} />
      </Section>

      <Section id="requests-title" title="Changes & cancellation">
        {requests.length > 0 ? (
          <ul className="mb-6 space-y-3">
            {requests.map((r) => (
              <li key={r.requestId} className="rounded-md border border-line bg-surface-low px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">
                    {r.type === "cancellation" ? "Cancellation request" : "Change request"}
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                    <Icon name={r.status === "open" ? "clock" : "check"} className="h-3.5 w-3.5" />
                    {r.statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-ink-muted">Sent {formatTimestamp(r.createdAt)}</p>
                {r.summary.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-soft">
                    {r.summary.map((line) => (
                      <li key={line} className="break-words">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
                {r.reason && <p className="mt-2 break-words text-ink-soft">Reason: {r.reason}</p>}
              </li>
            ))}
          </ul>
        ) : (
          !editable && <p className="mb-2 text-sm text-ink-muted">No change requests for this booking.</p>
        )}
        {editable ? (
          <ChangeRequests
            bookingId={b.bookingId}
            today={today}
            config={config}
            current={{
              eventDate: b.eventDate,
              slotId: b.slotId,
              guestCount: b.guestCount,
              menuPreferenceId: b.menuPreference?.id ?? null,
              serviceIds: b.services.map((s) => s.id),
            }}
            openTypes={openTypes}
          />
        ) : (
          <p className="text-sm leading-relaxed text-ink-soft">
            This booking can&rsquo;t be changed online. For anything else, please contact us.
          </p>
        )}
      </Section>
      </div>

      <aside className="min-w-0 space-y-6 lg:sticky lg:top-6" aria-label="Pricing and documents">
        <Section id="pricing-title" title="Pricing">
          <PricingSummary booking={b} />
        </Section>

        <Section id="receipts-title" title="Quotations & receipts">
          <PaymentsAndDocuments payments={payments} quotations={quotations} />
        </Section>

        <Section id="venue-terms-title" title="Venue terms">
          <VenueTermsList className="text-[0.9375rem]" />
        </Section>

        <section aria-labelledby="help-title" className="rounded-lg bg-imperial p-6 text-white sm:p-8">
          <h2 id="help-title" className="font-display text-[1.5rem] font-semibold leading-tight">
            Questions about this booking?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/75">Our team can help with anything about {b.reference}.</p>
          <div className="mt-5 flex flex-col gap-3">
            <WhatsAppLink message={whatsappMessage} className="btn btn-whatsapp" />
            <Link href="/book" className="btn border border-white/30 text-white hover:border-brass-light hover:text-brass-light">
              Book another event
            </Link>
          </div>
        </section>
      </aside>
      </div>
    </div>
  );
}
