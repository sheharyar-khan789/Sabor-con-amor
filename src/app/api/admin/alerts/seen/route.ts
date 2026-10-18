// POST /api/admin/alerts/seen  { upTo }  (ISO time of the newest item the admin was shown)
// Super Admin only, same-origin, strict fields. Moves this admin's "last seen"
// marker forward (adminState/{uid}); per-admin UI state, nothing else changes.
import { markAlertsSeen } from "@/lib/booking/admin-alerts";
import { adminMutation, json, rejectUnknownFields } from "@/lib/booking/admin-api";

export async function POST(request: Request) {
  return adminMutation(request, async ({ admin, store, body }) => {
    const unknown = rejectUnknownFields(body, ["upTo"]);
    if (unknown) return unknown;
    const upTo = typeof body.upTo === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(body.upTo) ? new Date(body.upTo) : null;
    if (!upTo || Number.isNaN(upTo.getTime())) return json({ error: "invalid_request" }, 400);
    const r = await markAlertsSeen(store, admin, upTo);
    return json({ ok: true, lastSeenAt: r.lastSeenAt.toISOString() });
  });
}
