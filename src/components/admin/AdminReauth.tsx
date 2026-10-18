"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useDialog } from "../useDialog";
import AdminCredentialForm from "./AdminCredentialForm";
import { registerReauth } from "./adminFetch";

/**
 * "Confirm your password" dialog for sensitive admin actions. Mounted once in
 * the admin layout; adminFetch() opens it when the server answers
 * reauth_required, and retries the action after a successful sign-in.
 */
export default function AdminReauth({ email }: { email: string | null }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((ok: boolean) => {
    setOpen(false);
    resolveRef.current?.(ok);
    resolveRef.current = null;
  }, []);
  const cancel = useCallback(() => close(false), [close]);
  const closeRef = useDialog(open, cancel, panelRef);

  useEffect(() => {
    if (!email || !isFirebaseConfigured) return;
    registerReauth(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRef.current?.(false);
          resolveRef.current = resolve;
          setOpen(true);
        })
    );
    return () => registerReauth(null);
  }, [email]);

  if (!open || !email) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
      <div className="absolute inset-0 bg-noir/60" onClick={cancel} />
      <div ref={panelRef} className="relative max-h-[90svh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-frame sm:max-w-md sm:rounded-2xl sm:p-6">
        <h2 id={`${uid}-title`} className="font-display text-2xl font-normal text-ink">
          Confirm it&rsquo;s you
        </h2>
        <p className="mb-5 mt-2 text-sm leading-relaxed text-ink-soft">
          Payments, prices, policies, quotations and cancellations need a recent sign-in. Enter the password for{" "}
          <strong className="break-all font-semibold text-ink">{email}</strong>; the action continues afterwards.
        </p>
        <AdminCredentialForm fixedEmail={email} submitLabel="Confirm and continue" onSignedIn={() => close(true)} />
        <button ref={closeRef} type="button" onClick={cancel} className="btn btn-outline btn-sm mt-3 w-full">
          Cancel
        </button>
      </div>
    </div>
  );
}
