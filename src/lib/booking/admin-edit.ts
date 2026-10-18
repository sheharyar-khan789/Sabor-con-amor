// Super Admin "Edit booking" (admin improvements, step 2) — SERVER ONLY in use.
//
// Contact on the booking, guests, event type, menu, package, services, customer
// notes, date and slot of a pending / under-review / confirmed booking, in ONE
// transaction with the same slot-lock rules as approving a customer change:
// a new date/slot is claimed and the old one released together; a taken slot
// changes nothing. Price: a priced booking is re-quoted with the one pricing
// engine only when a quote input changes; the admin must confirm the exact new
// total (expectedTotal), a total below the amount already paid is refused, and
// issued quotations / receipts are separate immutable documents (never touched).
// A booking without a price stays without one (use "Calculate price").
import {
  DEFAULT_CONFIG,
  getEventType,
  getMenu,
  getPackage,
  getService,
  getSlot,
  type BusinessConfig,
} from "../config/business-config.ts";
import type { AdminActor } from "./audit-model.ts";
import { businessToday } from "./dates.ts";
import { auditRecord, lockFor } from "./engine.ts";
import { lockIsActive, slotKey, type BookingRecord } from "./model.ts";
import { notifyInTransaction } from "./notifications.ts";
import { quote, type PricingSnapshot } from "./pricing.ts";
import type { BookingStatus } from "./status.ts";
import type { BookingStore, BookingTransaction } from "./store.ts";
import { eventDateError, guestCountError, phoneDigits } from "./validation.ts";

/** Statuses whose details an admin may edit; every other status is read-only. */
export const EDITABLE_STATUSES: readonly BookingStatus[] = ["pending", "under_review", "confirmed"];
export const isEditable = (status: BookingStatus) => EDITABLE_STATUSES.includes(status);

export const EDIT_FIELDS = [
  "contactName",
  "contactPhone",
  "contactEmail",
  "guestCount",
  "eventTypeId",
  "menuPreferenceId",
  "packageId",
  "serviceIds",
  "customerNotes",
  "date",
  "slotId",
] as const;
export type EditField = (typeof EDIT_FIELDS)[number];

export const EDIT_FIELD_LABELS: Readonly<Record<EditField, string>> = {
  contactName: "Contact name",
  contactPhone: "Phone",
  contactEmail: "Email",
  guestCount: "Guests",
  eventTypeId: "Event type",
  menuPreferenceId: "Menu",
  packageId: "Package",
  serviceIds: "Services",
  customerNotes: "Customer notes",
  date: "Date",
  slotId: "Slot",
};

export interface BookingEdit {
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string | null;
  guestCount?: number;
  eventTypeId?: string;
  menuPreferenceId?: string | null;
  packageId?: string | null;
  serviceIds?: string[];
  customerNotes?: string;
  date?: string;
  slotId?: string;
}

export const EDIT_NOTES_MAX = 3000;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export type EditErrors = Partial<Record<EditField | "body", { code: string; message: string }>>;

/** Shape check of the `changes` object (types, lengths, unknown fields). Config checks come later. */
export function validateBookingEdit(raw: unknown): { ok: true; value: BookingEdit } | { ok: false; errors: EditErrors } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: { body: { code: "invalid_body", message: "The changes could not be read." } } };
  }
  const body = raw as Record<string, unknown>;
  const errors: EditErrors = {};
  const fail = (f: EditField | "body", code: string, message: string) => void (errors[f] ??= { code, message });
  const unknown = Object.keys(body).filter((k) => !(EDIT_FIELDS as readonly string[]).includes(k));
  if (unknown.length) fail("body", "unexpected_field", `Unexpected field(s): ${unknown.join(", ")}.`);
  const has = (k: EditField) => Object.prototype.hasOwnProperty.call(body, k);
  const v: BookingEdit = {};

  if (has("contactName")) {
    const s = typeof body.contactName === "string" ? body.contactName.trim() : "";
    if (s.length < 2 || s.length > 100 || CONTROL_CHARS.test(s)) fail("contactName", "invalid_name", "Enter the contact's name (2–100 characters).");
    else v.contactName = s;
  }
  if (has("contactPhone")) {
    const s = typeof body.contactPhone === "string" ? body.contactPhone.trim() : "";
    const d = phoneDigits(s);
    if (!/^\+?[\d\s()-]+$/.test(s) || d.length < 10 || d.length > 15) fail("contactPhone", "invalid_phone", "Enter a valid phone number (at least 10 digits).");
    else v.contactPhone = s;
  }
  if (has("contactEmail")) {
    const e = body.contactEmail;
    if (e === null || e === "") v.contactEmail = null;
    else if (typeof e !== "string" || e.trim().length > 254 || !EMAIL.test(e.trim())) fail("contactEmail", "invalid_email", "Enter a valid email, or leave it empty.");
    else v.contactEmail = e.trim();
  }
  if (has("guestCount")) {
    if (typeof body.guestCount !== "number" || !Number.isInteger(body.guestCount) || body.guestCount < 1) {
      fail("guestCount", "invalid_guest_count", "Enter the number of guests (a whole number, at least 1).");
    } else v.guestCount = body.guestCount;
  }
  for (const k of ["eventTypeId", "slotId"] as const) {
    if (has(k)) {
      if (typeof body[k] !== "string" || !ID.test(body[k] as string)) fail(k, `invalid_${k}`, `Choose a ${EDIT_FIELD_LABELS[k].toLowerCase()}.`);
      else v[k] = body[k] as string;
    }
  }
  for (const k of ["menuPreferenceId", "packageId"] as const) {
    if (has(k)) {
      const x = body[k];
      if (x === null || x === "") v[k] = null;
      else if (typeof x !== "string" || !ID.test(x)) fail(k, `invalid_${k}`, `Choose a ${EDIT_FIELD_LABELS[k].toLowerCase()} from the list.`);
      else v[k] = x;
    }
  }
  if (has("serviceIds")) {
    const s = body.serviceIds;
    if (!Array.isArray(s) || s.length > 30 || !s.every((x) => typeof x === "string" && ID.test(x)) || new Set(s).size !== s.length) {
      fail("serviceIds", "invalid_service", "One of the selected services is not valid.");
    } else v.serviceIds = [...(s as string[])];
  }
  if (has("customerNotes")) {
    const n = body.customerNotes;
    if (typeof n !== "string" || n.length > EDIT_NOTES_MAX || CONTROL_CHARS.test(n)) {
      fail("customerNotes", "invalid_notes", `Notes must be under ${EDIT_NOTES_MAX} characters.`);
    } else v.customerNotes = n.trim();
  }
  if (has("date")) {
    if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) fail("date", "invalid_date", "Choose a valid date.");
    else v.date = body.date;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: v };
}

export type EditCode =
  | "not_found"
  | "stale"
  | "not_editable"
  | "invalid_change"
  | "no_change"
  | "slot_unavailable"
  | "pricing_incomplete"
  | "total_below_paid"
  | "price_confirmation_required";

/** One changed field, as shown to the admin and stored in the audit trail. */
export interface FieldChange {
  field: EditField;
  label: string;
  before: string;
  after: string;
}

export interface EditPlan {
  updated: BookingRecord;
  changes: FieldChange[];
  moving: boolean;
  /** Present when the booking is priced and a quote input changed. */
  price: { before: number; after: number; snapshot: PricingSnapshot } | null;
}

export type PlanResult =
  | { ok: true; plan: EditPlan }
  | { ok: false; code: "not_editable" | "invalid_change" | "no_change" | "pricing_incomplete" | "total_below_paid"; field?: EditField; message?: string; missing?: string[] };

const sameList = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

/**
 * What the edit would do (pure: no reads or writes). Only CHANGED values are
 * checked against the current configuration, so an unchanged menu or service
 * that has since been deactivated stays as it is on the booking.
 */
export function planEdit(b: BookingRecord, edit: BookingEdit, config: BusinessConfig, now: Date): PlanResult {
  if (!isEditable(b.status)) return { ok: false, code: "not_editable" };
  const today = businessToday(now);
  const changes: FieldChange[] = [];
  const bad = (field: EditField, message: string): PlanResult => ({ ok: false, code: "invalid_change", field, message });
  const note = (field: EditField, before: string, after: string) => {
    if (before !== after) changes.push({ field, label: EDIT_FIELD_LABELS[field], before, after });
  };

  const customer = {
    name: edit.contactName ?? b.customer.name,
    phone: edit.contactPhone ?? b.customer.phone,
    email: edit.contactEmail === undefined ? b.customer.email : edit.contactEmail,
  };
  note("contactName", b.customer.name, customer.name);
  note("contactPhone", b.customer.phone, customer.phone);
  note("contactEmail", b.customer.email ?? "", customer.email ?? "");

  let guestCount = b.guestCount;
  if (edit.guestCount !== undefined && edit.guestCount !== b.guestCount) {
    const e = guestCountError(config, b.hallId, edit.guestCount);
    if (e) return bad("guestCount", e.message);
    guestCount = edit.guestCount;
  }
  note("guestCount", String(b.guestCount), String(guestCount));

  let eventType = { id: b.eventTypeId, label: b.eventTypeLabel };
  if (edit.eventTypeId !== undefined && edit.eventTypeId !== b.eventTypeId) {
    const t = getEventType(config, edit.eventTypeId);
    if (!t) return bad("eventTypeId", "This event type is not available.");
    eventType = { id: t.id, label: t.name };
  }
  note("eventTypeId", b.eventTypeLabel, eventType.label);

  // Package (fixes the menu), then menu, then services.
  let pkg = b.package ?? null;
  if (edit.packageId !== undefined && edit.packageId !== (b.package?.id ?? null)) {
    if (edit.packageId === null) pkg = null;
    else {
      const p = getPackage(config, edit.packageId);
      if (!p) return bad("packageId", "This package is not available.");
      pkg = { id: p.id, name: p.name, serviceIds: [...p.serviceIds] };
    }
  }
  note("packageId", b.package?.name ?? "No package", pkg?.name ?? "No package");

  const packageMenu = pkg ? (config.packages.find((x) => x.id === pkg!.id)?.menuId ?? null) : null;
  let menu = b.menuPreference;
  const wantedMenu = packageMenu ?? (edit.menuPreferenceId === undefined ? (b.menuPreference?.id ?? null) : edit.menuPreferenceId);
  if (packageMenu && edit.menuPreferenceId && edit.menuPreferenceId !== packageMenu) return bad("menuPreferenceId", "This package comes with its own menu.");
  if (wantedMenu !== (b.menuPreference?.id ?? null)) {
    if (wantedMenu === null) menu = null;
    else {
      const m = getMenu(config, wantedMenu);
      if (!m) return bad("menuPreferenceId", "This menu is not available.");
      menu = { id: m.id, title: m.name };
    }
  }
  note("menuPreferenceId", b.menuPreference?.title ?? "Not decided", menu?.title ?? "Not decided");

  let services = b.services;
  if (edit.serviceIds !== undefined && !sameList(edit.serviceIds, b.services.map((s) => s.id))) {
    const next: { id: string; label: string }[] = [];
    for (const id of edit.serviceIds) {
      const kept = b.services.find((s) => s.id === id);
      if (kept) next.push(kept);
      else {
        const s = getService(config, id);
        if (!s) return bad("serviceIds", "One of the selected services is not available.");
        next.push({ id: s.id, label: s.name });
      }
    }
    services = next;
  }
  note("serviceIds", b.services.map((s) => s.label).join(", ") || "None", services.map((s) => s.label).join(", ") || "None");

  const customerNotes = edit.customerNotes ?? b.customerNotes;
  if (customerNotes !== b.customerNotes) changes.push({ field: "customerNotes", label: "Customer notes", before: `${b.customerNotes.length} characters`, after: `${customerNotes.length} characters` });

  let eventDate = b.eventDate;
  if (edit.date !== undefined && edit.date !== b.eventDate) {
    const e = eventDateError(config, edit.date, today);
    if (e) return bad("date", e.message);
    eventDate = edit.date;
  }
  note("date", b.eventDate, eventDate);
  let slot = { id: b.slotId, label: b.slotLabel };
  if (edit.slotId !== undefined && edit.slotId !== b.slotId) {
    const s = getSlot(config, edit.slotId);
    if (!s) return bad("slotId", "This slot is not available.");
    slot = { id: s.id, label: s.label };
  }
  note("slotId", b.slotLabel, slot.label);

  if (!changes.length) return { ok: false, code: "no_change" };

  const key = slotKey(eventDate, b.hallId, slot.id);
  const moving = key !== b.slotKey;
  let updated: BookingRecord = {
    ...b,
    customer,
    guestCount,
    eventTypeId: eventType.id,
    eventTypeLabel: eventType.label,
    package: pkg,
    menuPreference: menu,
    services,
    customerNotes,
    eventDate,
    slotId: slot.id as BookingRecord["slotId"],
    slotLabel: slot.label,
    slotKey: key,
    // A pending request moved by staff gets a fresh hold (same rule as approving a change).
    holdExpiresAt: b.status === "pending" && moving ? new Date(now.getTime() + config.rules.pendingHoldHours * 3_600_000) : b.holdExpiresAt,
    updatedAt: now,
  };

  let price: EditPlan["price"] = null;
  const quoteInputChanged = changes.some((c) => c.field === "guestCount" || c.field === "packageId" || c.field === "menuPreferenceId" || c.field === "serviceIds");
  if (b.pricing && quoteInputChanged) {
    const q = quote(
      config,
      { hallId: b.hallId, guestCount, serviceIds: services.map((s) => s.id), menuId: menu?.id ?? null, packageId: pkg?.id ?? null },
      now
    );
    if (q.status !== "priced") return { ok: false, code: "pricing_incomplete", missing: q.missing };
    const received = b.payment?.advanceReceived ?? 0;
    // Refunds are handled outside the system: the new total may not drop below what was paid.
    if (q.snapshot.total < received) return { ok: false, code: "total_below_paid" };
    price = { before: b.pricing.total, after: q.snapshot.total, snapshot: q.snapshot };
    updated = {
      ...updated,
      pricing: q.snapshot,
      payment: { ...b.payment, advanceRequired: q.snapshot.advanceRequired, advanceReceived: received, balanceDue: q.snapshot.total - received },
    };
  }
  return { ok: true, plan: { updated, changes, moving, price } };
}

export type EditResult =
  | { ok: true; booking: BookingRecord; changes: FieldChange[]; price: EditPlan["price"] }
  | { ok: false; code: EditCode; field?: EditField; message?: string; missing?: string[]; price?: { before: number; after: number } };

/**
 * Applies an edit in ONE transaction. `expectedUpdatedAt` (the booking as the
 * admin saw it) is required; `expectedTotal` must equal the re-quoted total
 * whenever the price changes (the admin confirmed exactly that amount).
 */
export async function adminEditBooking(
  store: BookingStore,
  actor: AdminActor,
  bookingId: string,
  edit: BookingEdit,
  options: { expectedUpdatedAt: string; expectedTotal?: number | null; now?: Date; config?: BusinessConfig }
): Promise<EditResult> {
  const now = options.now ?? new Date();
  const config = options.config ?? DEFAULT_CONFIG;
  return store.runTransaction(async (tx: BookingTransaction): Promise<EditResult> => {
    // --- reads ---
    const found = await tx.getBooking(bookingId);
    if (!found) return { ok: false, code: "not_found" };
    const booking = found.data;
    if (new Date(booking.updatedAt).toISOString() !== options.expectedUpdatedAt) return { ok: false, code: "stale" };
    const planned = planEdit(booking, edit, config, now);
    if (!planned.ok) return planned;
    const { updated, changes, moving, price } = planned.plan;
    if (price && price.after !== price.before && options.expectedTotal !== price.after) {
      return { ok: false, code: "price_confirmation_required", price: { before: price.before, after: price.after } };
    }
    const oldLock = moving ? await tx.getLock(booking.slotKey) : null;
    const newLock = moving ? await tx.getLock(updated.slotKey) : null;
    let displaced: Awaited<ReturnType<BookingTransaction["getBooking"]>> = null;
    if (newLock && newLock.data.bookingId !== bookingId) {
      // Active bookings and blocked slots both refuse the move.
      if (lockIsActive(newLock.data, now)) return { ok: false, code: "slot_unavailable" };
      displaced = await tx.getBooking(newLock.data.bookingId);
    }

    // --- writes (all or nothing) ---
    const { bookingId: _id, schemaVersion: _v, createdAt: _c, createdBy: _b, customerId: _u, ...patch } = updated;
    void _id; void _v; void _c; void _b; void _u;
    tx.updateBooking(bookingId, patch, found.version);
    if (moving) {
      if (newLock) tx.replaceLock(lockFor(updated, now), newLock.version);
      else tx.createLock(lockFor(updated, now));
      if (oldLock && oldLock.data.bookingId === bookingId) tx.deleteLock(booking.slotKey, oldLock.version);
      if (displaced && displaced.data.status === "pending") {
        tx.updateBooking(
          displaced.data.bookingId,
          { status: "expired", holdExpiresAt: null, updatedAt: now, timeline: { ...displaced.data.timeline, expiredAt: now } },
          displaced.version
        );
        notifyInTransaction(tx, { type: "BOOKING_EXPIRED" }, displaced.data, now);
      }
    }
    notifyInTransaction(
      tx,
      { type: "BOOKING_UPDATED", editKey: now.getTime().toString(36), changed: changes.map((c) => c.field), previous: { eventDate: booking.eventDate, slotLabel: booking.slotLabel } },
      updated,
      now
    );
    tx.createAudit(
      auditRecord("booking_edited", actor, bookingId, now, {
        before: Object.fromEntries([...changes.map((c) => [c.field, c.before]), ...(price ? [["total", price.before]] : [])]),
        after: Object.fromEntries([...changes.map((c) => [c.field, c.after]), ...(price ? [["total", price.after]] : [])]),
      })
    );
    return { ok: true, booking: updated, changes, price };
  });
}
