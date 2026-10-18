import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, Empty, PageHeader, Panel } from "@/components/admin/AdminUi";
import { loadStats } from "@/lib/booking/admin-server";
import { parseStatsRange } from "@/lib/booking/admin-stats";
import { businessToday } from "@/lib/booking/dates";
import { formatEventDate } from "@/lib/booking/format";
import { requireSuperAdmin } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Reports" };

// Booking statistics: counts only. There are deliberately NO revenue, payment
// or price figures on this page.

const field =
  "block h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold-light/40";
const pct = (x: number) => `${Math.round(x * 100)}%`;
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-4">
      <dt className="text-eyebrow font-medium uppercase text-ink-muted">{label}</dt>
      <dd className="mt-3 font-display text-[2.25rem] font-normal leading-none lining-nums tabular-nums text-ink">{value}</dd>
      {note && <dd className="mt-2 text-xs text-ink-muted">{note}</dd>}
    </div>
  );
}

/**
 * One measure as a table: the number is always text (the bar is decoration),
 * so the table IS the accessible view. Single series: one hue, no legend.
 */
function BarTable({ caption, head, rows }: { caption: string; head: [string, string]; rows: { key: string; label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line text-eyebrow uppercase text-ink-muted">
          <th scope="col" className="py-2 pr-3 font-medium">{head[0]}</th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">{head[1]}</th>
          <th scope="col" className="w-1/2 py-2 font-medium"><span className="sr-only">Bar</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-line/60" title={`${r.label}: ${r.value}${r.note ? ` (${r.note})` : ""}`}>
            <th scope="row" className="py-2 pr-3 font-normal text-ink">{r.label}</th>
            <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-ink">
              {r.value}
              {r.note && <span className="ml-1 text-xs text-ink-muted">{r.note}</span>}
            </td>
            <td className="py-2" aria-hidden="true">
              <span className="block h-2.5 rounded-r bg-gold" style={{ width: r.value ? `max(4px, ${(r.value / max) * 100}%)` : 0 }} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Authorization close to the data: a layout check alone doesn't stop this
  // segment rendering (Next.js partial rendering), so every admin page verifies.
  await requireSuperAdmin("/admin/reports");
  const params = await searchParams;
  const range = parseStatsRange(params, businessToday(new Date()));
  const result = await loadStats(range);

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Booking statistics from existing records — counts only, no revenue or payment figures." />

      <form method="get" action="/admin/reports" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft">
        <div>
          <label htmlFor="r-from" className="mb-1 block text-[0.8125rem] font-semibold text-ink">From (event date)</label>
          <input id="r-from" name="from" type="date" defaultValue={range.from} className={field} />
        </div>
        <div>
          <label htmlFor="r-to" className="mb-1 block text-[0.8125rem] font-semibold text-ink">To</label>
          <input id="r-to" name="to" type="date" defaultValue={range.to} className={field} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm">Apply</button>
        <Link href="/admin/reports" className="btn btn-outline btn-sm">Reset</Link>
      </form>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref="/admin/reports" />
      ) : (
        <>
          <p className="text-sm text-ink-soft" aria-live="polite">
            {formatEventDate(range.from)} to {formatEventDate(range.to)} · by event date · archived bookings included
            {result.data.truncated && " · only the first 5,000 bookings were counted; narrow the range"}
          </p>

          <Panel title="Occupancy ahead">
            <dl className="grid gap-3 sm:grid-cols-3">
              {result.data.occupancy.map((o) => (
                <Tile
                  key={o.days}
                  label={`Next ${o.days} days`}
                  value={pct(o.occupancy)}
                  note={`${o.booked} of ${o.slots} Day/Night slots booked · ${o.held} on hold · ${o.blocked} blocked · ${o.free} free`}
                />
              ))}
            </dl>
            <p className="mt-3 text-xs text-ink-muted">From today. Booked = confirmed or completed. On-hold requests and blocked slots are shown separately and not counted as occupied.</p>
          </Panel>

          {result.data.stats.total === 0 ? (
            <Panel title="Bookings">
              <Empty>No bookings with an event date in this range. Try a wider range.</Empty>
            </Panel>
          ) : (
            <>
              <Panel title="Bookings in this range">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile label="All bookings" value={result.data.stats.total} note="Every status" />
                  <Tile label="Confirmed" value={result.data.stats.confirmed} note={`incl. ${result.data.stats.byStatus.completed} completed`} />
                  <Tile
                    label="Cancelled"
                    value={result.data.stats.cancelled}
                    note={result.data.stats.cancellationRate === null ? "No decided bookings" : `${pct(result.data.stats.cancellationRate)} of confirmed + cancelled`}
                  />
                  <Tile
                    label="Waiting / closed"
                    value={result.data.stats.byStatus.pending + result.data.stats.byStatus.under_review}
                    note={`waiting · ${result.data.stats.byStatus.rejected} rejected · ${result.data.stats.byStatus.expired} expired`}
                  />
                </dl>
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Bookings per month">
                  <BarTable
                    caption="Bookings per month (by event date)"
                    head={["Month", "Bookings"]}
                    rows={result.data.stats.perMonth.map((m) => ({ key: m.month, label: monthName(m.month), value: m.total, note: m.total ? `${m.booked} confirmed` : undefined }))}
                  />
                </Panel>
                <div className="space-y-5">
                  <Panel title="Day vs Night">
                    <BarTable
                      caption="Confirmed and completed bookings per slot"
                      head={["Slot", "Confirmed"]}
                      rows={result.data.stats.slotUsage.map((s) => ({ key: s.slotId, label: s.label, value: s.count }))}
                    />
                    <p className="mt-2 text-xs text-ink-muted">Confirmed and completed bookings.</p>
                  </Panel>
                  <Panel title="By event type">
                    <BarTable
                      caption="Bookings by event type"
                      head={["Event type", "Bookings"]}
                      rows={result.data.stats.byEventType.map((t) => ({ key: t.id, label: t.label, value: t.total, note: `${t.booked} confirmed` }))}
                    />
                  </Panel>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
