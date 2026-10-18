// POST /api/admin/bookings/{id}/edit
//   { changes: {...}, expectedUpdatedAt, expectedTotal?, preview? }
// Super Admin only (same-origin). preview: true answers what the edit would do
// (changed fields, price before/after, whether the new slot is free) and writes
// nothing. Applying is SENSITIVE (sign-in within 15 minutes) and runs in one
// transaction: booking + slot locks + audit record + customer notification.
import { adminEditBooking, planEdit, validateBookingEdit } from "@/lib/booking/admin-edit";
import { adminMutation, failure, json, rejectUnknownFields } from "@/lib/booking/admin-api";
import { lockIsActive } from "@/lib/booking/model";
import { loadConfigFresh } from "@/lib/config/config-server";

const FIELDS = ["changes", "expectedUpdatedAt", "expectedTotal", "preview"] as const;

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body, requireRecentSignIn }) => {
    const unknown = rejectUnknownFields(body, FIELDS);
    if (unknown) return unknown;
    if (!/^bk_[0-9a-f]{24}$/.test(bookingId)) return failure("not_found", 404);
    if (typeof body.expectedUpdatedAt !== "string") return json({ error: "invalid_request", message: "expectedUpdatedAt is required." }, 400);
    if (body.preview !== undefined && typeof body.preview !== "boolean") return json({ error: "invalid_request" }, 400);
    const expectedTotal = body.expectedTotal;
    if (expectedTotal !== undefined && expectedTotal !== null && !(typeof expectedTotal === "number" && Number.isInteger(expectedTotal) && expectedTotal >= 0)) {
      return json({ error: "invalid_request" }, 400);
    }
    const v = validateBookingEdit(body.changes);
    if (!v.ok) return json({ error: v.errors.body?.code === "unexpected_field" ? "unexpected_field" : "invalid_request", fields: v.errors }, 400);
    const cfg = await loadConfigFresh();
    if (!cfg.ok) return json({ error: "database_error", message: "The business configuration couldn't be loaded. Nothing was changed." }, 503);

    if (body.preview === true) {
      const booking = await store.getBooking(bookingId);
      if (!booking) return failure("not_found", 404);
      if (new Date(booking.updatedAt).toISOString() !== body.expectedUpdatedAt) return failure("stale");
      const now = new Date();
      const p = planEdit(booking, v.value, cfg.config, now);
      if (!p.ok) return json({ error: p.code, field: p.field, message: p.message ?? undefined, missing: p.missing }, p.code === "invalid_change" || p.code === "no_change" ? 400 : 409);
      let slotFree = true;
      if (p.plan.moving) {
        const locks = await store.listLocks(booking.hallId, p.plan.updated.eventDate, p.plan.updated.eventDate);
        const lock = locks.find((l) => l.slotKey === p.plan.updated.slotKey);
        slotFree = !lock || lock.bookingId === bookingId || !lockIsActive(lock, now);
      }
      return json({
        ok: true,
        preview: {
          changes: p.plan.changes,
          moving: p.plan.moving,
          slotFree,
          price: p.plan.price ? { before: p.plan.price.before, after: p.plan.price.after } : null,
        },
      });
    }

    const reauth = requireRecentSignIn();
    if (reauth) return reauth;
    const result = await adminEditBooking(store, admin, bookingId, v.value, {
      expectedUpdatedAt: body.expectedUpdatedAt,
      expectedTotal: expectedTotal as number | null | undefined,
      config: cfg.config,
    });
    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : result.code === "invalid_change" || result.code === "no_change" ? 400 : 409;
      if (result.code === "invalid_change" || result.code === "pricing_incomplete" || result.code === "price_confirmation_required") {
        return json({ error: result.code, field: result.field, message: result.message ?? undefined, missing: result.missing, price: result.price }, status);
      }
      return failure(result.code, status);
    }
    return json({ ok: true, changes: result.changes.length, total: result.booking.pricing?.total ?? null });
  });
}
