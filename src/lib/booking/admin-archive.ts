// Super Admin delete / archive (admin improvements, step 3) — SERVER ONLY in use.
//
// Delete is only for test / spam bookings that never became business records:
// status pending / rejected / expired / cancelled AND no payment, no quotation,
// no event-operations record and no vendor assignment (any status: payments and
// quotations are financial history and are never deleted). One transaction
// deletes the booking, releases its slot lock and removes its change requests;
// the audit record (who, when, reference, reason, a short summary) is kept.
// Everything else is archived instead: hidden from the default admin lists,
// with the record and its finances unchanged; Restore brings it back.
import type { AdminActor } from "./audit-model.ts";
import { auditRecord } from "./engine.ts";
import { bookingReference, type BookingRecord } from "./model.ts";
import { notifyInTransaction } from "./notifications.ts";
import type { BookingStatus } from "./status.ts";
import type { BookingStore, BookingTransaction } from "./store.ts";

export const DELETABLE_STATUSES: readonly BookingStatus[] = ["pending", "rejected", "expired", "cancelled"];
/** Archive is for finished records; a confirmed booking must be cancelled first, an open request decided first. */
export const ARCHIVABLE_STATUSES: readonly BookingStatus[] = ["completed", "cancelled", "rejected", "expired"];

export const isArchived = (b: Pick<BookingRecord, "archivedAt">) => !!b.archivedAt;

export const REASON_MIN = 3;
export const REASON_MAX = 500;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
export const validReason = (r: unknown): r is string =>
  typeof r === "string" && r.trim().length >= REASON_MIN && r.trim().length <= REASON_MAX && !CONTROL_CHARS.test(r);

export type DeleteRefusal = "not_deletable_status" | "has_payments" | "has_quotations" | "has_operations";

/** Why a booking may not be deleted (null = it may). Same rule for the page and the transaction. */
export function deleteRefusal(
  b: Pick<BookingRecord, "status">,
  related: { payments: number; quotations: number; operations: boolean; assignments: number }
): DeleteRefusal | null {
  if (!DELETABLE_STATUSES.includes(b.status)) return "not_deletable_status";
  if (related.payments > 0) return "has_payments";
  if (related.quotations > 0) return "has_quotations";
  if (related.operations || related.assignments > 0) return "has_operations";
  return null;
}

export type DeleteResult =
  | { ok: true; reference: string; removedRequests: number }
  | { ok: false; code: "not_found" | "stale" | "reference_mismatch" | "invalid_reason" | DeleteRefusal };

export async function adminDeleteBooking(
  store: BookingStore,
  actor: AdminActor,
  bookingId: string,
  options: { expectedUpdatedAt: string; confirmReference: string; reason: string; now?: Date }
): Promise<DeleteResult> {
  const now = options.now ?? new Date();
  if (!validReason(options.reason)) return { ok: false, code: "invalid_reason" };
  const reason = options.reason.trim();
  return store.runTransaction(async (tx: BookingTransaction): Promise<DeleteResult> => {
    // --- reads ---
    const found = await tx.getBooking(bookingId);
    if (!found) return { ok: false, code: "not_found" };
    const b = found.data;
    const reference = bookingReference(bookingId);
    if (options.confirmReference.trim().toUpperCase() !== reference) return { ok: false, code: "reference_mismatch" };
    if (new Date(b.updatedAt).toISOString() !== options.expectedUpdatedAt) return { ok: false, code: "stale" };
    const payments = await tx.listPaymentsForBooking(bookingId);
    const quotations = await tx.listQuotationsForBooking(bookingId);
    const operations = await tx.getOperations(bookingId);
    const assignments = await tx.listAssignmentsForBookingTx(bookingId);
    const refusal = deleteRefusal(b, { payments: payments.length, quotations: quotations.length, operations: !!operations, assignments: assignments.length });
    if (refusal) return { ok: false, code: refusal };
    const lock = await tx.getLock(b.slotKey);
    const requests = await tx.listRequestsForBookingTx(bookingId);

    // --- writes (all or nothing) ---
    tx.deleteBooking(bookingId, found.version);
    if (lock && lock.data.bookingId === bookingId) tx.deleteLock(b.slotKey, lock.version);
    for (const r of requests) tx.deleteRequest(r.requestId);
    notifyInTransaction(tx, { type: "BOOKING_REMOVED" }, b, now);
    tx.createAudit({
      ...auditRecord("booking_deleted", actor, bookingId, now, {
        before: {
          reference,
          status: b.status,
          eventDate: b.eventDate,
          slotId: b.slotId,
          customerName: b.customer.name,
          customerId: b.customerId,
          source: b.source,
          openRequests: requests.filter((r) => r.status === "open").length,
          requests: requests.length,
        },
        after: null,
        reason,
      }),
      entityType: "booking",
      entityId: bookingId,
    });
    return { ok: true, reference, removedRequests: requests.length };
  });
}

export type ArchiveResult =
  | { ok: true; booking: BookingRecord }
  | { ok: false; code: "not_found" | "stale" | "not_archivable" | "already_archived" | "not_archived" };

/** Archive (archive = true) or restore (false). Not destructive: the record and its finances are unchanged. */
export async function adminSetArchived(
  store: BookingStore,
  actor: AdminActor,
  bookingId: string,
  archive: boolean,
  options: { expectedUpdatedAt: string; reason?: string; now?: Date }
): Promise<ArchiveResult> {
  const now = options.now ?? new Date();
  const reason = (options.reason ?? "").trim().slice(0, REASON_MAX);
  return store.runTransaction(async (tx: BookingTransaction): Promise<ArchiveResult> => {
    const found = await tx.getBooking(bookingId);
    if (!found) return { ok: false, code: "not_found" };
    const b = found.data;
    if (new Date(b.updatedAt).toISOString() !== options.expectedUpdatedAt) return { ok: false, code: "stale" };
    if (archive && isArchived(b)) return { ok: false, code: "already_archived" };
    if (!archive && !isArchived(b)) return { ok: false, code: "not_archived" };
    if (archive && !ARCHIVABLE_STATUSES.includes(b.status)) return { ok: false, code: "not_archivable" };
    const patch: Partial<BookingRecord> = archive
      ? { archivedAt: now, archivedBy: { uid: actor.uid }, updatedAt: now }
      : { archivedAt: null, archivedBy: null, updatedAt: now };
    tx.updateBooking(bookingId, patch, found.version);
    tx.createAudit(
      auditRecord(archive ? "booking_archived" : "booking_restored", actor, bookingId, now, {
        before: { archived: isArchived(b), status: b.status },
        after: { archived: archive, status: b.status },
        reason,
      })
    );
    return { ok: true, booking: { ...b, ...patch } };
  });
}
