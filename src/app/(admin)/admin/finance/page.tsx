import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, Empty, PageHeader, StatusPill } from "@/components/admin/AdminUi";
import Icon from "@/components/Icon";
import { requireSuperAdmin } from "@/lib/auth/server";
import { FINANCE_FILTERS, loadFinanceOverview, type FinanceFilter } from "@/lib/booking/admin-server";
import { FINANCIAL_STATUS_LABELS } from "@/lib/booking/finance-model";
import { formatEventDate, formatPKR } from "@/lib/booking/format";

export const metadata: Metadata = { title: "Quotations & payments" };

const FILTER_LABELS: Record<FinanceFilter, string> = {
  outstanding: "Money outstanding",
  pricing_pending: "Pricing pending",
  paid: "Paid in full",
  all: "All",
};

/**
 * Read-only money overview across bookings. Amounts come from each booking's
 * stored price and its RECORDED payments only. Quotations are issued and
 * payments recorded / voided on the booking's page (confirmed, audited actions);
 * nothing here records or claims a payment.
 */
export default async function AdminFinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Authorization close to the data: a layout check alone doesn't stop this
  // segment rendering (Next.js partial rendering), so every admin page verifies.
  await requireSuperAdmin("/admin/finance");
  const params = await searchParams;
  const filter: FinanceFilter = (FINANCE_FILTERS as readonly string[]).includes(String(params.filter)) ? (params.filter as FinanceFilter) : "outstanding";
  const result = await loadFinanceOverview(filter);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Quotations & payments"
        subtitle="Prices and recorded payments by booking (past 12 months to 24 months ahead). Open a booking to issue a quotation, record a payment or void one."
      />
      <nav aria-label="Filter by payment position">
        <ul className="flex flex-wrap gap-2">
          {FINANCE_FILTERS.map((f) => (
            <li key={f}>
              <Link
                href={f === "outstanding" ? "/admin/finance" : `/admin/finance?filter=${f}`}
                aria-current={f === filter ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                  f === filter ? "border-imperial bg-imperial text-white" : "border-line bg-surface text-ink-soft hover:border-imperial/40 hover:text-imperial"
                }`}
              >
                {FILTER_LABELS[f]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref={`/admin/finance${filter === "outstanding" ? "" : `?filter=${filter}`}`} />
      ) : (
        <>
          <dl className="tnum grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ["Priced total", formatPKR(result.data.totals.total)],
                ["Recorded payments", formatPKR(result.data.totals.paid)],
                ["Remaining", formatPKR(result.data.totals.remaining)],
                ["Pricing pending", String(result.data.totals.unpriced)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-surface px-4 py-4 shadow-soft">
                <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
                <dd className="mt-2 font-display text-[1.5rem] font-semibold leading-none text-imperial">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-ink-muted">Totals cover the bookings listed below; bookings without a price are counted, never estimated.</p>

          {result.data.rows.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface shadow-soft">
              <Empty>No bookings in this view.</Empty>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-soft">
              <table className="tnum w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-line bg-surface-mid text-[0.6875rem] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Booking</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Event</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Paid</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Remaining</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.data.rows.map(({ row, summary }) => (
                    <tr key={row.bookingId} className="align-top hover:bg-surface-low">
                      <td className="px-4 py-3">
                        <Link href={`/admin/bookings/${row.bookingId}#finance`} className="font-semibold text-imperial underline-offset-2 hover:underline">
                          {row.reference}
                        </Link>
                        <span className="block text-xs text-ink-muted">{row.customerName}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatEventDate(row.eventDate, "short")}
                        <span className="block text-xs text-ink-muted">{row.slotLabel}</span>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={row.status} lapsed={row.holdLapsed} /></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{summary.total === null ? "—" : formatPKR(summary.total)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatPKR(summary.paid)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{summary.remaining === null ? "—" : formatPKR(summary.remaining)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                          <Icon name={summary.status === "paid" ? "check" : summary.status === "pricing_pending" ? "clock" : "alert"} className="h-3.5 w-3.5" />
                          {FINANCIAL_STATUS_LABELS[summary.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
