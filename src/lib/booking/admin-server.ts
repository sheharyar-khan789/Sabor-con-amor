// Admin panel data loading — SERVER ONLY. The admin layout verifies the Super
// Admin, but Next.js renders layouts and pages concurrently, so every loader
// ALSO verifies it before touching the database (no query runs for anyone else).
import "server-only";
import { notFound } from "next/navigation";
import { getSessionUser, isSuperAdminSession } from "@/lib/auth/server";
import type { CustomerProfile } from "@/lib/account/profile";
import { AUDIT_LABELS, type AuditRecord } from "./audit-model";
import { activeSlots, anyLabel, DEFAULT_HALL_ID, slotLabel, type BusinessConfig } from "./catalog";
import { loadConfigFresh } from "../config/config-server";
import { addDays, businessToday } from "./dates";
import { getAvailability } from "./engine";
import { aggregateCustomers, applyAdminListQuery, REVIEW_STATUSES, toAdminRow, type AdminBookingRow, type AdminListQuery } from "./admin-view";
import type { DayAvailability, SlotState } from "./availability";
import type { BlockKind, BookingRecord, SlotLock } from "./model";
import { blocksOf } from "./admin-blocks";
import { loadAlertSummary } from "./admin-alerts";
import { computeBookingStats, computeOccupancy, type StatsRange } from "./admin-stats";
import { cache } from "react";
import type { BookingStatus } from "./status";
import { toRequestView, type CustomerRequestView } from "./portal";
import type { BookingRequestRecord } from "./request-model";
import { bookingStore, logBookingError, profileStore, withTimeout } from "./server";
import type { BookingStore } from "./store";
import { financialSummary, type FinancialSummary, type PaymentRecord, type QuotationRecord } from "./finance-model";
import { quote } from "./pricing";
import { projectModificationPrice } from "./admin";
import type { OpsStatus } from "./operations-model";

export type AdminResult<T> = { ok: true; data: T } | { ok: false; reason: "unavailable" | "error" };
const TIMEOUT_MS = 10_000;
const ACTIVE = ["pending", "under_review", "confirmed"] as const;

export async function run<T>(context: string, work: (store: BookingStore) => Promise<T>): Promise<AdminResult<T>> {
  const user = await getSessionUser(); // cached per request; verifies signature, expiry, revocation
  if (!user || !isSuperAdminSession(user)) notFound();
  const store = bookingStore();
  if (!store) return { ok: false, reason: "unavailable" };
  try {
    return { ok: true, data: await withTimeout(work(store), TIMEOUT_MS) };
  } catch (error) {
    logBookingError(`admin ${context}`, error);
    return { ok: false, reason: "error" };
  }
}

// ------------------------------------------------------------------ dashboard

export interface DashboardData {
  today: string;
  todayBySlot: { slotId: string; slotLabel: string; bookings: AdminBookingRow[] }[];
  counts: { upcoming: number; pending: number; underReview: number; confirmedUpcoming: number; openRequests: number };
  /** Next 30 days, from the same availability engine as the public page. */
  slots30: { available: number; held: number; booked: number };
  pendingRows: AdminBookingRow[];
  openRequests: { request: CustomerRequestView; booking: AdminBookingRow | null }[];
  /** Real payment/pricing data present on any upcoming booking. */
  pricedBookings: number;
  /** Phase 7: sums over upcoming active PRICED bookings, from stored prices and recorded payments only. */
  finance: { total: number; paid: number; outstanding: number; unpriced: number };
}

/** Labels from the configuration (inactive records included, for older requests). */
export const labelsFor = (config: BusinessConfig) => ({
  slot: (id: string) => slotLabel(config, id),
  menu: (id: string) => anyLabel(config, "menu", id),
  service: (id: string) => anyLabel(config, "service", id),
});

/** Configuration for reading pages; throws (→ error state) if it can't be loaded. */
export async function configOrThrow(): Promise<BusinessConfig> {
  const r = await loadConfigFresh();
  if (!r.ok) throw Object.assign(new Error("config unavailable"), { code: `config_${r.reason}` });
  return r.config;
}

export function loadDashboard(): Promise<AdminResult<DashboardData>> {
  return run("dashboard", async (store) => {
    const now = new Date();
    const today = businessToday(now);
    const config = await configOrThrow();
    const labels = labelsFor(config);
    const [upcoming, waiting, openReqs, availability] = await Promise.all([
      store.listBookingsInRange({ from: today, to: addDays(today, 730), limit: 2000 }),
      store.listBookingsByStatus(["pending", "under_review"], 500),
      store.listOpenRequests(100),
      getAvailability(store, DEFAULT_HALL_ID, today, addDays(today, 29), { now, config }),
    ]);
    const activeUpcoming = upcoming.filter((b) => (ACTIVE as readonly string[]).includes(b.status));
    const todayAll = upcoming.filter((b) => b.eventDate === today && (ACTIVE as readonly string[]).includes(b.status));
    const reqBookings = await store.getBookings(openReqs.map((r) => r.bookingId));
    const byId = new Map(reqBookings.map((b) => [b.bookingId, b]));
    const slots30 = { available: 0, held: 0, booked: 0 };
    if (availability.ok) {
      for (const d of availability.availability.days) {
        for (const s of d.slots) if (s.state !== "closed") slots30[s.state] += 1;
      }
    }
    return {
      today,
      todayBySlot: activeSlots(config).map((s) => ({
        slotId: s.id,
        slotLabel: s.label,
        bookings: todayAll.filter((b) => b.slotId === s.id).map((b) => toAdminRow(b, now)),
      })),
      counts: {
        upcoming: activeUpcoming.length,
        pending: waiting.filter((b) => b.status === "pending").length,
        underReview: waiting.filter((b) => b.status === "under_review").length,
        confirmedUpcoming: activeUpcoming.filter((b) => b.status === "confirmed").length,
        openRequests: openReqs.length,
      },
      slots30,
      pendingRows: waiting
        .map((b) => toAdminRow(b, now))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20),
      openRequests: openReqs.slice(0, 20).map((r) => ({
        request: toRequestView(r, labels),
        booking: byId.has(r.bookingId) ? toAdminRow(byId.get(r.bookingId)!, now) : null,
      })),
      pricedBookings: activeUpcoming.filter((b) => b.pricing !== null).length,
      finance: {
        total: activeUpcoming.reduce((t, b) => t + (b.pricing?.total ?? 0), 0),
        paid: activeUpcoming.reduce((t, b) => t + (b.pricing ? b.payment.advanceReceived : 0), 0),
        outstanding: activeUpcoming.reduce((t, b) => t + (b.pricing ? Math.max(0, b.pricing.total - b.payment.advanceReceived) : 0), 0),
        unpriced: activeUpcoming.filter((b) => b.pricing === null).length,
      },
    };
  });
}

// ------------------------------------------------------------------ bookings

export function loadBookingList(query: AdminListQuery) {
  return run("booking list", async (store) => {
    const now = new Date();
    // Review lists (pending / under review / awaiting) use the same status query as the
    // dashboard, so every request it counts is listed; other lists use one bounded
    // date-range query. Filters/search/sort/pages run on the server either way.
    const review: BookingStatus[] | null =
      query.status === "awaiting" ? [...REVIEW_STATUSES] : (REVIEW_STATUSES as readonly string[]).includes(query.status) ? [query.status as BookingStatus] : null;
    const records = review
      ? await store.listBookingsByStatus(review, 500)
      : await store.listBookingsInRange({ from: query.from, to: query.to, limit: 3000 });
    return applyAdminListQuery(records.map((b) => toAdminRow(b, now)), query);
  });
}

export interface AdminBookingDetail {
  today: string;
  booking: BookingRecord;
  row: AdminBookingRow;
  /** Current state of the booking's own slot (from the availability engine). */
  slotState: SlotState | null;
  requests: {
    record: BookingRequestRecord;
    view: CustomerRequestView;
    /** For date/slot changes: the requested slot's CURRENT state (not the one at request time). */
    requestedSlotNow: SlotState | null;
    /** Phase 8: approving would price the booking BELOW what was already paid (refund / adjustment needed). */
    financialAdjustment: { newTotal: number; paid: number } | null;
  }[];
  audit: (AuditRecord & { label: string })[];
  /** Configured pending-hold length (for the "hold lapsed" note). */
  holdHours: number;
  /** Phase 7: every payment (recorded and voided) and quotation of this booking, oldest first. */
  payments: PaymentRecord[];
  quotations: QuotationRecord[];
  /** Only for a booking without a price: whether the current configuration can price it. */
  priceCheck: { status: "priced"; total: number } | { status: "unpriced"; missing: string[] } | null;
  /** Admin improvements: an event-operations record or vendor assignment exists (blocks delete). */
  hasEventRecords: boolean;
}

function adjustmentFor(b: BookingRecord, r: BookingRequestRecord, config: BusinessConfig, now: Date) {
  if (r.status !== "open" || r.type !== "modification" || !r.changes) return null;
  const p = projectModificationPrice(b, r.changes, config, now);
  const paid = b.payment?.advanceReceived ?? 0;
  return p.repriced && p.total !== null && p.total < paid ? { newTotal: p.total, paid } : null;
}

async function slotStateNow(store: BookingStore, key: string, now: Date, config: BusinessConfig): Promise<SlotState | null> {
  const [date, , slotId] = key.split("__");
  const a = await getAvailability(store, DEFAULT_HALL_ID, date, date, { now, config });
  if (!a.ok) return null;
  return a.availability.days[0]?.slots.find((s) => s.slotId === slotId)?.state ?? null;
}

export function loadBookingDetail(bookingId: string) {
  return run("booking detail", async (store): Promise<AdminBookingDetail | null> => {
    if (!/^bk_[0-9a-f]{24}$/.test(bookingId)) return null;
    const now = new Date();
    const config = await configOrThrow();
    const labels = labelsFor(config);
    const booking = await store.getBooking(bookingId);
    if (!booking) return null;
    const [requests, audit, slotState, payments, quotations, operations, assignments] = await Promise.all([
      store.listRequestsForBooking(bookingId),
      store.listAuditForBooking(bookingId, 50),
      slotStateNow(store, booking.slotKey, now, config),
      store.listPaymentsForBooking(bookingId),
      store.listQuotationsForBooking(bookingId),
      store.getOperations(bookingId),
      store.listAssignmentsForBooking(bookingId),
    ]);
    let priceCheck: AdminBookingDetail["priceCheck"] = null;
    if (!booking.pricing) {
      // A preview only (nothing is saved); "Calculate price" re-runs it in a transaction.
      const q = quote(
        config,
        {
          hallId: booking.hallId,
          guestCount: booking.guestCount,
          serviceIds: booking.services.map((s) => s.id),
          menuId: booking.menuPreference?.id ?? null,
          packageId: booking.package?.id ?? null,
        },
        now
      );
      priceCheck = q.status === "priced" ? { status: "priced", total: q.snapshot.total } : { status: "unpriced", missing: q.missing };
    }
    return {
      today: businessToday(now),
      booking,
      row: toAdminRow(booking, now),
      slotState,
      requests: await Promise.all(
        requests.map(async (r) => ({
          record: r,
          view: toRequestView(r, labels),
          requestedSlotNow: r.status === "open" && r.requestedSlot ? await slotStateNow(store, r.requestedSlot.slotKey, now, config) : null,
          financialAdjustment: adjustmentFor(booking, r, config, now),
        }))
      ),
      audit: audit.map((a) => ({ ...a, label: AUDIT_LABELS[a.action] ?? a.action })),
      holdHours: config.rules.pendingHoldHours,
      payments,
      quotations,
      priceCheck,
      hasEventRecords: !!operations || assignments.length > 0,
    };
  });
}

// ------------------------------------------------------------------ stats

/** Booking statistics (counts only, no money) for a date range + occupancy for the next 30/60/90 days. */
export function loadStats(range: StatsRange) {
  return run("stats", async (store) => {
    const now = new Date();
    const today = businessToday(now);
    const config = await configOrThrow();
    const slots = activeSlots(config).map((s) => ({ id: s.id, label: s.label }));
    const [bookings, locks] = await Promise.all([
      store.listBookingsInRange({ from: range.from, to: range.to, limit: 5000 }),
      store.listLocks(DEFAULT_HALL_ID, today, addDays(today, 89)),
    ]);
    return {
      today,
      stats: computeBookingStats(bookings, range, slots),
      occupancy: computeOccupancy(locks, today, slots.map((s) => s.id), now),
      truncated: bookings.length >= 5000,
    };
  });
}

// ------------------------------------------------------------------ alerts

/** New-request alerts for the signed-in Super Admin (nav badge + dashboard). Deduplicated per request. */
export const loadAlerts = cache((adminUid: string) => run("alerts", (store) => loadAlertSummary(store, adminUid)));

// ------------------------------------------------------------------ calendar

export interface CalendarData {
  today: string;
  month: string;
  days: DayAvailability[];
  /** Bookings holding a slot in this month, keyed "date|slotId" (for the date detail). */
  bookings: Record<string, AdminBookingRow>;
  /** Active slots (id + label) from the configuration. */
  slots: { id: string; label: string }[];
  /** Phase 8: operational status of each confirmed / completed booking shown (bookingId -> status). */
  ops: Record<string, OpsStatus>;
  /** Admin improvements: blocked slots in this month, keyed "date|slotId". */
  blocks: Record<string, CalendarBlock>;
  /** Every block from today to the end of the booking window (the "Blocked slots" list). */
  upcomingBlocks: CalendarBlock[];
  horizonDays: number;
}

export interface CalendarBlock {
  slotKey: string;
  blockId: string;
  date: string;
  slotId: string;
  kind: BlockKind;
  reason: string;
  blockedAt: string;
}

const toCalendarBlock = (l: SlotLock): CalendarBlock => ({
  slotKey: l.slotKey,
  blockId: l.bookingId,
  date: l.date,
  slotId: l.slotId,
  kind: l.block!.kind,
  reason: l.block!.reason,
  blockedAt: new Date(l.block!.blockedAt).toISOString(),
});

export function loadCalendar(month: string) {
  return run("calendar", async (store): Promise<CalendarData> => {
    const now = new Date();
    const from = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const config = await configOrThrow();
    // Availability comes from the SAME engine as the public booking page.
    const [availability, records] = await Promise.all([
      getAvailability(store, DEFAULT_HALL_ID, from, to, { now, config }),
      store.listBookingsInRange({ from, to, limit: 500 }),
    ]);
    if (!availability.ok) throw new Error(availability.code);
    const today = businessToday(now);
    const [locks, ahead] = await Promise.all([
      store.listLocks(DEFAULT_HALL_ID, from, to),
      store.listLocks(DEFAULT_HALL_ID, today, addDays(today, config.rules.bookingHorizonDays)),
    ]);
    const byId = new Map(records.map((b) => [b.bookingId, b]));
    const bookings: Record<string, AdminBookingRow> = {};
    for (const l of locks) {
      const b = byId.get(l.bookingId);
      if (b) bookings[`${l.date}|${l.slotId}`] = toAdminRow(b, now);
    }
    const operationalIds = Object.values(bookings).filter((b) => b.status === "confirmed" || b.status === "completed").map((b) => b.bookingId);
    const ops = Object.fromEntries((await store.getOperationsMany(operationalIds)).map((o) => [o.bookingId, o.status]));
    return {
      today: businessToday(now),
      month,
      days: availability.availability.days,
      bookings,
      slots: activeSlots(config).map((s) => ({ id: s.id, label: s.label })),
      ops,
      blocks: Object.fromEntries(blocksOf(locks).map((l) => [`${l.date}|${l.slotId}`, toCalendarBlock(l)])),
      upcomingBlocks: blocksOf(ahead).map(toCalendarBlock),
      horizonDays: config.rules.bookingHorizonDays,
    };
  });
}

// ------------------------------------------------------------------ customers

export function loadCustomers() {
  return run("customers", async (store) => {
    const profiles = profileStore();
    const today = businessToday(new Date());
    const [list, bookings] = await Promise.all([
      profiles ? profiles.list(1000) : Promise.resolve([] as CustomerProfile[]),
      store.listBookingsInRange({ from: addDays(today, -730), to: addDays(today, 730), limit: 5000 }),
    ]);
    return aggregateCustomers(list, bookings);
  });
}

export function loadCustomer(uid: string) {
  return run("customer", async (store) => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
    const now = new Date();
    const profiles = profileStore();
    const [profile, bookings, notes] = await Promise.all([
      profiles ? profiles.get(uid) : Promise.resolve(null),
      store.listBookingsForCustomer(uid, 500),
      store.getCustomerNotes(uid),
    ]);
    if (!profile && bookings.length === 0) return null;
    return {
      today: businessToday(now),
      profile,
      bookings: bookings.map((b) => toAdminRow(b, now)),
      // Internal; rendered only on this admin page.
      notes: notes ? { text: notes.notes, updatedAt: new Date(notes.updatedAt).toISOString() } : null,
    };
  });
}

// ------------------------------------------------------------------ settings

export interface SettingsData {
  config: BusinessConfig;
  /** True once an admin has saved; false = the built-in defaults are in effect. */
  stored: boolean;
  audit: (AuditRecord & { label: string })[];
}

/** Business configuration + recent configuration changes (Super Admin only). */
export function loadSettings() {
  return run("settings", async (store): Promise<SettingsData> => {
    const [cfg, audit] = await Promise.all([loadConfigFresh(), store.listConfigAudit(30)]);
    if (!cfg.ok) throw Object.assign(new Error("config unavailable"), { code: `config_${cfg.reason}` });
    return { config: cfg.config, stored: cfg.stored, audit: audit.map((a) => ({ ...a, label: AUDIT_LABELS[a.action] ?? a.action })) };
  });
}

// ------------------------------------------------------------------ finance (Phase 4)

export const FINANCE_FILTERS = ["outstanding", "pricing_pending", "paid", "all"] as const;
export type FinanceFilter = (typeof FINANCE_FILTERS)[number];

export interface FinanceRow {
  row: AdminBookingRow;
  summary: FinancialSummary;
}

export interface FinanceOverview {
  today: string;
  rows: FinanceRow[];
  /** Sums over the listed PRICED bookings only, from stored prices and recorded (non-voided) payments. */
  totals: { total: number; paid: number; remaining: number; unpriced: number };
}

/**
 * Bookings with their money position, read-only. Amounts come only from each
 * booking's stored price and its recorded payments (`payment.advanceReceived`,
 * kept in step with the payments ledger); quotations and payments are issued,
 * recorded and voided on the booking's own page, through the audited actions.
 */
export function loadFinanceOverview(filter: FinanceFilter) {
  return run("finance overview", async (store) => {
    const now = new Date();
    const today = businessToday(now);
    const records = await store.listBookingsInRange({ from: addDays(today, -365), to: addDays(today, 730), limit: 3000 });
    const rows = records
      .filter((b) => !b.archivedAt)
      .map((b) => ({ row: toAdminRow(b, now), summary: financialSummary(b) }))
      // Inactive bookings appear only when money was recorded against them.
      .filter(({ row, summary }) => (ACTIVE as readonly string[]).includes(row.status) || row.status === "completed" || summary.paid > 0)
      .filter(({ summary }) =>
        filter === "all" ? true
        : filter === "outstanding" ? summary.status === "unpaid" || summary.status === "partially_paid"
        : filter === "paid" ? summary.status === "paid"
        : summary.status === "pricing_pending"
      )
      .sort((a, b) => a.row.eventDate.localeCompare(b.row.eventDate));
    const priced = rows.filter((r) => r.summary.total !== null);
    return {
      today,
      rows,
      totals: {
        total: priced.reduce((n, r) => n + (r.summary.total ?? 0), 0),
        paid: priced.reduce((n, r) => n + r.summary.paid, 0),
        remaining: priced.reduce((n, r) => n + (r.summary.remaining ?? 0), 0),
        unpriced: rows.length - priced.length,
      },
    } satisfies FinanceOverview;
  });
}
