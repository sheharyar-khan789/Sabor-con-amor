import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import AdminFlash from "@/components/admin/AdminFlash";
import AdminNav from "@/components/admin/AdminNav";
import AdminReauth from "@/components/admin/AdminReauth";
import Icon from "@/components/Icon";
import SignOutButton from "@/components/SignOutButton";
import { safeNextPath } from "@/lib/auth/constants";
import { requireSuperAdmin } from "@/lib/auth/server";
import { loadAlerts } from "@/lib/booking/admin-server";
import { business } from "@/lib/config";

// Super Admin area (/admin/*). Private: never indexed.
// The Super Admin is verified here, on the server, BEFORE anything renders or
// streams: a valid session cookie + the server-set custom claim
// role=super_admin + a verified email (src/lib/auth/server.ts). Anyone else
// gets a 404 so the admin area isn't revealed. Every admin PAGE verifies again
// (a layout doesn't stop nested segments rendering) and every admin API route
// checks again (requireSuperAdminApi); hiding links in the UI is not the security.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

/** Stitch "Admin" shell: sidebar navigation on the ivory canvas (design system scope). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperAdmin(safeNextPath((await headers()).get("x-sp-return-to"), "/admin"));
  // Badge only; if the database doesn't answer, the nav simply shows no badge.
  const alerts = await loadAlerts(admin.uid);
  return (
    <div className="theme-sabor admin-ui min-h-svh bg-surface-low lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block lg:px-6 lg:py-6">
          <Link href="/admin" className="flex items-center gap-3 leading-none">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-imperial text-brass-light">
              <Icon name="shield" className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-[1.25rem] font-semibold text-imperial">{business.name}</span>
              <span className="mt-1 block text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-brass-text">Admin</span>
            </span>
          </Link>
          <SignOutButton redirectTo="/admin/login" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft hover:text-imperial lg:hidden" />
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto lg:py-2">
          <AdminNav alerts={alerts.ok ? { count: alerts.data.count, newCount: alerts.data.newCount } : null} />
        </div>
        <div className="hidden border-t border-line px-6 py-4 lg:block">
          <p className="truncate text-sm font-semibold text-ink" title={admin.email ?? undefined}>{admin.email}</p>
          <p className="text-xs text-ink-muted">Super Admin</p>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <Link href="/" className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-ink-soft hover:text-imperial">
              <Icon name="external" className="h-4 w-4" />
              View site
            </Link>
            <SignOutButton redirectTo="/admin/login" className="inline-flex min-h-[44px] items-center font-semibold text-ink-soft hover:text-imperial" />
          </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <AdminFlash />
          {children}
        </div>
      </main>
      <AdminReauth email={admin.email} />
    </div>
  );
}
