import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, PageHeader, Panel } from "@/components/admin/AdminUi";
import EntityManager from "@/components/admin/settings/EntityManager";
import { requireSuperAdmin } from "@/lib/auth/server";
import { loadSettings } from "@/lib/booking/admin-server";

export const metadata: Metadata = { title: "Menus & packages" };

const TABS = [
  ["menus", "Menus"],
  ["packages", "Packages"],
  ["services", "Services"],
] as const;
type TabId = (typeof TABS)[number][0];

/**
 * Menus, packages and the services packages are built from. The same editors
 * and the same audited, versioned settings API as before (POST
 * /api/admin/settings, Super Admin only); nothing here invents dishes or prices.
 */
export default async function AdminMenusPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Authorization close to the data: a layout check alone doesn't stop this
  // segment rendering (Next.js partial rendering), so every admin page verifies.
  await requireSuperAdmin("/admin/menus");
  const params = await searchParams;
  const tab: TabId = TABS.some(([id]) => id === params.tab) ? (params.tab as TabId) : "menus";
  const result = await loadSettings();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Menus & packages"
        subtitle="Menus, packages and services offered in the booking form. Prices stay empty (“pricing pending”) until you enter confirmed amounts. Changes never rewrite existing bookings."
      />
      <nav aria-label="Menus and packages sections">
        <ul className="flex flex-wrap gap-2">
          {TABS.map(([id, label]) => (
            <li key={id}>
              <Link
                href={`/admin/menus?tab=${id}`}
                aria-current={id === tab ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                  id === tab ? "border-imperial bg-imperial text-white" : "border-line bg-surface text-ink-soft hover:border-imperial/40 hover:text-imperial"
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {!result.ok ? (
        <AdminError reason={result.reason} retryHref={`/admin/menus?tab=${tab}`} />
      ) : (
        (() => {
          const { config } = result.data;
          return (
            <>
              {tab === "menus" && (
                <Panel title="Menus">
                  {config.menus.length === 0 && (
                    <p className="mb-4 rounded-md bg-surface-mid px-4 py-3 text-sm text-ink-soft">
                      No menus yet. Add them from Sabor con Amor&rsquo;s confirmed menu card; the booking form lists only active menus.
                    </p>
                  )}
                  <EntityManager section="menus" items={config.menus} />
                </Panel>
              )}
              {tab === "packages" && (
                <Panel title="Packages">
                  <EntityManager section="packages" items={config.packages} services={config.services} menus={config.menus} />
                </Panel>
              )}
              {tab === "services" && (
                <Panel title="Services">
                  <EntityManager section="services" items={config.services} />
                </Panel>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
