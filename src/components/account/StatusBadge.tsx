import type { BookingStatus } from "@/lib/booking/status";
import { STATUS_LABELS } from "@/lib/booking/status";
import Icon, { type IconName } from "../Icon";

// Status is always shown as text + icon, never by colour alone. Colours follow
// the design system's operational status palette (DESIGN.md): pending = honey
// amber, in review = sapphire, confirmed = emerald, cancelled / alert = crimson.
const STYLE: Record<BookingStatus, { icon: IconName; className: string }> = {
  pending: { icon: "clock", className: "border-status-pending/20 bg-status-pending-bg text-status-pending" },
  under_review: { icon: "clock", className: "border-status-review/20 bg-status-review-bg text-status-review" },
  confirmed: { icon: "check", className: "border-status-confirmed/20 bg-status-confirmed-bg text-status-confirmed" },
  completed: { icon: "star", className: "border-line bg-surface-mid text-ink" },
  cancelled: { icon: "close", className: "border-status-cancelled/20 bg-status-cancelled-bg text-status-cancelled" },
  rejected: { icon: "close", className: "border-status-cancelled/20 bg-status-cancelled-bg text-status-cancelled" },
  expired: { icon: "alert", className: "border-line bg-surface-mid text-ink-soft" },
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const style = STYLE[status] ?? STYLE.pending;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] ${style.className}`}
    >
      <Icon name={style.icon} className="h-3.5 w-3.5" />
      <span>
        <span className="sr-only">Status: </span>
        {STATUS_LABELS[status] ?? status}
      </span>
    </span>
  );
}
