"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { flashAdminMessage } from "./AdminFlash";
import { NoticeLine, useAdminAction } from "./BookingActions";
import { adminFetch } from "./adminFetch";

// Delete (test / spam bookings only) and Archive / Restore on the booking page.
// Delete needs a reason, the typed booking reference and a recent sign-in
// ("Confirm it's you"); the server re-checks every condition in its transaction.

export default function BookingRecordActions({
  bookingId,
  reference,
  updatedAt,
  archived,
  canArchive,
  archiveHint,
  deleteBlocked,
}: {
  bookingId: string;
  reference: string;
  updatedAt: string;
  archived: boolean;
  canArchive: boolean;
  /** Why archive isn't offered (shown when !canArchive and not archived). */
  archiveHint: string;
  /** Why delete isn't possible (null = it is). */
  deleteBlocked: string | null;
}) {
  const uid = useId();
  const router = useRouter();
  const { busy, notice, setNotice, send } = useAdminAction();
  const [open, setOpen] = useState<"archive" | "restore" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const close = () => {
    setOpen(null);
    setReason("");
    setTyped("");
  };

  const archive = async (to: boolean) => {
    const ok = await send(
      `/api/admin/bookings/${bookingId}/archive`,
      { archive: to, expectedUpdatedAt: updatedAt, reason: reason.trim() },
      to ? `Archived: ${reference} is hidden from the default lists.` : `Restored: ${reference} is back in the lists.`
    );
    if (ok) flashAdminMessage(to ? `Archived: ${reference}. Use “Show archived” in Bookings to find it.` : `Restored: ${reference}.`);
    close();
  };

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setNotice(null);
    try {
      const res = await adminFetch(`/api/admin/bookings/${bookingId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ expectedUpdatedAt: updatedAt, confirmReference: typed.trim(), reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        router.push(`/admin/bookings?deleted=${encodeURIComponent(reference)}`);
        return;
      }
      setNotice({
        tone: "error",
        message:
          data.error === "reauth_required"
            ? "Not deleted: please confirm your password to continue."
            : res.status === 401
              ? "Your session has expired. Sign in again."
              : res.status === 403
                ? "You are not authorised to do this."
                : data.message ?? "The booking could not be deleted.",
      });
      if (data.error === "stale") router.refresh();
      close();
    } catch {
      setNotice({ tone: "error", message: "Network error — nothing was deleted." });
    } finally {
      setDeleting(false);
    }
  };

  const reasonOk = reason.trim().length >= 3;
  const typedOk = typed.trim().toUpperCase() === reference;

  return (
    <div className="space-y-3">
      <NoticeLine notice={notice} />
      <div className="flex flex-wrap gap-2">
        {archived ? (
          <button type="button" onClick={() => setOpen("restore")} disabled={busy} className="btn btn-outline btn-sm">
            Restore from archive
          </button>
        ) : canArchive ? (
          <button type="button" onClick={() => setOpen("archive")} disabled={busy} className="btn btn-outline btn-sm">
            Archive booking
          </button>
        ) : null}
        {!deleteBlocked && (
          <button type="button" onClick={() => setOpen("delete")} disabled={busy || deleting} className="btn btn-sm border border-red-300 text-red-800 hover:bg-red-50">
            Delete booking
          </button>
        )}
      </div>
      <ul className="space-y-1 text-xs text-ink-muted">
        {!archived && !canArchive && <li>Archive: {archiveHint}</li>}
        <li>Delete: {deleteBlocked ?? "possible — only for test or spam requests. The audit record is kept."}</li>
      </ul>

      <ConfirmDialog
        open={open === "archive" || open === "restore"}
        title={open === "restore" ? `Restore ${reference}?` : `Archive ${reference}?`}
        confirmLabel={open === "restore" ? "Restore" : "Archive"}
        busy={busy}
        onConfirm={() => archive(open === "archive")}
        onClose={close}
        reason={open === "archive" ? { value: reason, onChange: setReason, label: "Reason (optional, internal — kept in the audit trail)" } : undefined}
      >
        <p>
          {open === "restore"
            ? "The booking appears in the default lists again. Nothing else changes."
            : "The booking is hidden from the default lists (use “Show archived” to see it). The record, its payments, quotations and receipts are kept unchanged, and the customer still sees it in their account."}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "delete"}
        title={`Delete ${reference} permanently?`}
        confirmLabel="Delete booking"
        danger
        busy={deleting}
        confirmDisabled={!reasonOk || !typedOk}
        onConfirm={remove}
        onClose={close}
        reason={{ value: reason, onChange: setReason, label: "Reason (required, at least 3 characters — e.g. test booking, spam)" }}
      >
        <p>
          This deletes the booking, releases its slot and removes its change requests. It can&rsquo;t be undone. The audit record (who, when, reference,
          reason) is kept, and the customer is told in their account.
        </p>
        <label htmlFor={`${uid}-ref`} className="mt-3 block text-[0.8125rem] font-semibold text-ink">
          Type the booking reference <span className="font-mono">{reference}</span> to confirm
        </label>
        <input
          id={`${uid}-ref`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 block h-11 w-full rounded-xl border border-line-strong bg-surface px-3 font-mono text-[0.9375rem] text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold-light/40"
        />
      </ConfirmDialog>
    </div>
  );
}
