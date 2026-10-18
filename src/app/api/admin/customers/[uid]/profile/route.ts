// POST /api/admin/customers/{uid}/profile  { name, phone, expectedUpdatedAt }
// Super Admin only, same-origin, strict fields. Edits the name / phone on the
// customer's profile (never the sign-in email), with an audit record and the
// customer's in-app notification in the same transaction.
import { adminUpdateCustomerProfile } from "@/lib/booking/admin-customers";
import { adminMutation, failure, json, rejectUnknownFields } from "@/lib/booking/admin-api";
import { adminAuth } from "@/lib/firebase/admin";
import { logBookingError, profileStore, withTimeout } from "@/lib/booking/server";

export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return adminMutation(request, async ({ admin, body }) => {
    const unknown = rejectUnknownFields(body, ["name", "phone", "expectedUpdatedAt"]);
    if (unknown) return unknown;
    if (body.expectedUpdatedAt !== null && typeof body.expectedUpdatedAt !== "string") return json({ error: "invalid_request" }, 400);
    const profiles = profileStore();
    if (!profiles) return json({ error: "booking_unavailable" }, 503);
    const result = await adminUpdateCustomerProfile(profiles, admin, uid, { name: body.name, phone: body.phone }, { expectedUpdatedAt: body.expectedUpdatedAt as string | null });
    if (!result.ok && result.code === "stale") {
      return json({ error: "stale", message: "This customer's details changed since you opened the page. Reload and try again." }, 409);
    }
    if (!result.ok) {
      if (result.code === "invalid_request") return json({ error: "invalid_request", fields: result.fields }, 400);
      return failure(result.code, result.code === "not_found" ? 404 : result.code === "no_change" ? 400 : 409);
    }
    // Keep the Firebase Auth display name in step (best effort, like the customer's own profile page).
    if (result.changed.includes("name")) {
      await withTimeout(adminAuth().updateUser(uid, { displayName: result.profile.name ?? undefined }), 10_000).catch((error) => logBookingError("display name update", error));
    }
    return json({ ok: true, profile: { name: result.profile.name, phone: result.profile.phone } });
  });
}
