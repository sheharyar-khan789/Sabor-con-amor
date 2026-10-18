// Booking statistics for the Super Admin (admin improvements, step 7).
// Counts only — NO revenue, payment or price figures. Pure functions over the
// existing records (bookings by event date, slot locks), so the maths is
// testable on a known in-memory data set.
import { isBlockLock, lockIsActive, type BookingRecord, type SlotLock } from "./model.ts";
import { addDays, dateRange, daysBetween, isIsoDate } from "./dates.ts";
import type { BookingStatus } from "./status.ts";

export const STATS_MAX_RANGE_DAYS = 731;
export const OCCUPANCY_WINDOWS = [30, 60, 90] as const;

export interface StatsRange {
  from: string;
  to: string;
}

/** Date-range filter: defaults to the last 6 months and the next 12; bounded to two years. */
export function parseStatsRange(params: Record<string, unknown>, today: string): StatsRange {
  const pick = (v: unknown) => (typeof v === "string" ? v : "");
  let from = isIsoDate(pick(params.from)) ? pick(params.from) : addDays(today, -183);
  let to = isIsoDate(pick(params.to)) ? pick(params.to) : addDays(today, 365);
  if (to < from) [from, to] = [to, from];
  if (daysBetween(from, to) > STATS_MAX_RANGE_DAYS) to = addDays(from, STATS_MAX_RANGE_DAYS);
  return { from, to };
}

export interface MonthRow {
  month: string; // YYYY-MM
  total: number;
  /** Confirmed + completed. */
  booked: number;
}

export interface BookingStats {
  range: StatsRange;
  total: number;
  byStatus: Record<BookingStatus, number>;
  /** Confirmed + completed (events that happen / happened). */
  confirmed: number;
  cancelled: number;
  /** Share of decided bookings that were cancelled (cancelled / (confirmed + cancelled)), or null. */
  cancellationRate: number | null;
  perMonth: MonthRow[];
  /** Confirmed + completed bookings per slot (Day vs Night usage). */
  slotUsage: { slotId: string; label: string; count: number }[];
  /** All bookings in range by event type, most first; `booked` = confirmed + completed. */
  byEventType: { id: string; label: string; total: number; booked: number }[];
}

const BOOKED: readonly BookingStatus[] = ["confirmed", "completed"];

/** Months from `from` to `to` inclusive (empty months included, so gaps are visible). */
function months(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) [y, m] = [y + 1, 1];
  }
  return out;
}

export function computeBookingStats(bookings: BookingRecord[], range: StatsRange, slots: { id: string; label: string }[]): BookingStats {
  const inRange = bookings.filter((b) => b.eventDate >= range.from && b.eventDate <= range.to);
  const byStatus = { pending: 0, under_review: 0, confirmed: 0, completed: 0, cancelled: 0, rejected: 0, expired: 0 } as Record<BookingStatus, number>;
  for (const b of inRange) byStatus[b.status]++;
  const confirmed = byStatus.confirmed + byStatus.completed;
  const cancelled = byStatus.cancelled;

  const perMonth = new Map(months(range.from, range.to).map((m) => [m, { month: m, total: 0, booked: 0 }]));
  for (const b of inRange) {
    const row = perMonth.get(b.eventDate.slice(0, 7));
    if (!row) continue;
    row.total++;
    if (BOOKED.includes(b.status)) row.booked++;
  }

  const booked = inRange.filter((b) => BOOKED.includes(b.status));
  const slotIds = [...new Set([...slots.map((s) => s.id), ...booked.map((b) => b.slotId)])];
  const slotUsage = slotIds.map((id) => ({
    slotId: id,
    label: slots.find((s) => s.id === id)?.label ?? booked.find((b) => b.slotId === id)?.slotLabel ?? id,
    count: booked.filter((b) => b.slotId === id).length,
  }));

  const types = new Map<string, { id: string; label: string; total: number; booked: number }>();
  for (const b of inRange) {
    const t = types.get(b.eventTypeId) ?? { id: b.eventTypeId, label: b.eventTypeLabel, total: 0, booked: 0 };
    t.total++;
    if (BOOKED.includes(b.status)) t.booked++;
    types.set(b.eventTypeId, t);
  }

  return {
    range,
    total: inRange.length,
    byStatus,
    confirmed,
    cancelled,
    cancellationRate: confirmed + cancelled > 0 ? cancelled / (confirmed + cancelled) : null,
    perMonth: [...perMonth.values()],
    slotUsage,
    byEventType: [...types.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
  };
}

export interface OccupancyRow {
  days: number;
  /** Day/Night slots in the window (days × active slots). */
  slots: number;
  /** Held by a confirmed / completed booking. */
  booked: number;
  /** Held by an active pending / under-review request. */
  held: number;
  /** Closed by an admin block. */
  blocked: number;
  free: number;
  /** booked / slots (0–1). */
  occupancy: number;
}

/**
 * Occupancy for the next 30 / 60 / 90 days starting today, from the slot locks
 * (the same records the availability engine reads). Blocks are counted apart
 * from bookings and are not "occupancy".
 */
export function computeOccupancy(locks: SlotLock[], today: string, slotIds: string[], now: Date, windows: readonly number[] = OCCUPANCY_WINDOWS): OccupancyRow[] {
  const active = new Map<string, SlotLock>();
  for (const l of locks) if (slotIds.includes(l.slotId) && lockIsActive(l, now)) active.set(`${l.date}|${l.slotId}`, l);
  return windows.map((days) => {
    const dates = dateRange(today, addDays(today, days - 1));
    let booked = 0;
    let held = 0;
    let blocked = 0;
    for (const d of dates) {
      for (const s of slotIds) {
        const l = active.get(`${d}|${s}`);
        if (!l) continue;
        if (isBlockLock(l)) blocked++;
        else if (l.status === "pending" || l.status === "under_review") held++;
        else booked++;
      }
    }
    const slots = dates.length * slotIds.length;
    return { days, slots, booked, held, blocked, free: slots - booked - held - blocked, occupancy: slots ? booked / slots : 0 };
  });
}
