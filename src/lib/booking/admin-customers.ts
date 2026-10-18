// Super Admin customer tools (admin improvements, step 6) — SERVER ONLY in use.
//  - Edit the name / phone on a customer's profile (users/{uid}); the sign-in
//    email is never changed here (Firebase Authentication owns it). Committed
//    with its audit record and the customer's in-app notification.
//  - Internal admin notes about a customer (customerNotes/{uid}): never shown
//    to the customer; audited without their content.
import { randomUUID } from "node:crypto";
import { validateProfileUpdate, type CustomerProfile, type ProfileStore } from "../account/profile.ts";
import type { AdminActor, AuditRecord } from "./audit-model.ts";
import { CUSTOMER_NOTES_MAX } from "./customer-notes-model.ts";
import { buildProfileNotification } from "./notifications.ts";
import type { BookingStore, BookingTransaction } from "./store.ts";

export const CUSTOMER_UID = /^[A-Za-z0-9_-]{1,128}$/;

export type ProfileEditResult =
  | { ok: true; profile: CustomerProfile; changed: ("name" | "phone")[] }
  | { ok: false; code: "not_found" | "stale" | "no_change" | "invalid_request"; fields?: Record<string, { code: string; message: string }> };

export async function adminUpdateCustomerProfile(
  profiles: ProfileStore,
  actor: AdminActor,
  uid: string,
  raw: { name: unknown; phone: unknown },
  options: { expectedUpdatedAt: string | null; now?: Date }
): Promise<ProfileEditResult> {
  const now = options.now ?? new Date();
  if (!CUSTOMER_UID.test(uid)) return { ok: false, code: "not_found" };
  const v = validateProfileUpdate({ name: raw.name, phone: raw.phone });
  if (!v.ok) return { ok: false, code: "invalid_request", fields: v.errors };
  const current = await profiles.get(uid);
  if (!current) return { ok: false, code: "not_found" };
  if ((current.updatedAt ?? null) !== options.expectedUpdatedAt) return { ok: false, code: "stale" };
  const changed: ("name" | "phone")[] = [];
  if ((current.name ?? "") !== v.value.name) changed.push("name");
  if ((current.phone ?? null) !== v.value.phone) changed.push("phone");
  if (!changed.length) return { ok: false, code: "no_change" };

  const audit: AuditRecord = {
    auditId: `aud_${randomUUID().replace(/-/g, "")}`,
    action: "customer_profile_updated",
    actor: { uid: actor.uid, email: actor.email ?? null },
    bookingId: "",
    requestId: null,
    entityType: "customer",
    entityId: uid,
    before: Object.fromEntries(changed.map((f) => [f, current[f] ?? null])),
    after: Object.fromEntries(changed.map((f) => [f, v.value[f]])),
    reason: "",
    at: now,
  };
  const notification = buildProfileNotification(uid, changed, now.getTime().toString(36), now);
  // The store re-checks expectedUpdatedAt inside its transaction (a concurrent edit is refused).
  const saved = await profiles.adminUpdate(uid, v.value, { expectedUpdatedAt: options.expectedUpdatedAt, audit, notification });
  if (!saved.ok) return saved;
  return { ok: true, profile: saved.profile, changed };
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export type CustomerNotesResult = { ok: true; updatedAt: string } | { ok: false; code: "invalid_notes" | "stale" | "not_found" };

/** Saves the internal notes about a customer. `expectedUpdatedAt` = the notes' updatedAt the admin saw, or null for none yet. */
export async function adminSaveCustomerNotes(
  store: BookingStore,
  actor: AdminActor,
  uid: string,
  notes: unknown,
  options: { expectedUpdatedAt: string | null; now?: Date }
): Promise<CustomerNotesResult> {
  const now = options.now ?? new Date();
  if (!CUSTOMER_UID.test(uid)) return { ok: false, code: "not_found" };
  if (typeof notes !== "string" || notes.length > CUSTOMER_NOTES_MAX || CONTROL_CHARS.test(notes)) return { ok: false, code: "invalid_notes" };
  const text = notes.trim();
  return store.runTransaction(async (tx: BookingTransaction): Promise<CustomerNotesResult> => {
    const current = await tx.getCustomerNotes(uid);
    const seen = current ? new Date(current.data.updatedAt).toISOString() : null;
    if (seen !== options.expectedUpdatedAt) return { ok: false, code: "stale" };
    tx.putCustomerNotes({ uid, notes: text, updatedAt: now, updatedBy: { uid: actor.uid } }, current ? current.version : null);
    tx.createAudit({
      auditId: `aud_${randomUUID().replace(/-/g, "")}`,
      action: "customer_notes_updated",
      actor: { uid: actor.uid, email: actor.email ?? null },
      bookingId: "",
      requestId: null,
      entityType: "customer",
      entityId: uid,
      // Lengths only: the note text itself stays in customerNotes/{uid}.
      before: { notesLength: current?.data.notes.length ?? 0 },
      after: { notesLength: text.length },
      reason: "",
      at: now,
    });
    return { ok: true, updatedAt: now.toISOString() };
  });
}
