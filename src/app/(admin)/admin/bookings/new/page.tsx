import type { Metadata } from "next";
import { AdminError, PageHeader } from "@/components/admin/AdminUi";
import ManualBookingForm from "@/components/admin/ManualBookingForm";
import { loadCustomers } from "@/lib/booking/admin-server";
import { businessToday } from "@/lib/booking/dates";
import { loadConfigFresh } from "@/lib/config/config-server";
import { toPublicConfig } from "@/lib/config/business-config";
import { requireSuperAdmin } from "@/lib/auth/server";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Authorization close to the data: a layout check alone doesn't stop this
  // segment rendering (Next.js partial rendering), so every admin page verifies.
  await requireSuperAdmin("/admin/bookings/new");
  const params = await searchParams;
  const preselect = typeof params.customer === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(params.customer) ? params.customer : null;
  const [customers, cfg] = await Promise.all([loadCustomers(), loadConfigFresh()]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="New booking" subtitle="Walk-in, WhatsApp, phone or other offline booking. Same availability rules as the website." />
      {!customers.ok || !cfg.ok ? (
        <AdminError reason={!customers.ok ? customers.reason : !cfg.ok ? cfg.reason : "error"} retryHref="/admin/bookings/new" />
      ) : (
        <ManualBookingForm
          today={businessToday(new Date())}
          initialCustomerId={preselect}
          config={toPublicConfig(cfg.config)}
          customers={customers.data
            .filter((c) => c.uid)
            .map((c) => ({ uid: c.uid as string, name: c.name, email: c.email, phone: c.phone }))}
        />
      )}
    </div>
  );
}
