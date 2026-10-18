import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, PageHeader, Panel } from "@/components/admin/AdminUi";
import EntityManager from "@/components/admin/settings/EntityManager";
import VenueTermsList from "@/components/VenueTerms";
import { HallForm, PoliciesForm, PricingForm, RulesForm, SlotForm } from "@/components/admin/settings/SettingsForms";
import { loadSettings } from "@/lib/booking/admin-server";
import { formatTimestamp } from "@/lib/booking/format";
import { BUSINESS_TIME_ZONE } from "@/lib/config/business-config";
import { business } from "@/lib/config";
import { requireSuperAdmin } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  ["venue", "Venue"],
  ["hall", "Hall"],
  ["slots", "Slots"],
  ["rules", "Booking rules"],
  ["event-types", "Event types"],
  ["pricing", "Pricing"],
  ["policies", "Policies"],
  ["history", "Change history"],
] as const;
type SectionId = (typeof SECTIONS)[number][0];

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Authorization close to the data: a layout check alone doesn't stop this
  // segment rendering (Next.js partial rendering), so every admin page verifies.
  await requireSuperAdmin("/admin/settings");
  const params = await searchParams;
  const section: SectionId = SECTIONS.some(([id]) => id === params.section) ? (params.section as SectionId) : "venue";
  const result = await loadSettings();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Business settings"
        subtitle="Business configuration used by the booking engine, the booking page and staff bookings. Changes never rewrite existing bookings. Menus, packages and services are under Menus & packages."
      />
      <nav aria-label="Settings sections">
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <Link
                href={`/admin/settings?section=${id}`}
                aria-current={id === section ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                  id === section ? "border-imperial bg-imperial text-white" : "border-line bg-surface text-ink-soft hover:border-imperial/40 hover:text-imperial"
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref={`/admin/settings?section=${section}`} />
      ) : (
        (() => {
          const { config, stored, audit } = result.data;
          return (
            <>
              <p className="text-xs text-ink-muted">
                Configuration version {config.version}
                {stored && config.updatedAt ? ` · last saved ${formatTimestamp(new Date(config.updatedAt).toISOString())}` : " · built-in defaults (nothing saved yet)"}
              </p>
              {section === "venue" && (
                <Panel title="Venue">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-ink-muted">Business name</dt><dd className="font-semibold">{business.name}</dd></div>
                    <div><dt className="text-ink-muted">Time zone</dt><dd className="font-semibold">{BUSINESS_TIME_ZONE}</dd></div>
                    <div><dt className="text-ink-muted">Address</dt><dd className="font-semibold">{business.fullAddress ?? "Not configured"}</dd></div>
                    <div><dt className="text-ink-muted">Phones</dt><dd className="font-semibold">{business.phones.length ? business.phones.map((p) => p.display).join(" · ") : "Not configured"}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs text-ink-muted">
                    These verified details come from the website&rsquo;s business configuration (src/lib/config.ts) and are shown read-only here so
                    they can&rsquo;t be overwritten by mistake. The time zone drives &ldquo;today&rdquo; for every booking rule.
                  </p>
                </Panel>
              )}
              {section === "hall" && (
                <Panel title="Hall">
                  {config.halls.map((h) => (
                    <HallForm key={h.id} hall={h} />
                  ))}
                </Panel>
              )}
              {section === "slots" && (
                <Panel title="Day / Night slots">
                  <div className="space-y-3">
                    {[...config.slots].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => (
                      <SlotForm key={s.id} slot={s} />
                    ))}
                  </div>
                </Panel>
              )}
              {section === "rules" && (
                <Panel title="Booking rules">
                  <RulesForm rules={config.rules} />
                </Panel>
              )}
              {section === "event-types" && (
                <Panel title="Event types">
                  <EntityManager section="eventTypes" items={config.eventTypes} />
                </Panel>
              )}
              {section === "pricing" && (
                <Panel title="Pricing & advance">
                  <PricingForm pricing={config.pricing} halls={config.halls} />
                </Panel>
              )}
              {section === "policies" && (
                <>
                  <Panel title="Official venue terms">
                    <p className="mb-4 text-sm text-ink-soft">
                      Shown on the public booking terms, in the booking review, on customers&rsquo; booking pages and in every
                      new quotation. No terms are confirmed yet. Any guest surcharge or service charge is applied from Pricing;
                      terms are shown as written. To change a term, update the text in the code (src/data/policies.ts).
                    </p>
                    <VenueTermsList className="text-sm" />
                  </Panel>
                  <Panel title="Policies">
                    <PoliciesForm policies={config.policies} />
                  </Panel>
                </>
              )}
              {section === "history" && (
                <Panel title="Configuration change history">
                  {audit.length === 0 ? (
                    <p className="text-sm text-ink-muted">No configuration changes yet.</p>
                  ) : (
                    <ul className="divide-y divide-line text-sm">
                      {audit.map((a) => (
                        <li key={a.auditId} className="py-2">
                          <span className="font-semibold">{a.label}</span> · <span className="font-mono">{a.entityId}</span> ·{" "}
                          {formatTimestamp(new Date(a.at).toISOString())} · {a.actor.email ?? a.actor.uid}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
