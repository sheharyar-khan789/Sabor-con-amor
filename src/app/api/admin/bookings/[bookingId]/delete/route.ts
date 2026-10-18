// POST /api/admin/bookings/{id}/delete  { expectedUpdatedAt, confirmReference, reason }
// SENSITIVE (sign-in within 15 minutes). Super Admin only, same-origin, strict
// fields. Deletes a test / spam booking (pending / rejected / expired /
// cancelled, no payments, quotations or event records) in one transaction:
// booking + its slot lock + its change requests; the audit record is kept.
import { adminDeleteBooking, validReason } from "@/lib/booking/admin-archive";
import { adminMutation, failure, json, rejectUnknownFields } from "@/lib/booking/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(
    request,
    async ({ admin, store, body }) => {
      const unknown = rejectUnknownFields(body, ["expectedUpdatedAt", "confirmReference", "reason"]);
      if (unknown) return unknown;
      if (!/^bk_[0-9a-f]{24}$/.test(bookingId)) return failure("not_found", 404);
      if (typeof body.expectedUpdatedAt !== "string" || typeof body.confirmReference !== "string") return json({ error: "invalid_request" }, 400);
      if (!validReason(body.reason)) return failure("invalid_reason", 400);
      const result = await adminDeleteBooking(store, admin, bookingId, {
        expectedUpdatedAt: body.expectedUpdatedAt,
        confirmReference: body.confirmReference,
        reason: body.reason,
      });
      if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : result.code === "reference_mismatch" || result.code === "invalid_reason" ? 400 : 409);
      return json({ ok: true, reference: result.reference });
    },
    { sensitive: true }
  );
}
