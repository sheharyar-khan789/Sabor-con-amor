import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import Icon from "@/components/Icon";
import { safeNextPath } from "@/lib/auth/constants";
import { business } from "@/lib/config";
import { getSessionUser, isSuperAdminSession } from "@/lib/auth/server";

// Separate admin sign-in. Lives outside the (admin) group so the admin guard
// layout doesn't wrap it, and outside (auth) so it never shows customer
// sign-up or Google sign-in. Private: never indexed.
export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

/** Stitch "Admin Access Gateway": a centred card on the ivory canvas. Only real behaviour is described. */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next, reason } = await searchParams;
  const requested = safeNextPath(typeof next === "string" ? next : undefined, "/admin");
  const nextPath = requested === "/admin" || requested.startsWith("/admin/") ? requested : "/admin";
  const user = await getSessionUser();
  if (user && isSuperAdminSession(user)) redirect(nextPath);

  return (
    <div className="theme-sabor flex min-h-svh flex-col items-center justify-center bg-surface-low px-4 py-10 sm:py-16">
      <main id="main" className="w-full max-w-[34rem]">
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
          <div aria-hidden="true" className="h-1 bg-gradient-to-r from-brass via-brass-deep to-imperial" />
          <div className="px-6 pb-8 pt-10 sm:px-12">
            <div className="text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-imperial text-brass-light shadow-soft">
                <Icon name="shield" className="h-8 w-8" />
              </span>
              <p className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-brass-text">
                {business.name} · Admin
              </p>
              <h1 className="mt-2 font-display text-[2.25rem] font-semibold leading-tight tracking-[-0.015em] text-ink sm:text-[2.5rem]">
                Admin sign in
              </h1>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">For venue management only. Sign in with your admin account.</p>
            </div>
            <div className="mt-8">
              <AdminLoginForm next={nextPath} reason={reason === "mfa" || reason === "expired" ? reason : undefined} />
            </div>
            <p className="mt-6 text-center text-sm">
              <Link href="/forgot-password?for=admin" className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-brass-text underline-offset-4 hover:text-imperial hover:underline">
                <Icon name="mail" className="h-4 w-4" />
                Forgot password?
              </Link>
            </p>
          </div>
          <div className="border-t border-line bg-surface-mid px-6 py-4 text-xs leading-relaxed text-ink-muted sm:px-12">
            Access is limited to accounts given the Super Admin role on the server. There is no public admin sign-up, and
            customer (Google) sign-ins never grant admin access.
          </div>
        </div>
        <p className="mt-6 text-center">
          <Link href="/" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink-soft hover:text-imperial">
            <Icon name="prev" className="h-4 w-4" />
            Back to website
          </Link>
        </p>
      </main>
    </div>
  );
}
