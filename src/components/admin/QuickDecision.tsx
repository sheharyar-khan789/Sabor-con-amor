"use client";

import { useState } from "react";
import { REVIEW_STATUSES } from "@/lib/booking/admin-view";
import type { BookingStatus } from "@/lib/booking/status";
import { flashAdminMessage } from "./AdminFlash";
import ConfirmDialog from "./ConfirmDialog";
import { NoticeLine, useAdminAction } from "./BookingActions";

// Accept / Reject straight from a list row (dashboard "Booking requests waiting",
// Bookings list). Same API, transition rules, slot re-check, audit and customer
// notification as the booking page (POST /api/admin/bookings/{id}/status); the
// row's updatedAt is sent so a booking changed meanwhile is refused as stale.
// (Only components are exported: this is a client module.)

const REASON_MIN = 3;

type Choice = "confirmed" | "rejected";

export default function QuickDecision({
  bookingId,
  reference,
  customerName,
  when,
  status,
  updatedAt,
}: {
  bookingId: string;
  reference: string;
  customerName: string;
  /** e.g. "Sat 12 Dec 2026 · Night" */
  when: string;
  status: BookingStatus;
  updatedAt: string;
}) {
  const { busy, notice, send } = useAdminAction();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [reason, setReason] = useState("");
  if (!(REVIEW_STATUSES as readonly BookingStatus[]).includes(status)) return null;

  const who = customerName || "no name";
  const reasonOk = reason.trim().length >= REASON_MIN;
  const close = () => {
    setChoice(null);
    setReason("");
  };
  const confirm = async () => {
    if (!choice || (choice === "rejected" && !reasonOk)) return;
    const success =
      choice === "confirmed" ? `Accepted: ${reference} (${who}) is confirmed.` : `Rejected: ${reference} (${who}). The slot is released.`;
    const ok = await send(`/api/admin/bookings/${bookingId}/status`, { to: choice, reason: reason.trim(), expectedUpdatedAt: updatedAt }, success);
    if (ok) {
      // The row may leave the list after the refresh; the page keeps the confirmation.
      flashAdminMessage(success);
      close();
    } else setChoice(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChoice("confirmed")}
          disabled={busy}
          aria-label={`Accept booking ${reference} · ${who}`}
          className="btn btn-primary btn-sm"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => setChoice("rejected")}
          disabled={busy}
          aria-label={`Reject booking ${reference} · ${who}`}
          className="btn btn-sm border border-red-300 text-red-800 hover:bg-red-50"
        >
          Reject
        </button>
      </div>
      <NoticeLine notice={notice} />
      <ConfirmDialog
        open={choice !== null}
        title={choice === "confirmed" ? `Accept ${reference}?` : `Reject ${reference}?`}
        confirmLabel={choice === "confirmed" ? "Accept booking" : "Reject request"}
        danger={choice === "rejected"}
        busy={busy}
        confirmDisabled={choice === "rejected" && !reasonOk}
        onConfirm={confirm}
        onClose={close}
        reason={
          choice === "rejected"
            ? { value: reason, onChange: setReason, label: `Reason (required, at least ${REASON_MIN} characters — internal, kept in the audit trail)` }
            : undefined
        }
      >
        <p>
          <strong className="font-semibold text-ink">{who}</strong> · {when}
        </p>
        <p>
          {choice === "confirmed"
            ? "The server re-checks the slot now. If another booking has it, nothing changes. The customer is notified in their account."
            : "The request is kept for the record and the slot is released. The customer is notified in their account."}
        </p>
      </ConfirmDialog>
    </div>
  );
}
