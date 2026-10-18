// POST /api/admin/slots/unblock  { slotKey, blockId }
// Super Admin only, same-origin, strict fields. Removes one block (audited);
// the slot becomes available again.
import { unblockSlot } from "@/lib/booking/admin-blocks";
import { adminMutation, failure, json, rejectUnknownFields } from "@/lib/booking/admin-api";

export async function POST(request: Request) {
  return adminMutation(request, async ({ admin, store, body }) => {
    const unknown = rejectUnknownFields(body, ["slotKey", "blockId"]);
    if (unknown) return unknown;
    if (typeof body.slotKey !== "string" || !/^\d{4}-\d{2}-\d{2}__[a-z0-9-]{1,40}__(day|night)$/.test(body.slotKey)) return json({ error: "invalid_request" }, 400);
    if (typeof body.blockId !== "string" || !/^blk_[0-9a-f]{24}$/.test(body.blockId)) return json({ error: "invalid_request" }, 400);
    const result = await unblockSlot(store, admin, body.slotKey, body.blockId);
    if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : 409);
    return json({ ok: true });
  });
}
