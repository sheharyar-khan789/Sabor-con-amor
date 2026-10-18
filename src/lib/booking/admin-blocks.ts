// Super Admin "Blocked slots" (admin improvements, step 4) — SERVER ONLY in use.
//
// A block is a slot lock (slotLocks/{date__hall__slot}) whose bookingId is a
// block ID ("blk_…") and whose status is "confirmed", so the ONE availability
// rule and every booking path (website request, staff booking, status change,
// change approval, admin edit) treat the slot as taken: the public calendar
// shows it unavailable and nobody can request it. Blocking refuses a slot with
// an active booking; an expired pending hold is replaced (that request is
// marked expired, exactly like the engine does). Day / Night / Both are blocked
// together or not at all. Every block and unblock is audited.
import { randomUUID } from "node:crypto";
import { DEFAULT_CONFIG, getHall, getSlot, type BusinessConfig, type SlotId } from "../config/business-config.ts";
import type { AdminActor } from "./audit-model.ts";
import { addDays, businessToday, isIsoDate } from "./dates.ts";
import { auditRecord } from "./engine.ts";
import { BLOCK_KINDS, isBlockLock, lockIsActive, slotKey, type BlockKind, type BookingRecord, type SlotLock } from "./model.ts";
import { notifyInTransaction } from "./notifications.ts";
import type { BookingStore, BookingTransaction, Versioned } from "./store.ts";

export interface BlockInput {
  date: string;
  /** "both" = every active slot of the date. */
  slot: SlotId | "both";
  kind: BlockKind;
  reason: string;
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function validateBlockInput(raw: Record<string, unknown>): { ok: true; value: BlockInput } | { ok: false; field: string; message: string } {
  if (typeof raw.date !== "string" || !isIsoDate(raw.date)) return { ok: false, field: "date", message: "Choose a valid date." };
  if (raw.slot !== "day" && raw.slot !== "night" && raw.slot !== "both") return { ok: false, field: "slot", message: "Choose Day, Night or Both." };
  if (!(BLOCK_KINDS as readonly unknown[]).includes(raw.kind)) return { ok: false, field: "kind", message: "Choose why the slot is blocked." };
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  if (reason.length < 3 || reason.length > 200 || CONTROL_CHARS.test(reason)) return { ok: false, field: "reason", message: "Give a short reason (3–200 characters)." };
  return { ok: true, value: { date: raw.date, slot: raw.slot, kind: raw.kind as BlockKind, reason } };
}

export type BlockResult =
  | { ok: true; blocked: SlotLock[] }
  | { ok: false; code: "past_date" | "beyond_horizon" | "invalid_slot" | "slot_occupied" | "already_blocked"; slotId?: string };

export async function blockSlots(
  store: BookingStore,
  actor: AdminActor,
  input: BlockInput,
  options: { hallId: string; now?: Date; config?: BusinessConfig }
): Promise<BlockResult> {
  const now = options.now ?? new Date();
  const config = options.config ?? DEFAULT_CONFIG;
  const today = businessToday(now);
  if (input.date < today) return { ok: false, code: "past_date" };
  if (input.date > addDays(today, config.rules.bookingHorizonDays)) return { ok: false, code: "beyond_horizon" };
  const hall = getHall(config, options.hallId);
  const slotIds: SlotId[] =
    input.slot === "both" ? config.slots.filter((s) => s.active).map((s) => s.id) : getSlot(config, input.slot) ? [input.slot] : [];
  if (!hall || !slotIds.length) return { ok: false, code: "invalid_slot" };

  return store.runTransaction(async (tx: BookingTransaction): Promise<BlockResult> => {
    // --- reads: every slot must be free (or hold only an expired pending request) ---
    const current: { id: SlotId; key: string; lock: Versioned<SlotLock> | null; displaced: Versioned<BookingRecord> | null }[] = [];
    for (const id of slotIds) {
      const key = slotKey(input.date, hall.id, id);
      const lock = await tx.getLock(key);
      if (lock && isBlockLock(lock.data)) return { ok: false, code: "already_blocked", slotId: id };
      if (lock && lockIsActive(lock.data, now)) return { ok: false, code: "slot_occupied", slotId: id };
      const displaced = lock ? await tx.getBooking(lock.data.bookingId) : null;
      current.push({ id, key, lock, displaced });
    }
    // --- writes ---
    const blocked: SlotLock[] = [];
    for (const { id, key, lock, displaced } of current) {
      const record: SlotLock = {
        slotKey: key,
        date: input.date,
        hallId: hall.id,
        slotId: id,
        bookingId: `blk_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        status: "confirmed",
        holdExpiresAt: null,
        updatedAt: now,
        block: { kind: input.kind, reason: input.reason, blockedAt: now, blockedBy: { uid: actor.uid, email: actor.email ?? null } },
      };
      if (lock) tx.replaceLock(record, lock.version);
      else tx.createLock(record);
      if (displaced && displaced.data.status === "pending") {
        tx.updateBooking(
          displaced.data.bookingId,
          { status: "expired", holdExpiresAt: null, updatedAt: now, timeline: { ...displaced.data.timeline, expiredAt: now } },
          displaced.version
        );
        notifyInTransaction(tx, { type: "BOOKING_EXPIRED" }, displaced.data, now);
      }
      tx.createAudit({
        ...auditRecord("slot_blocked", actor, "", now, { after: { date: input.date, slotId: id, kind: input.kind, blockId: record.bookingId }, reason: input.reason }),
        entityType: "slot",
        entityId: key,
      });
      blocked.push(record);
    }
    return { ok: true, blocked };
  });
}

export type UnblockResult = { ok: true } | { ok: false; code: "not_found" | "not_blocked" };

/** Removes one block (slot key + block ID, so a stale page never removes a newer block). */
export async function unblockSlot(store: BookingStore, actor: AdminActor, key: string, blockId: string, options: { now?: Date } = {}): Promise<UnblockResult> {
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx: BookingTransaction): Promise<UnblockResult> => {
    const lock = await tx.getLock(key);
    if (!lock) return { ok: false, code: "not_found" };
    if (!isBlockLock(lock.data) || lock.data.bookingId !== blockId) return { ok: false, code: "not_blocked" };
    tx.deleteLock(key, lock.version);
    tx.createAudit({
      ...auditRecord("slot_unblocked", actor, "", now, {
        before: { date: lock.data.date, slotId: lock.data.slotId, kind: lock.data.block!.kind, blockId, reason: lock.data.block!.reason },
        after: null,
      }),
      entityType: "slot",
      entityId: key,
    });
    return { ok: true };
  });
}

/** Blocks among a list of locks, by date then slot (admin views). */
export const blocksOf = (locks: SlotLock[]) => locks.filter(isBlockLock).sort((a, b) => a.date.localeCompare(b.date) || a.slotId.localeCompare(b.slotId));
