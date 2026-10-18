// POST /api/admin/slots/block  { date, slot: "day" | "night" | "both", kind, reason }
// SENSITIVE (sign-in within 15 minutes). Super Admin only, same-origin, strict
// fields. Blocks the slot(s) through the existing slot-lock mechanism (one
// transaction, audited). Refuses past dates and any slot with an active booking.
import { blockSlots, validateBlockInput } from "@/lib/booking/admin-blocks";
import { ADMIN_ERROR_MESSAGES, adminMutation, json, rejectUnknownFields } from "@/lib/booking/admin-api";
import { DEFAULT_HALL_ID } from "@/lib/config/business-config";
import { loadConfigFresh } from "@/lib/config/config-server";

export async function POST(request: Request) {
  return adminMutation(
    request,
    async ({ admin, store, body }) => {
      const unknown = rejectUnknownFields(body, ["date", "slot", "kind", "reason"]);
      if (unknown) return unknown;
      const v = validateBlockInput(body);
      if (!v.ok) return json({ error: "invalid_request", field: v.field, message: v.message }, 400);
      const cfg = await loadConfigFresh();
      if (!cfg.ok) return json({ error: "database_error", message: "The business configuration couldn't be loaded. Nothing was changed." }, 503);
      const result = await blockSlots(store, admin, v.value, { hallId: DEFAULT_HALL_ID, config: cfg.config });
      if (!result.ok) {
        const status = result.code === "slot_occupied" || result.code === "already_blocked" ? 409 : 400;
        return json({ error: result.code, message: ADMIN_ERROR_MESSAGES[result.code], slotId: result.slotId }, status);
      }
      return json({ ok: true, blocked: result.blocked.map((l) => ({ slotKey: l.slotKey, slotId: l.slotId, blockId: l.bookingId })) }, 201);
    },
    { sensitive: true }
  );
}
