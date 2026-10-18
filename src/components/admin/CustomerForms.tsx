"use client";

import { useId, useState } from "react";
import { flashAdminMessage } from "./AdminFlash";
import { NoticeLine, useAdminAction } from "./BookingActions";

// Customer detail (admin improvements, step 6): edit name / phone on the
// profile (never the sign-in email) and internal notes (never shown to the
// customer). Both send the version the admin saw, so a concurrent change is
// refused instead of overwritten.

const inputClass =
  "block h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold-light/40";
const labelClass = "mb-1 block text-[0.8125rem] font-semibold text-ink";

export function CustomerProfileForm({ uid, name, phone, updatedAt }: { uid: string; name: string; phone: string; updatedAt: string | null }) {
  const id = useId();
  const { busy, notice, setNotice, send } = useAdminAction();
  const [f, setF] = useState({ name, phone });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.name.trim() === name && f.phone.trim() === phone) return setNotice({ tone: "info", message: "Nothing to save." });
    const ok = await send(`/api/admin/customers/${encodeURIComponent(uid)}/profile`, { name: f.name, phone: f.phone.trim() || null, expectedUpdatedAt: updatedAt }, "Saved.");
    if (ok) flashAdminMessage("Profile saved. The customer is notified in their account.");
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-3" aria-label="Edit customer profile">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={labelClass}>Name</label>
          <input id={`${id}-name`} value={f.name} maxLength={100} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className={labelClass}>Phone (optional)</label>
          <input id={`${id}-phone`} type="tel" value={f.phone} maxLength={24} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
        </div>
      </div>
      <NoticeLine notice={notice} />
      <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-outline btn-sm">
        {busy ? "Saving…" : "Save profile"}
      </button>
      <p className="text-xs text-ink-muted">The sign-in email can only be changed by the customer. Contact details on existing bookings are edited on each booking.</p>
    </form>
  );
}

export function CustomerNotesForm({ uid, notes, updatedAt }: { uid: string; notes: string; updatedAt: string | null }) {
  const id = useId();
  const { busy, notice, send } = useAdminAction();
  const [text, setText] = useState(notes);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await send(`/api/admin/customers/${encodeURIComponent(uid)}/notes`, { notes: text, expectedUpdatedAt: updatedAt }, "Notes saved.");
  };
  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Internal notes about this customer">
      <label htmlFor={`${id}-notes`} className={labelClass}>Internal notes (only admins see these)</label>
      <textarea id={`${id}-notes`} rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} h-auto py-2`} />
      <NoticeLine notice={notice} />
      <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-outline btn-sm">
        {busy ? "Saving…" : "Save notes"}
      </button>
    </form>
  );
}
