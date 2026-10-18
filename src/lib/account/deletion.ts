// Customer account deletion — the data part (the route deletes the Firebase
// Auth user afterwards). Pure server logic over the store interfaces, so the
// unit tests run it on the in-memory stores.
//
// What happens:
//  * refused while the customer has an active booking (pending / under review,
//    or confirmed for today or later): the venue may still need to reach them;
//  * DELETED: the profile (users/{uid}), the customer's notifications and
//    their reviews (their own public text);
//  * KEPT, anonymised: bookings, change requests, payments (receipts) and
//    quotations. They are the venue's booking and financial records; the
//    account link (customerId / createdBy) becomes a "deleted_…" reference
//    that cannot be turned back into the account, and the account email is
//    removed from the booking contact. The name and phone given for the
//    booking, and the immutable receipt / quotation snapshots, stay with the
//    record for the retention period the owner confirms (see the security report).
//  * Admin audit records are never edited (integrity); they only hold the
//    former uid, which no longer identifies an account once it is deleted.
import { createHash } from "node:crypto";
import type { ProfileStore } from "./profile.ts";
import type { BookingRecord } from "../booking/model.ts";
import type { BookingStore } from "../booking/store.ts";
import { reviewIdFor } from "../booking/reviews.ts";

/** Same input → same reference, so the venue can still group a former customer's records. */
export function anonymisedCustomerRef(uid: string): string {
  return `deleted_${createHash("sha256").update(`deleted-account\n${uid}`).digest("hex").slice(0, 20)}`;
}

/** A booking that still needs the customer reachable blocks deletion. */
export function blocksDeletion(b: Pick<BookingRecord, "status" | "eventDate">, today: string): boolean {
  if (b.status === "pending" || b.status === "under_review") return true;
  return b.status === "confirmed" && b.eventDate >= today;
}

export type DeletionResult =
  | { ok: true; ref: string; bookings: number; requests: number; payments: number; quotations: number; reviews: number; notifications: number }
  | { ok: false; code: "active_bookings"; count: number };

export async function deleteCustomerData(
  store: BookingStore,
  profiles: ProfileStore,
  uid: string,
  options: { today: string; now: Date }
): Promise<DeletionResult> {
  const ref = anonymisedCustomerRef(uid);
  const bookings = await store.listBookingsForCustomer(uid, 2000);
  const active = bookings.filter((b) => blocksDeletion(b, options.today));
  if (active.length) return { ok: false, code: "active_bookings", count: active.length };

  const counts = { bookings: 0, requests: 0, payments: 0, quotations: 0, reviews: 0, notifications: 0 };

  for (const { bookingId } of bookings) {
    const done = await store.runTransaction(async (tx) => {
      const booking = await tx.getBooking(bookingId);
      if (!booking || booking.data.customerId !== uid) return null;
      // Re-checked inside the transaction: never anonymise an active booking.
      if (blocksDeletion(booking.data, options.today)) throw Object.assign(new Error("active booking"), { code: "active_bookings" });
      const payments = [];
      for (const p of await tx.listPaymentsForBooking(bookingId)) {
        if (p.customerId === uid) payments.push(await tx.getPayment(p.paymentId));
      }
      const quotations = [];
      for (const q of await tx.listQuotationsForBooking(bookingId)) {
        if (q.customerId === uid) quotations.push(await tx.getQuotation(q.quotationId));
      }
      const review = await tx.getReview(reviewIdFor(bookingId));

      const b = booking.data;
      tx.updateBooking(
        bookingId,
        {
          customerId: ref,
          customer: { ...b.customer, email: null },
          ...(b.createdBy.kind === "customer" && b.createdBy.uid === uid ? { createdBy: { kind: "customer" as const, uid: ref } } : {}),
          updatedAt: options.now,
        },
        booking.version
      );
      for (const p of payments) if (p) tx.updatePayment(p.data.paymentId, { customerId: ref }, p.version);
      for (const q of quotations) if (q) tx.updateQuotation(q.data.quotationId, { customerId: ref }, q.version);
      const ownReview = review && review.data.customerId === uid;
      if (ownReview) tx.deleteReview(review.data.reviewId, review.version);
      return { payments: payments.filter(Boolean).length, quotations: quotations.filter(Boolean).length, review: ownReview ? 1 : 0 };
    });
    if (done) {
      counts.bookings++;
      counts.payments += done.payments;
      counts.quotations += done.quotations;
      counts.reviews += done.review;
    }
  }

  // Requests are listed in pages (the query is capped), until none is left.
  for (let page = 0; page < 50; page++) {
    const requests = await store.listRequestsForCustomer(uid, {});
    if (!requests.length) break;
    for (const r of requests) {
      const changed = await store.runTransaction(async (tx) => {
        const current = await tx.getRequest(r.requestId);
        if (!current || current.data.customerId !== uid) return false;
        tx.updateRequest(r.requestId, { customerId: ref });
        return true;
      });
      if (changed) counts.requests++;
    }
  }

  // Notifications: deleted page by page (bounded, so a huge history can't loop forever).
  for (let page = 0; page < 100; page++) {
    const batch = await store.listNotificationsForCustomer(uid, { before: null, limit: 100 });
    if (!batch.length) break;
    counts.notifications += await store.runTransaction(async (tx) => {
      const read = [];
      for (const n of batch) read.push(await tx.getNotification(n.notificationId));
      let deleted = 0;
      for (const n of read) {
        if (n && n.data.customerId === uid) {
          tx.deleteNotification(n.data.notificationId, n.version);
          deleted++;
        }
      }
      return deleted;
    });
  }

  await profiles.delete(uid);
  return { ok: true, ref, ...counts };
}
