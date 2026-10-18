"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
} from "firebase/auth";
import { business } from "@/lib/config";
import { getFirebase } from "@/lib/firebase/client";
import { describeAuthError, noticeFor, type AuthNotice } from "@/lib/auth/errors";
import { NoticeBox, TextField } from "../auth/fields";
import { useAuth } from "../auth/AuthProvider";

/**
 * Deletes the customer's own account (DELETE /api/account). The customer
 * types DELETE and confirms it's them (password, or Google), and the server
 * checks that fresh sign-in again. Booking and payment records are kept for
 * the venue, without the account link (see src/lib/account/deletion.ts).
 */
export default function DeleteAccountForm({ email, isPassword }: { email: string | null; isPassword: boolean }) {
  const { configured, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ confirm?: string; password?: string }>({});
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const busyRef = useRef(false);

  if (!configured) return null;

  if (deleted) {
    return (
      <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-900">
        <p className="font-semibold">Your account has been deleted.</p>
        <p className="mt-2">You have been signed out on every device. Thank you for choosing {business.name}.</p>
        <Link href="/" className="btn btn-outline btn-sm mt-4">
          Go to the home page
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const found: typeof errors = {};
    if (confirmText.trim() !== "DELETE") found.confirm = "Type DELETE in capital letters to confirm.";
    if (isPassword && !password) found.password = "Please enter your password.";
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length) return;

    const { auth } = getFirebase();
    const current = auth.currentUser ?? user;
    if (!current) {
      setNotice(noticeFor("auth/requires-recent-login"));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      // Re-authentication: the server only accepts an ID token from a sign-in in the last 5 minutes.
      if (isPassword) {
        await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email ?? email ?? "", password));
      } else {
        await reauthenticateWithPopup(current, new GoogleAuthProvider());
      }
      const idToken = await current.getIdToken(true);
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ confirm: "DELETE", idToken }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (res.ok && data.ok) {
        setPassword("");
        setDeleted(true);
        await signOut(auth).catch(() => undefined);
        return;
      }
      setNotice({
        tone: "error",
        message:
          res.status === 429
            ? "Too many attempts. Please wait a few minutes and try again."
            : data.message ?? "Your account couldn't be deleted right now. Please try again.",
      });
    } catch (error) {
      setNotice(describeAuthError(error, "account deletion"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <NoticeBox notice={notice} />
      <div className="text-[0.9375rem] leading-relaxed text-ink-soft">
        <p>Deleting your account removes your profile, your notifications and your reviews, and signs you out everywhere.</p>
        <p className="mt-2">
          The venue keeps the records of past bookings and payments (receipts and quotations) as business records, no longer
          linked to an account. If you have a pending or upcoming booking, please contact the venue first.
        </p>
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost border-red-300 text-red-800 hover:bg-red-50">
          Delete my account
        </button>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Delete account">
          {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Type DELETE to confirm"
              name="confirm-delete"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              error={errors.confirm}
              required
            />
            {isPassword && (
              <TextField
                label="Current password"
                type="password"
                name="current-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                hint="Needed to confirm it's you."
                required
              />
            )}
          </div>
          {!isPassword && <p className="text-sm text-ink-muted">You&rsquo;ll be asked to confirm with your Google account.</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn border border-red-700 bg-red-700 text-white hover:bg-red-800">
              {busy ? "Deleting…" : "Delete my account permanently"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
