// POST /api/admin/bookings/{id}/archive  { archive: boolean, expectedUpdatedAt, reason? }
// Super Admin only, same-origin, strict fields. Archive hides a finished booking
// (completed / cancelled / rejected / expired) from the default admin lists;
// restore brings it back. The record and its finances are never changed. Audited.
import { adminSetArchived } from "@/lib/booking/admin-archive";
import { adminMutation, failure, json, optionalString, rejectUnknownFields } from "@/lib/booking/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    const unknown = rejectUnknownFields(body, ["archive", "expectedUpdatedAt", "reason"]);
    if (unknown) return unknown;
    if (!/^bk_[0-9a-f]{24}$/.test(bookingId)) return failure("not_found", 404);
    if (typeof body.archive !== "boolean" || typeof body.expectedUpdatedAt !== "string") return json({ error: "invalid_request" }, 400);
    if (body.reason !== undefined && typeof body.reason !== "string") return json({ error: "invalid_request" }, 400);
    const result = await adminSetArchived(store, admin, bookingId, body.archive, {
      expectedUpdatedAt: body.expectedUpdatedAt,
      reason: optionalString(body.reason, 500),
    });
    if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : 409);
    return json({ ok: true, archived: body.archive });
  });
}
