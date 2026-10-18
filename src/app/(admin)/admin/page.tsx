import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, BookingRows, Empty, PageHeader, Panel, StatusPill } from "@/components/admin/AdminUi";
import Icon from "@/components/Icon";
import { formatEventDate, formatPKR, formatTimestamp } from "@/lib/booking/format";
import { loadAlerts, loadDashboard } from "@/lib/booking/admin-server";
import { requireSuperAdmin } from "@/lib/auth/server";
import MarkAlertsSeen from "@/components/admin/MarkAlertsSeen";

export const metadata: Metadata = { title: "Dashboard" };

function Kpi({ label, value, href, feature = false }: { label: string; value: number; href?: string; feature?: boolean }) {
  const body = (
    <>
      <dt className={`text-eyebrow font-medium uppercase ${feature ? "text-[#b9b6af]" : "text-ink-muted"}`}>{label}</dt>
      <dd className={`mt-4 font-display text-[2.75rem] font-normal leading-none lining-nums tabular-nums ${feature ? "text-gold-light" : "text-ink"}`}>{value}</dd>
    </>
  );
  return (
    <div className={`rounded-lg border px-5 py-5 ${feature ? "border-imperial bg-imperial" : "border-line bg-surface"}`}>
      {href ? (
        <Link href={href} className="block hover:underline">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

export default async function AdminDashboard() {
  const admin = await requireSuperAdmin("/admin");
  const [r, alerts] = await Promise.all([loadDashboard(), loadAlerts(admin.uid)]);
  if (!r.ok) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <AdminError reason={r.reason} retryHref="/admin" />
      </>
    );
  }
  const d = r.data;
  const todayCount = (slotId: string) => d.todayBySlot.find((s) => s.slotId === slotId)?.bookings.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Today is ${formatEventDate(d.today)}`}
        action={
          <Link href="/admin/bookings/new" className="btn btn-primary btn-sm self-start">
            <Icon name="calendar" className="h-4 w-4" />
            New booking
          </Link>
        }
      />

      {alerts.ok && (
        <Panel
          title="New requests"
          id="alerts"
          action={
            <span className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
              <span className="rounded-full bg-imperial px-2.5 py-0.5 font-semibold text-gold-light">{alerts.data.count} waiting</span>
              {alerts.data.newCount > 0 && <span className="rounded-full border border-gold px-2.5 py-0.5 font-semibold text-ink">{alerts.data.newCount} new since your last visit</span>}
            </span>
          }
        >
          <p className="mb-3 text-xs text-ink-muted">
            {alerts.data.pending} pending · {alerts.data.underReview} under review · {alerts.data.openRequests} open change request{alerts.data.openRequests === 1 ? "" : "s"} · newest first
            {alerts.data.lastSeenAt ? ` · last visit ${formatTimestamp(alerts.data.lastSeenAt)}` : ""}
          </p>
          {alerts.data.items.length === 0 ? (
            <Empty>Nothing is waiting for you.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {alerts.data.items.slice(0, 8).map((a) => (
                <li key={`${a.kind}-${a.id}`}>
                  <Link
                    href={a.kind === "request" ? `/admin/bookings/${a.bookingId}#requests` : `/admin/bookings/${a.bookingId}`}
                    className="flex flex-col gap-1 py-2.5 hover:bg-surface-low sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                        {a.isNew && <span className="rounded bg-gold-light px-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-imperial">New</span>}
                        {a.label} · {a.customerName || "—"}
                      </span>
                      <span className="block break-words text-ink-muted">
                        <span className="font-mono">{a.reference}</span>
                        {a.eventDate && ` · ${formatEventDate(a.eventDate, "short")} ${a.slotLabel ?? ""}`} · received {formatTimestamp(a.createdAt)}
                      </span>
                    </span>
                    {a.status && <StatusPill status={a.status} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {alerts.data.items.length > 8 && <p className="mt-2 text-xs text-ink-muted">Showing the 8 newest of {alerts.data.items.length}.</p>}
          <MarkAlertsSeen upTo={alerts.data.items[0]?.createdAt ?? null} />
        </Panel>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Today · Day" value={todayCount("day")} feature />
        <Kpi label="Today · Night" value={todayCount("night")} feature />
        <Kpi label="Upcoming events" value={d.counts.upcoming} href="/admin/bookings" />
        <Kpi label="Pending" value={d.counts.pending} href="/admin/bookings?status=pending" />
        <Kpi label="Under review" value={d.counts.underReview} href="/admin/bookings?status=under_review" />
        <Kpi label="Confirmed (upcoming)" value={d.counts.confirmedUpcoming} href="/admin/bookings?status=confirmed" />
        <Kpi label="Open change requests" value={d.counts.openRequests} />
        <Kpi label="Free slots · next 30 days" value={d.slots30.available} href="/admin/calendar" />
      </dl>
      <p className="-mt-3 text-xs text-ink-muted">
        Next 30 days: {d.slots30.available} free, {d.slots30.held} on hold, {d.slots30.booked} booked (same availability engine as the public booking page).
      </p>

      <Panel title="Payments">
        {d.pricedBookings === 0 ? (
          <p className="text-sm text-ink-soft">
            <strong className="font-semibold text-ink">No priced upcoming bookings.</strong> Totals appear once bookings carry a stored price.
            No figures are estimated.
          </p>
        ) : (
          <div className="text-sm">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  ["Booked value", d.finance.total],
                  ["Received", d.finance.paid],
                  ["Outstanding", d.finance.outstanding],
                ] as const
              ).map(([label, amount]) => (
                <div key={label}>
                  <dt className="text-eyebrow font-medium uppercase text-ink-muted">{label}</dt>
                  <dd className="mt-2 font-display text-[1.75rem] font-normal leading-none lining-nums tabular-nums text-ink">{formatPKR(amount)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-ink-muted">
              Upcoming pending, under-review and confirmed bookings with a stored price ({d.pricedBookings}), from recorded payments only.
              {d.finance.unpriced > 0 && ` ${d.finance.unpriced} booking(s) have no price yet and are not included.`}
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Today's events">
        <div className="grid gap-3 md:grid-cols-2">
          {d.todayBySlot.map((slot) => (
            <div key={slot.slotId} className="border-t border-line pt-4">
              <p className="text-eyebrow font-medium uppercase text-ink-muted">{slot.slotLabel} slot</p>
              {slot.bookings.length === 0 ? (
                <p className="mt-1 text-sm text-ink-muted">No event in the {slot.slotLabel} slot today.</p>
              ) : (
                slot.bookings.map((b) => (
                  <Link key={b.bookingId} href={`/admin/bookings/${b.bookingId}`} className="mt-2 block rounded-lg bg-surface-low p-2 hover:bg-surface-mid">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{b.customerName || "—"}</span>
                      <StatusPill status={b.status} lapsed={b.holdLapsed} />
                    </div>
                    <p className="text-sm text-ink-soft">
                      {b.eventTypeLabel} · {b.guestCount.toLocaleString("en-US")} guests · <span className="font-mono">{b.reference}</span>
                    </p>
                  </Link>
                ))
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Booking requests waiting" action={<Link href="/admin/bookings?status=awaiting" className="link-quiet">All pending</Link>}>
        {d.pendingRows.length ? <BookingRows rows={d.pendingRows} showCreated quickActions /> : <Empty>No pending or under-review requests.</Empty>}
      </Panel>

      <Panel title="Customer change requests">
        {d.openRequests.length === 0 ? (
          <Empty>No open modification or cancellation requests.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {d.openRequests.map(({ request, booking }) => (
              <li key={request.requestId} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-ink">
                    {request.type === "cancellation" ? "Cancellation" : "Change"} · {booking ? `${booking.customerName || "—"} · ${formatEventDate(booking.eventDate, "short")} ${booking.slotLabel}` : request.bookingId}
                  </p>
                  <p className="break-words text-ink-muted">
                    Submitted {formatTimestamp(request.createdAt)}
                    {request.summary.length > 0 && ` · ${request.summary.join(" · ")}`}
                  </p>
                </div>
                <Link href={`/admin/bookings/${request.bookingId}#requests`} className="btn btn-outline btn-sm shrink-0 self-start">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
