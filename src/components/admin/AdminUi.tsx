import Link from "next/link";
import type { AdminBookingRow } from "@/lib/booking/admin-view";
import { REVIEW_STATUSES, SOURCE_LABELS, statusLabel } from "@/lib/booking/admin-view";
import type { SlotState } from "@/lib/booking/availability";
import { formatEventDate, formatTimestamp } from "@/lib/booking/format";
import type { BookingStatus } from "@/lib/booking/status";
import Icon, { type IconName } from "../Icon";
import QuickDecision from "./QuickDecision";

// Operational admin UI: clear, dense, readable. Status = icon + text, never colour alone.

// Colours: the design system's operational status palette (DESIGN.md).
const STATUS_STYLE: Record<BookingStatus, { icon: IconName; cls: string }> = {
  pending: { icon: "clock", cls: "border-status-pending/25 bg-status-pending-bg text-status-pending" },
  under_review: { icon: "eye", cls: "border-status-review/25 bg-status-review-bg text-status-review" },
  confirmed: { icon: "check", cls: "border-status-confirmed/25 bg-status-confirmed-bg text-status-confirmed" },
  completed: { icon: "star", cls: "border-line-strong/40 bg-surface-mid text-ink" },
  cancelled: { icon: "close", cls: "border-line-strong/40 bg-surface-mid text-ink-soft" },
  rejected: { icon: "close", cls: "border-status-cancelled/25 bg-status-cancelled-bg text-status-cancelled" },
  expired: { icon: "alert", cls: "border-line-strong/40 bg-surface-mid text-ink-soft" },
};

/** "Archived" marker (text + icon, not colour alone). */
export function ArchivedTag() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line-strong bg-surface-mid px-2 py-0.5 text-xs font-semibold text-ink-soft">
      <Icon name="doc" className="h-3.5 w-3.5" />
      Archived
    </span>
  );
}

export function StatusPill({ status, lapsed = false }: { status: BookingStatus; lapsed?: boolean }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      <Icon name={s.icon} className="h-3.5 w-3.5" />
      {statusLabel(status)}
      {lapsed && <span className="font-normal">· hold lapsed</span>}
    </span>
  );
}

const SLOT_STATE: Record<SlotState, { label: string; cls: string; icon: IconName }> = {
  available: { label: "Available", cls: "text-slot-free", icon: "check" },
  held: { label: "On hold", cls: "text-amber-800", icon: "clock" },
  booked: { label: "Booked", cls: "text-slot-booked", icon: "shield" },
  closed: { label: "Closed", cls: "text-ink-muted", icon: "close" },
};

export function SlotStateText({ state }: { state: SlotState | null }) {
  if (!state) return <span className="text-ink-muted">Unknown</span>;
  const s = SLOT_STATE[state];
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${s.cls}`}>
      <Icon name={s.icon} className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: React.ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="chip mb-3">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-[0.9375rem] text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Panel({ title, children, action, id }: { title: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  const headingId = id ?? `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-line bg-surface p-5 shadow-soft sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="font-display text-[1.375rem] font-semibold text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex flex-col items-center gap-3 px-4 py-10 text-center text-[0.9375rem] text-ink-muted">
      <Icon name="check" className="h-5 w-5 text-gold" />
      {children}
    </p>
  );
}

export function AdminError({ reason, retryHref }: { reason: "unavailable" | "error"; retryHref: string }) {
  return (
    <div role="alert" className="rounded-lg border border-status-cancelled/20 bg-status-cancelled-bg p-5 text-sm text-status-cancelled">
      <p className="font-semibold">{reason === "unavailable" ? "The booking database is not configured." : "The booking database didn't respond."}</p>
      <p className="mt-1">No data is shown rather than showing something possibly wrong.</p>
      <a href={retryHref} className="btn btn-ghost btn-sm mt-3 border-red-300 text-red-900">
        Try again
      </a>
    </div>
  );
}

function RowDecision({ r }: { r: AdminBookingRow }) {
  return (
    <QuickDecision
      bookingId={r.bookingId}
      reference={r.reference}
      customerName={r.customerName}
      when={`${formatEventDate(r.eventDate, "short")} · ${r.slotLabel}`}
      status={r.status}
      updatedAt={r.updatedAt}
    />
  );
}

/**
 * Bookings as a table on wide screens and as cards on phones (no page-wide horizontal scroll).
 * `quickActions`: Accept / Reject on pending and under-review rows (outside the row link).
 */
export function BookingRows({ rows, showCreated = false, quickActions = false }: { rows: AdminBookingRow[]; showCreated?: boolean; quickActions?: boolean }) {
  if (!rows.length) return <Empty>No bookings match.</Empty>;
  const decides = (r: AdminBookingRow) => quickActions && (REVIEW_STATUSES as readonly BookingStatus[]).includes(r.status);
  return (
    <>
      <ul className="space-y-2 lg:hidden">
        {rows.map((r) => (
          <li key={r.bookingId}>
            <Link
              href={`/admin/bookings/${r.bookingId}`}
              className={`block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-ink/30 ${decides(r) ? "rounded-b-none" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{formatEventDate(r.eventDate, "short")} · {r.slotLabel}</p>
                  <p className="break-words text-sm text-ink-soft">{r.customerName || "—"} · {r.eventTypeLabel}</p>
                </div>
                <span className="flex flex-wrap gap-1">
                  <StatusPill status={r.status} lapsed={r.holdLapsed} />
                  {r.archived && <ArchivedTag />}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                <span className="font-mono">{r.reference}</span> · {r.guestCount.toLocaleString("en-US")} guests · {SOURCE_LABELS[r.source]}
                {showCreated && <> · submitted {formatTimestamp(r.createdAt)}</>}
              </p>
            </Link>
            {decides(r) && (
              <div className="rounded-b-lg border border-t-0 border-line bg-surface-low px-4 py-3">
                <RowDecision r={r} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-low text-eyebrow uppercase text-ink-muted">
              <th scope="col" className="py-3.5 pl-3 pr-3 font-medium">Ref</th>
              <th scope="col" className="py-3.5 pr-3 font-medium">Date</th>
              <th scope="col" className="py-3.5 pr-3 font-medium">Slot</th>
              <th scope="col" className="py-3.5 pr-3 font-medium">Customer</th>
              <th scope="col" className="py-3.5 pr-3 font-medium">Event</th>
              <th scope="col" className="py-3.5 pr-3 text-right font-medium">Guests</th>
              <th scope="col" className="py-3.5 pr-3 font-medium">Status</th>
              <th scope="col" className={`py-3.5 font-medium ${quickActions ? "pr-3" : ""}`}>{showCreated ? "Submitted" : "Source"}</th>
              {quickActions && <th scope="col" className="py-3.5 pr-3 font-medium">Decision</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bookingId} className="relative cursor-pointer border-b border-line transition-colors hover:bg-surface-low">
                <td className="py-4 pl-3 pr-3">
                  <Link
                    href={`/admin/bookings/${r.bookingId}`}
                    aria-label={`Open booking ${r.reference} · ${r.customerName || "no name"} · ${statusLabel(r.status)}`}
                    className="font-mono font-semibold text-gold underline-offset-2 after:absolute after:inset-0 after:content-[''] hover:underline"
                  >
                    {r.reference}
                  </Link>
                </td>
                <td className="whitespace-nowrap py-4 pr-3">{formatEventDate(r.eventDate, "short")}</td>
                <td className="py-4 pr-3">{r.slotLabel}</td>
                <td className="max-w-[14rem] py-4 pr-3">
                  <span className="block truncate">{r.customerName || "—"}</span>
                </td>
                <td className="py-4 pr-3">{r.eventTypeLabel}</td>
                <td className="py-4 pr-3 text-right tabular-nums">{r.guestCount.toLocaleString("en-US")}</td>
                <td className="py-4 pr-3">
                  <span className="flex flex-wrap gap-1">
                    <StatusPill status={r.status} lapsed={r.holdLapsed} />
                    {r.archived && <ArchivedTag />}
                  </span>
                </td>
                <td className={`whitespace-nowrap py-4 ${quickActions ? "pr-3" : ""}`}>{showCreated ? formatTimestamp(r.createdAt) : SOURCE_LABELS[r.source]}</td>
                {quickActions && (
                  // Positioned after the stretched row link, so the buttons sit above it (no z-index:
                  // the confirmation dialog must stay in the page's top stacking layer).
                  <td className="relative py-3 pr-3">{decides(r) ? <RowDecision r={r} /> : <span className="text-ink-muted">—</span>}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
