import type { Metadata } from "next";
import Link from "next/link";
import BookingCard from "@/components/account/BookingCard";
import { EmptyState, PageHeader, PortalError, WhatsAppLink } from "@/components/account/PortalStates";
import Icon from "@/components/Icon";
import { requireUser } from "@/lib/auth/server";
import { BOOKING_FILTERS, FILTER_LABELS, matchesFilter, parseFilter, sortForCustomer } from "@/lib/booking/portal";
import { loadCustomerOverview } from "@/lib/booking/portal-server";

export const metadata: Metadata = { title: "My bookings" };

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/account/bookings");
  const filter = parseFilter((await searchParams).filter);
  // One query scoped to this customer's uid; filtering happens on the server.
  const overview = await loadCustomerOverview(user.uid);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Customer account"
        title="My bookings"
        intro="Every booking request you have sent, newest first, with its current status."
        actions={
          <Link href="/book" className="btn btn-primary">
            <Icon name="calendar" className="h-4 w-4" />
            Book another event
          </Link>
        }
      />

      {!overview.ok ? (
        <PortalError retryHref={`/account/bookings${filter === "all" ? "" : `?filter=${filter}`}`} reason={overview.reason} />
      ) : overview.data.bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          action={
            <>
              <Link href="/book" className="btn btn-primary">
                Plan your event
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <WhatsAppLink label="Ask us on WhatsApp" />
            </>
          }
        >
          Check free dates and send us a booking request. It will appear here with its status.
        </EmptyState>
      ) : (
        (() => {
          const { bookings, today, openRequests } = overview.data;
          const shown = sortForCustomer(bookings, today).filter((b) => matchesFilter(b, filter, today));
          return (
            <>
              <nav aria-label="Filter bookings">
                <ul className="flex flex-wrap gap-2">
                  {BOOKING_FILTERS.map((f) => {
                    const count = bookings.filter((b) => matchesFilter(b, f, today)).length;
                    const current = f === filter;
                    return (
                      <li key={f}>
                        <Link
                          href={f === "all" ? "/account/bookings" : `/account/bookings?filter=${f}`}
                          aria-current={current ? "page" : undefined}
                          className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                            current ? "border-imperial bg-imperial text-white" : "border-line bg-surface text-ink-soft hover:border-imperial/40 hover:text-imperial"
                          }`}
                        >
                          {FILTER_LABELS[f]}
                          <span className={`tnum ${current ? "text-white/75" : "text-ink-muted"}`}>{count}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {shown.length === 0 ? (
                <EmptyState
                  title={`No ${FILTER_LABELS[filter].toLowerCase()} bookings`}
                  action={
                    <Link href="/account/bookings" className="btn btn-outline">
                      Show all bookings
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-4" aria-label={`${FILTER_LABELS[filter]} bookings`}>
                  {shown.map((b) => (
                    <li key={b.bookingId}>
                      <BookingCard booking={b} openRequestTypes={openRequests[b.bookingId]} headingLevel="h2" />
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
