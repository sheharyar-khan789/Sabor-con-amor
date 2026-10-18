import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/AdminUi";
import Icon from "@/components/Icon";
import { eventCategories } from "@/data/events";
import { galleryItems } from "@/data/gallery";
import { highlights } from "@/data/highlights";
import { menuSheets, mehndiMenus, sweetsAndSides, weddingMenus } from "@/data/menu";
import { OFFICIAL_VENUE_TERMS } from "@/data/policies";
import { reviews } from "@/data/reviews";
import { requireSuperAdmin } from "@/lib/auth/server";
import { business, media, siteUrl, venueFeatures } from "@/lib/config";

export const metadata: Metadata = { title: "Website content" };

function State({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        ok ? "bg-status-confirmed-bg text-status-confirmed" : "bg-status-pending-bg text-status-pending"
      }`}
    >
      <Icon name={ok ? "check" : "clock"} className="h-3.5 w-3.5" />
      {label ?? (ok ? "Set" : "Not configured")}
    </span>
  );
}

/**
 * What the public website currently shows, and where each part comes from.
 * Read-only: website text and business details live in the code
 * (src/lib/config.ts, src/data/*) until in-browser content editing is decided;
 * empty values are hidden on the site, never filled with invented text.
 */
export default async function AdminContentPage() {
  // Authorization close to the data: a layout check alone doesn't stop this
  // segment rendering (Next.js partial rendering), so every admin page verifies.
  await requireSuperAdmin("/admin/content");
  const domainSet = !siteUrl.endsWith(".invalid");

  const identity: { label: string; value: string | null; note?: string }[] = [
    { label: "Business name", value: business.name, note: "From the venue's signage" },
    { label: "Tagline", value: business.tagline, note: "From the roadside sign; wording to confirm" },
    { label: "Website address", value: domainSet ? siteUrl : null, note: "NEXT_PUBLIC_SITE_URL" },
    { label: "Phone numbers", value: business.phones.length ? business.phones.map((p) => p.display).join(" · ") : null },
    { label: "WhatsApp", value: business.whatsappNumber },
    { label: "Address", value: business.fullAddress },
    { label: "Google Maps link", value: business.googleMapsUrl },
    { label: "Social accounts", value: [business.social.instagram, business.social.facebook, business.social.tiktok].filter(Boolean).join(" · ") || null },
    { label: "Google rating", value: business.rating !== null ? `${business.rating} (${business.reviewCount} reviews)` : null },
    { label: "Logo", value: media.logo },
  ];

  const menuCount = weddingMenus.length + mehndiMenus.length + sweetsAndSides.length;
  const collections: { label: string; count: number; file: string; note: string }[] = [
    { label: "Gallery photos", count: galleryItems.length, file: "src/data/gallery.ts", note: "Approved Sabor con Amor media; see Gallery" },
    { label: "Menus on the website", count: menuCount, file: "src/data/menu.ts", note: "Booking-form menus are managed under Menus & packages" },
    { label: "Menu card scans", count: menuSheets.length, file: "src/data/menu.ts", note: "None supplied" },
    { label: "Event categories", count: eventCategories.filter((e) => e.enabled).length, file: "src/data/events.ts", note: "Section hidden while empty" },
    { label: "Venue highlights / features", count: highlights.length + venueFeatures.length, file: "src/data/highlights.ts, src/lib/config.ts", note: "Section hidden while empty" },
    { label: "Google reviews shown", count: reviews.length, file: "src/data/reviews.ts", note: "Real, attributable reviews only" },
    { label: "Venue terms", count: OFFICIAL_VENUE_TERMS.length, file: "src/data/policies.ts", note: "Also copied into new quotations" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website"
        title="Website content"
        subtitle="What the public website shows and where it comes from. Anything not configured is hidden on the site rather than filled with placeholder text."
      />

      <section aria-labelledby="content-edit-title" className="rounded-lg border border-line bg-surface-mid p-5 text-sm text-ink-soft sm:p-6">
        <h2 id="content-edit-title" className="flex items-center gap-2 font-semibold text-ink">
          <Icon name="doc" className="h-4 w-4 text-brass-text" />
          Editing from the browser is not available yet
        </h2>
        <p className="mt-2 leading-relaxed">
          Website text and business details are part of the site&rsquo;s code today, so changes go through a code update. Booking
          settings (halls, slots, rules, event types, pricing, policies) are editable under{" "}
          <Link href="/admin/settings" className="font-semibold text-imperial underline underline-offset-2">Business settings</Link>, and menus,
          packages and services under{" "}
          <Link href="/admin/menus" className="font-semibold text-imperial underline underline-offset-2">Menus &amp; packages</Link>.
        </p>
      </section>

      <Panel title="Business details">
        <dl className="divide-y divide-line text-sm">
          {identity.map((i) => (
            <div key={i.label} className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
              <dt className="font-semibold text-ink">{i.label}</dt>
              <dd className="min-w-0 break-words text-ink-soft">
                {i.value ?? <span className="text-ink-muted">—</span>}
                {i.note && <span className="block text-xs text-ink-muted">{i.note}</span>}
              </dd>
              <dd><State ok={Boolean(i.value)} /></dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-muted">Source: src/lib/config.ts (website address: the NEXT_PUBLIC_SITE_URL environment variable).</p>
      </Panel>

      <Panel title="Content on the website">
        <div className="overflow-x-auto">
          <table className="tnum w-full min-w-[38rem] text-left text-sm">
            <thead className="border-b border-line text-[0.6875rem] uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-semibold">Content</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Items</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Source</th>
                <th scope="col" className="py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {collections.map((c) => (
                <tr key={c.label}>
                  <td className="py-3 pr-4 font-semibold text-ink">{c.label}</td>
                  <td className="py-3 pr-4"><State ok={c.count > 0} label={String(c.count)} /></td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink-soft">{c.file}</td>
                  <td className="py-3 text-ink-muted">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
