"use client";

import { useRef, useState } from "react";
import {
  getMultiFactorResolver,
  multiFactor,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
} from "firebase/auth";
import { authErrorCode, describeAuthError, noticeFor, type AuthNotice } from "@/lib/auth/errors";
import { SUPER_ADMIN_ROLE } from "@/lib/auth/constants";
import { business } from "@/lib/config";
import { getFirebase } from "@/lib/firebase/client";
import { isValidEmail, NoticeBox, TextField } from "../auth/fields";

/** Exchanges a fresh admin sign-in for the server session. The server re-checks everything. */
async function startAdminSession(user: User): Promise<"ok" | "not-admin" | "mfa-required" | "rate-limited" | "unavailable" | "failed"> {
  const token = await user.getIdTokenResult();
  if (token.claims.role !== SUPER_ADMIN_ROLE || token.claims.email_verified !== true) return "not-admin";
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ idToken: token.token }),
  });
  if (response.ok) return "ok";
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 403 && data.error === "mfa_required") return "mfa-required";
  if (response.status === 429) return "rate-limited";
  return response.status === 503 ? "unavailable" : "failed";
}

const SESSION_NOTICE = {
  "not-admin": "admin/not-admin",
  "rate-limited": "session/rate-limited",
  unavailable: "session/unavailable",
  failed: "session/failed",
} as const;

type Step = "password" | "code" | "enroll";

/**
 * Super Admin sign-in (email + password, then an authenticator code when the
 * account has one). Used by the admin sign-in page and by the "confirm your
 * password" step before sensitive actions (`fixedEmail`). When the server
 * requires MFA and the account has none yet, it walks through adding a TOTP
 * authenticator app (Firebase Identity Platform), then asks to sign in again.
 */
export default function AdminCredentialForm({
  fixedEmail,
  submitLabel,
  onSignedIn,
  initialNotice = null,
}: {
  fixedEmail?: string;
  submitLabel: string;
  onSignedIn: () => void;
  initialNotice?: AuthNotice | null;
}) {
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState(fixedEmail ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const [notice, setNotice] = useState<AuthNotice | null>(initialNotice);
  const [pending, setPending] = useState(false);
  const resolver = useRef<MultiFactorResolver | null>(null);
  const secret = useRef<TotpSecret | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [secretUri, setSecretUri] = useState("");

  /** After a complete sign-in: start the server session, or explain why not. */
  const finish = async (user: User) => {
    const result = await startAdminSession(user);
    if (result === "ok") {
      setPassword("");
      setCode("");
      onSignedIn();
      return;
    }
    if (result === "mfa-required") {
      // Signed in to Firebase, but the server needs a second factor: offer to add one.
      setNotice(noticeFor("admin/mfa-required"));
      await beginEnrollment(user);
      return;
    }
    await signOut(getFirebase().auth);
    setNotice(noticeFor(SESSION_NOTICE[result]));
    setPending(false);
  };

  const beginEnrollment = async (user: User) => {
    try {
      const session = await multiFactor(user).getSession();
      const generated = await TotpMultiFactorGenerator.generateSecret(session);
      secret.current = generated;
      setSecretKey(generated.secretKey);
      setSecretUri(generated.generateQrCodeUrl(user.email ?? "admin", `${business.name} Admin`));
      setStep("enroll");
    } catch (error) {
      const code = authErrorCode(error);
      describeAuthError(error, "admin MFA setup");
      await signOut(getFirebase().auth);
      setNotice(noticeFor(code === "auth/operation-not-allowed" ? "admin/mfa-not-enabled" : code, "session/failed"));
      setStep("password");
    } finally {
      setPending(false);
    }
  };

  const onPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!isValidEmail(email)) found.email = "Please enter a valid email address.";
    if (!password) found.password = "Please enter your password.";
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length) return;
    setPending(true);
    const { auth } = getFirebase();
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      await finish(user);
    } catch (error) {
      if (authErrorCode(error) === "auth/multi-factor-auth-required") {
        resolver.current = getMultiFactorResolver(auth, error as MultiFactorError);
        if (!resolver.current.hints.some((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
          setNotice({ tone: "error", message: "This account's second step isn't an authenticator app. Ask the site administrator to reset it." });
          setPending(false);
          return;
        }
        setStep("code");
        setPending(false);
        return;
      }
      setNotice(describeAuthError(error, "admin sign-in"));
      setPending(false);
    }
  };

  const onCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(value)) {
      setErrors({ code: "Enter the 6-digit code from your authenticator app." });
      return;
    }
    setErrors({});
    setNotice(null);
    setPending(true);
    try {
      if (step === "code") {
        const r = resolver.current;
        const hint = r?.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!r || !hint) throw Object.assign(new Error("no resolver"), { code: "auth/totp-challenge-timeout" });
        const credential = await r.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, value));
        await finish(credential.user);
      } else {
        const user = getFirebase().auth.currentUser;
        if (!user || !secret.current) throw Object.assign(new Error("no user"), { code: "auth/totp-challenge-timeout" });
        await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret.current, value), "Authenticator app");
        await signOut(getFirebase().auth);
        secret.current = null;
        setSecretKey("");
        setSecretUri("");
        setCode("");
        setPassword("");
        setStep("password");
        setNotice({ tone: "info", message: "Authenticator added. Sign in again with your password and a code from the app." });
        setPending(false);
      }
    } catch (error) {
      setNotice(describeAuthError(error, step === "code" ? "admin MFA sign-in" : "admin MFA enrolment"));
      setPending(false);
    }
  };

  const cancel = async () => {
    await signOut(getFirebase().auth).catch(() => undefined);
    resolver.current = null;
    secret.current = null;
    setStep("password");
    setCode("");
    setNotice(null);
  };

  if (step !== "password") {
    return (
      <div className="space-y-6">
        <NoticeBox notice={notice} />
        {step === "enroll" && (
          <div className="space-y-3 rounded-xl border border-line bg-surface-low p-4 text-sm leading-relaxed text-ink-soft">
            <p>
              1. Open an authenticator app (for example Google Authenticator or Microsoft Authenticator) and add an account
              with this setup key:
            </p>
            <p className="break-all rounded-lg bg-surface px-3 py-2 font-mono text-[0.9375rem] font-semibold tracking-wider text-ink">
              {secretKey.replace(/(.{4})/g, "$1 ").trim()}
            </p>
            <p>
              On this phone you can also{" "}
              <a href={secretUri} className="font-semibold text-gold underline underline-offset-2">
                open it in the authenticator app
              </a>
              .
            </p>
            <p>2. Enter the 6-digit code the app shows.</p>
          </div>
        )}
        <form onSubmit={onCode} noValidate className="space-y-5">
          <TextField
            label="Authenticator code"
            name="one-time-code"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
            hint={step === "code" ? "The 6-digit code from your authenticator app." : undefined}
            required
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={cancel} disabled={pending} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={pending} aria-busy={pending || undefined} className="btn btn-primary flex-1">
              {pending ? "Checking…" : step === "code" ? "Verify code" : "Add authenticator"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NoticeBox notice={notice} />
      <form onSubmit={onPassword} noValidate className="space-y-5">
        {fixedEmail ? (
          <input type="email" name="username" autoComplete="username" value={fixedEmail} readOnly hidden />
        ) : (
          <TextField
            label="Admin email"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />
        )}
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className="btn btn-primary w-full">
          {pending ? "Signing in…" : submitLabel}
        </button>
      </form>
    </div>
  );
}
