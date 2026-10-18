// New-request alerts for the Super Admin (admin improvements, step 5), in-app only.
// Count = pending + under-review bookings + open change requests; newest first;
// "New" = created after the admin's last visit (adminState/{uid}.lastSeenAt,
// stored per admin on the server). Marking seen only moves that timestamp
// forward, up to the newest item the admin was actually shown.
import type { AdminActor } from "./audit-model.ts";
import { bookingReference, type BookingRecord } from "./model.ts";
import type { BookingRequestRecord } from "./request-model.ts";
import type { BookingStatus } from "./status.ts";
import type { BookingStore, BookingTransaction } from "./store.ts";

export interface AlertItem {
  kind: "booking" | "request";
  /** bookingId (booking) or requestId (change request). */
  id: string;
  bookingId: string;
  reference: string;
  customerName: string;
  /** e.g. "Pending" / "Under review" / "Change request" / "Cancellation request". */
  label: string;
  eventDate: string | null;
  slotLabel: string | null;
  status: BookingStatus | null;
  createdAt: string;
  isNew: boolean;
}

export interface AlertSummary {
  count: number;
  newCount: number;
  pending: number;
  underReview: number;
  openRequests: number;
  items: AlertItem[];
  lastSeenAt: string | null;
}

const iso = (d: Date | string) => new Date(d).toISOString();

export function buildAlerts(
  waiting: BookingRecord[],
  requests: BookingRequestRecord[],
  requestBookings: BookingRecord[],
  lastSeenAt: Date | null
): AlertSummary {
  const seen = lastSeenAt ? new Date(lastSeenAt).getTime() : -Infinity;
  const isNew = (d: Date | string) => new Date(d).getTime() > seen;
  const byId = new Map(requestBookings.map((b) => [b.bookingId, b]));
  const open = waiting.filter((b) => b.status === "pending" || b.status === "under_review");
  const openReqs = requests.filter((r) => r.status === "open");
  const items: AlertItem[] = [
    ...open.map((b) => ({
      kind: "booking" as const,
      id: b.bookingId,
      bookingId: b.bookingId,
      reference: bookingReference(b.bookingId),
      customerName: b.customer?.name ?? "",
      label: b.status === "pending" ? "New booking request" : "Under review",
      eventDate: b.eventDate,
      slotLabel: b.slotLabel,
      status: b.status,
      createdAt: iso(b.createdAt),
      isNew: isNew(b.createdAt),
    })),
    ...openReqs.map((r) => {
      const b = byId.get(r.bookingId);
      return {
        kind: "request" as const,
        id: r.requestId,
        bookingId: r.bookingId,
        reference: bookingReference(r.bookingId),
        customerName: b?.customer?.name ?? "",
        label: r.type === "cancellation" ? "Cancellation request" : "Change request",
        eventDate: b?.eventDate ?? null,
        slotLabel: b?.slotLabel ?? null,
        status: b?.status ?? null,
        createdAt: iso(r.createdAt),
        isNew: isNew(r.createdAt),
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    count: items.length,
    newCount: items.filter((i) => i.isNew).length,
    pending: open.filter((b) => b.status === "pending").length,
    underReview: open.filter((b) => b.status === "under_review").length,
    openRequests: openReqs.length,
    items,
    lastSeenAt: lastSeenAt ? iso(lastSeenAt) : null,
  };
}

/** Loads the alert summary for one admin (Super Admin callers only). */
export async function loadAlertSummary(store: BookingStore, adminUid: string): Promise<AlertSummary> {
  const [waiting, requests, state] = await Promise.all([
    store.listBookingsByStatus(["pending", "under_review"], 500),
    store.listOpenRequests(100),
    store.getAdminState(adminUid),
  ]);
  const requestBookings = await store.getBookings(requests.map((r) => r.bookingId));
  return buildAlerts(waiting, requests, requestBookings, state?.lastSeenAt ?? null);
}

/**
 * Marks everything created up to `upTo` as seen for this admin. Never moves the
 * marker backwards and never past `now` (a forged future time can't hide items).
 */
export async function markAlertsSeen(store: BookingStore, actor: AdminActor, upTo: Date, options: { now?: Date } = {}) {
  const now = options.now ?? new Date();
  const target = new Date(Math.min(upTo.getTime(), now.getTime()));
  return store.runTransaction(async (tx: BookingTransaction): Promise<{ ok: true; lastSeenAt: Date; changed: boolean }> => {
    const current = await tx.getAdminState(actor.uid);
    const previous = current?.data.lastSeenAt ? new Date(current.data.lastSeenAt) : null;
    if (previous && previous.getTime() >= target.getTime()) return { ok: true, lastSeenAt: previous, changed: false };
    tx.putAdminState({ uid: actor.uid, lastSeenAt: target, updatedAt: now }, current ? current.version : null);
    return { ok: true, lastSeenAt: target, changed: true };
  });
}
