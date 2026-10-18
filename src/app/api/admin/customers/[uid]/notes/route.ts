// POST /api/admin/customers/{uid}/notes  { notes, expectedUpdatedAt }
// Super Admin only, same-origin, strict fields. Internal notes about the
// customer (customerNotes/{uid}); never returned by any customer page or API.
// Audited (lengths only).
import { adminSaveCustomerNotes, CUSTOMER_UID } from "@/lib/booking/admin-customers";
import { adminMutation, failure, json, rejectUnknownFields } from "@/lib/booking/admin-api";
import { profileStore } from "@/lib/booking/server";

export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    const unknown = rejectUnknownFields(body, ["notes", "expectedUpdatedAt"]);
    if (unknown) return unknown;
    if (body.expectedUpdatedAt !== null && typeof body.expectedUpdatedAt !== "string") return json({ error: "invalid_request" }, 400);
    if (!CUSTOMER_UID.test(uid)) return failure("not_found", 404);
    // Only for a known customer (a profile or at least one booking).
    const known = (await profileStore()?.get(uid)) || (await store.listBookingsForCustomer(uid, 1)).length > 0;
    if (!known) return failure("customer_not_found", 404);
    const result = await adminSaveCustomerNotes(store, admin, uid, body.notes, { expectedUpdatedAt: body.expectedUpdatedAt as string | null });
    if (!result.ok && result.code === "stale") {
      return json({ error: "stale", message: "This customer's details changed since you opened the page. Reload and try again." }, 409);
    }
    if (!result.ok) return failure(result.code, result.code === "invalid_notes" ? 400 : result.code === "not_found" ? 404 : 409);
    return json({ ok: true, updatedAt: result.updatedAt });
  });
}
