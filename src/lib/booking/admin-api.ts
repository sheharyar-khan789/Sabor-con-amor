// Shared helpers for admin API routes — SERVER ONLY.
import "server-only";
import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/server";
import { securityLog } from "@/lib/security/log";
import type { AdminActor } from "./audit-model";
import { bookingStore, logBookingError, TimeoutError, withTimeout } from "./server";
import type { BookingStore, BookingTransaction } from "./store";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Human-readable messages for admin error codes (shown in the panel). */
export const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  slot_unavailable: "That slot is already taken by another booking. Nothing was changed.",
  invalid_transition: "This status change isn't allowed from the booking's current status.",
  invalid_action: "Unknown action.",
  event_not_over: "An event can only be marked completed on or after its date.",
  stale: "This booking changed since you opened it. Reload the page and review it again.",
  not_found: "Booking or request not found.",
  not_open: "This request has already been decided.",
  not_allowed: "The booking is no longer active, so this request can't be approved.",
  invalid_change: "The requested change is no longer valid (date passed, capacity or menu). Reject it or ask the customer.",
  invalid_decision: "Unknown decision.",
  invalid_notes: "Notes are too long.",
  customer_not_found: "That customer account was not found.",
  // Phase 7 — payments / quotations
  total_below_paid:
    "Refund / financial adjustment required: after this change the price would be lower than the amount already paid. Nothing was changed. Settle the difference with the customer first (refunds are not recorded in the system yet).",
  already_priced: "This booking already has a price. Existing prices are never recalculated.",
  pricing_incomplete: "Some prices this booking needs are not configured yet (see Settings → Pricing).",
  pricing_pending: "This booking has no price yet. Calculate its price first.",
  booking_inactive: "Payments can't be recorded on a cancelled, rejected or expired booking.",
  already_paid: "This booking is already fully paid.",
  overpayment: "The amount is more than the remaining balance. Nothing was recorded.",
  duplicate_request: "This form was already used for a different payment. Reload the page and try again.",
  invalid_payment: "Please correct the payment details.",
  already_voided: "This payment has already been voided.",
  invalid_reason: "Please give a short reason (3–500 characters).",
  not_draft: "Only a draft quotation can be issued or discarded.",
  outdated: "The booking's price changed after this draft was made. Generate a new draft.",
  // Phase 8 — event operations / vendors
  not_operational: "Only confirmed (or completed) events have operations. Nothing was changed.",
  invalid_ops_status: "Unknown operational status.",
  invalid_ops_transition: "Operational status moves one step at a time (forward or back).",
  event_not_started: "“In progress” and “Completed” are only possible from the event date.",
  item_not_found: "That checklist item no longer exists. Reload the page.",
  note_not_found: "That note no longer exists. Reload the page.",
  invalid_checklist_status: "Unknown checklist status.",
  invalid_note: "Enter a note (up to the allowed length).",
  invalid_label: "Enter a checklist item (2–120 characters).",
  too_many_items: "This event already has the maximum number of items.",
  nothing_to_sync: "The checklist already matches the booking.",
  vendor_not_found: "That vendor was not found.",
  vendor_inactive: "That vendor is inactive. Reactivate it first.",
  invalid_category: "Choose a category.",
  already_assigned: "This vendor is already assigned to this event for that category.",
  event_over: "This event is completed; vendors can no longer be assigned.",
  vendor_conflict: "This vendor is already assigned to another event in the same slot. Nothing was changed.",
  invalid_assignment_status: "Unknown assignment status.",
  invalid_vendor: "Please correct the vendor details.",
  no_change: "Nothing was changed.",
  // admin improvements
  not_editable: "Completed, cancelled, rejected and expired bookings are read-only.",
  price_confirmation_required: "The price changes with this edit. Review the new total and confirm it.",
  unexpected_field: "The request contained fields that aren't allowed.",
  reference_mismatch: "The reference you typed doesn't match this booking. Nothing was deleted.",
  not_deletable_status: "Only pending, rejected, expired or cancelled bookings can be deleted. Cancel a confirmed booking first, or archive it.",
  has_payments: "This booking has payment records, so it can't be deleted (financial history is kept). Archive it instead.",
  has_quotations: "This booking has quotations, so it can't be deleted. Archive it instead.",
  has_operations: "This booking has event preparation or vendor records, so it can't be deleted. Archive it instead.",
  not_archivable: "Only completed, cancelled, rejected or expired bookings can be archived. Cancel or decide it first.",
  already_archived: "This booking is already archived.",
  not_archived: "This booking is not archived.",
  past_date: "Past dates can't be blocked.",
  beyond_horizon: "That date is beyond the booking window.",
  invalid_slot: "Choose Day, Night or Both.",
  slot_occupied: "That slot already has an active booking, so it can't be blocked. Nothing was changed.",
  already_blocked: "That slot is already blocked.",
  not_blocked: "That block no longer exists (it was removed or replaced). Reload the page.",
};

/** What a sensitive action needs: a sign-in within the last 15 minutes (session-policy.ts). */
export const REAUTH_MESSAGE = "For your security, confirm your password to continue.";

export function reauthRequired(request: Request, uid: string) {
  securityLog({ event: "reauth_required", route: request.url, status: 401, reason: "reauth_required", uid });
  return json({ error: "reauth_required", message: REAUTH_MESSAGE }, 401);
}

export interface AdminContext {
  admin: AdminActor;
  store: BookingStore;
  body: Record<string, unknown>;
  /** True when the admin signed in within the last 15 minutes. */
  recentSignIn: boolean;
  /** For conditionally sensitive actions: returns the 401 to send when the sign-in isn't recent. */
  requireRecentSignIn: () => Response | null;
}

/**
 * Runs an admin mutation: Super Admin check (server-side), JSON body parse,
 * then the work with a timeout. Database errors are logged (code only) and
 * reported, never swallowed or turned into a success.
 *
 * `sensitive: true` (money, prices / policies, quotations) refuses the action
 * with 401 reauth_required unless the admin signed in within 15 minutes;
 * routes that are sensitive only for some inputs (e.g. cancelling) call
 * ctx.requireRecentSignIn() themselves.
 */
export async function adminMutation(
  request: Request,
  work: (ctx: AdminContext) => Promise<Response>,
  options: { sensitive?: boolean } = {}
): Promise<Response> {
  const auth = await requireSuperAdminApi(request);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  if (options.sensitive && !auth.recentSignIn) return reauthRequired(request, auth.admin.uid);
  const store = bookingStore();
  if (!store) return json({ error: "booking_unavailable" }, 503);
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 32 * 1024) return json({ error: "invalid_request" }, 413);
    const parsed = JSON.parse(text || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const audit = withAuditCapture(store);
  const requireRecentSignIn = () => (auth.recentSignIn ? null : reauthRequired(request, auth.admin.uid));
  try {
    const response = await withTimeout(work({ admin: auth.admin, store: audit.store, body, recentSignIn: auth.recentSignIn, requireRecentSignIn }), 15_000);
    if (response.ok && request.method !== "GET") {
      // The full record (who, what, before/after) is the audit document written in
      // the same transaction; this line only makes admin activity visible to alerting.
      const reason = options.sensitive ? "sensitive" : "ok";
      if (!audit.ids.length) securityLog({ event: "admin_action", route: request.url, status: response.status, reason, uid: auth.admin.uid });
      for (const auditId of audit.ids) securityLog({ event: "admin_action", route: request.url, status: response.status, reason, uid: auth.admin.uid, auditId });
    }
    return response;
  } catch (error) {
    logBookingError("admin action", error);
    securityLog({ event: "server_error", route: request.url, status: 503, reason: error instanceof TimeoutError ? "timeout" : "database_error", uid: auth.admin.uid });
    return json(
      { error: error instanceof TimeoutError ? "timeout" : "database_error", message: "The database didn't respond. Nothing is shown as saved; reload to check." },
      503
    );
  }
}

/**
 * The same store, but remembers the IDs of audit records written by committed
 * transactions, so the security log can point at the full audit record.
 */
function withAuditCapture(store: BookingStore): { store: BookingStore; ids: string[] } {
  const ids: string[] = [];
  const observed: BookingStore = Object.create(store);
  observed.runTransaction = async <T,>(work: (tx: BookingTransaction) => Promise<T>): Promise<T> => {
    let attempt: string[] = [];
    const result = await store.runTransaction((tx) => {
      attempt = [];
      return work({ ...tx, createAudit: (record) => (attempt.push(record.auditId), tx.createAudit(record)) });
    });
    ids.push(...attempt);
    return result;
  };
  return { store: observed, ids };
}

export function failure(code: string, status = 409) {
  return json({ error: code, message: ADMIN_ERROR_MESSAGES[code] ?? "The action could not be completed." }, status);
}

export const optionalString = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Strict bodies (admin improvements): any field outside `allowed` → 400 unexpected_field. */
export function rejectUnknownFields(body: Record<string, unknown>, allowed: readonly string[]): Response | null {
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  return unknown.length ? json({ error: "unexpected_field", message: `Unexpected field(s): ${unknown.join(", ")}.` }, 400) : null;
}
