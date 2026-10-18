"use client";

import { useRouter } from "next/navigation";
import { noticeFor } from "@/lib/auth/errors";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import NotConfigured from "../auth/NotConfigured";
import AdminCredentialForm from "./AdminCredentialForm";

/**
 * Admin sign-in: email + password credentials created in Firebase only (plus
 * an authenticator code when two-step sign-in is set up). There is
 * deliberately no Google option and no sign-up. The role check in the form
 * only gives a clear message; the server re-verifies the claim, MFA and
 * session age on every admin page and API request (src/lib/auth/server.ts).
 */
export default function AdminLoginForm({ next, reason }: { next: string; reason?: "mfa" | "expired" }) {
  const router = useRouter();
  if (!isFirebaseConfigured) return <NotConfigured />;
  const initialNotice = reason === "mfa" ? noticeFor("admin/mfa-required") : reason === "expired" ? noticeFor("admin/session-expired") : null;
  return (
    <AdminCredentialForm
      submitLabel="Sign in to admin"
      initialNotice={initialNotice}
      onSignedIn={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
