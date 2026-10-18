"use client";

import { useId, useState } from "react";
import { BLOCK_KIND_LABELS, BLOCK_KINDS } from "@/lib/booking/model";
import { addDays } from "@/lib/booking/dates";
import ConfirmDialog from "./ConfirmDialog";
import { flashAdminMessage } from "./AdminFlash";
import { NoticeLine, useAdminAction } from "./BookingActions";

// Block a date's Day / Night / Both slot (holiday, maintenance, private event)
// and remove blocks. The server refuses past dates and slots with an active
// booking; the public calendar then shows the slot unavailable.

const inputClass =
  "block h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold-light/40";
const labelClass = "mb-1 block text-[0.8125rem] font-semibold text-ink";

export function BlockSlotForm({ today, horizonDays, initialDate = "" }: { today: string; horizonDays: number; initialDate?: string }) {
  const uid = useId();
  const { busy, notice, setNotice, send } = useAdminAction();
  const [f, setF] = useState({ date: initialDate, slot: "both", kind: "holiday", reason: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.date) return setNotice({ tone: "error", message: "Choose a date." });
    if (f.reason.trim().length < 3) return setNotice({ tone: "error", message: "Give a short reason (3–200 characters)." });
    const slotText = f.slot === "both" ? "Day and Night" : f.slot === "day" ? "Day" : "Night";
    const ok = await send("/api/admin/slots/block", { date: f.date, slot: f.slot, kind: f.kind, reason: f.reason.trim() }, `Blocked: ${f.date} · ${slotText}.`);
    if (ok) {
      flashAdminMessage(`Blocked: ${f.date} · ${slotText} (${BLOCK_KIND_LABELS[f.kind as keyof typeof BLOCK_KIND_LABELS]}). The public calendar shows it unavailable.`);
      setF((p) => ({ ...p, reason: "" }));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3" aria-label="Block a slot">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={`${uid}-date`} className={labelClass}>Date</label>
          <input id={`${uid}-date`} type="date" min={today} max={addDays(today, horizonDays)} value={f.date} onChange={set("date")} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-slot`} className={labelClass}>Slot</label>
          <select id={`${uid}-slot`} value={f.slot} onChange={set("slot")} className={inputClass}>
            <option value="both">Both (Day and Night)</option>
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-kind`} className={labelClass}>Why</label>
          <select id={`${uid}-kind`} value={f.kind} onChange={set("kind")} className={inputClass}>
            {BLOCK_KINDS.map((k) => (
              <option key={k} value={k}>{BLOCK_KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-reason`} className={labelClass}>Reason (internal)</label>
          <input id={`${uid}-reason`} value={f.reason} onChange={set("reason")} maxLength={200} placeholder="e.g. Eid holiday" className={inputClass} />
        </div>
      </div>
      <NoticeLine notice={notice} />
      <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-primary btn-sm">
        {busy ? "Blocking…" : "Block slot"}
      </button>
    </form>
  );
}

export function UnblockButton({ slotKey, blockId, label }: { slotKey: string; blockId: string; label: string }) {
  const { busy, notice, send } = useAdminAction();
  const [open, setOpen] = useState(false);
  const confirm = async () => {
    const ok = await send("/api/admin/slots/unblock", { slotKey, blockId }, `Unblocked: ${label}.`);
    if (ok) flashAdminMessage(`Unblocked: ${label}. The slot can be booked again.`);
    setOpen(false);
  };
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={() => setOpen(true)} disabled={busy} aria-label={`Unblock ${label}`} className="btn btn-outline btn-sm">
        Unblock
      </button>
      <NoticeLine notice={notice} />
      <ConfirmDialog open={open} title={`Unblock ${label}?`} confirmLabel="Unblock" busy={busy} onConfirm={confirm} onClose={() => setOpen(false)}>
        <p>The slot becomes available again on the public calendar and can be requested.</p>
      </ConfirmDialog>
    </span>
  );
}
