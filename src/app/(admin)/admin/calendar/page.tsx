import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, PageHeader, Panel, SlotStateText, StatusPill } from "@/components/admin/AdminUi";
import { OpsStatusPill } from "@/components/admin/OpsUi";
import { BlockSlotForm, UnblockButton } from "@/components/admin/BlockedSlots";
import { BLOCK_KIND_LABELS } from "@/lib/booking/model";
import CalendarRangeView from "./CalendarRangeView";
import ViewSwitch from "./ViewSwitch";
import { loadCalendar } from "@/lib/booking/admin-server";
import type { SlotState } from "@/lib/booking/availability";
import { addDays, businessToday, isIsoDate } from "@/lib/booking/dates";
import { formatEventDate } from "@/lib/booking/format";
import { requireSuperAdmin } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Calendar" };

// Coloured dot + symbol (phones) / word (wider screens), so state never relies on colour alone.
// "blocked" is admin-only: the public calendar shows a blocked slot as booked (unavailable).
const MARK: Record<SlotState | "blocked", { dot: string; sym: string; cls: string; word: string }> = {
  available: { dot: "bg-slot-free", sym: "○", cls: "text-slot-free", word: "free" },
  held: { dot: "bg-slot-held", sym: "◐", cls: "text-slot-held", word: "on hold" },
  booked: { dot: "bg-slot-booked", sym: "●", cls: "text-slot-booked", word: "booked" },
  closed: { dot: "bg-ink-muted/30", sym: "–", cls: "text-ink-muted", word: "closed" },
  blocked: { dot: "bg-ink-muted", sym: "⊘", cls: "text-ink-soft", word: "blocked" },
};

const shift = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Authorization close to the data: a layout check alone doesn't stop this
  // segment rendering (Next.js partial rendering), so every admin page verifies.
  await requireSuperAdmin("/admin/calendar");
  const params = await searchParams;
  const today = businessToday(new Date());
  // Phase 8: week and day views (operational); month view below is unchanged.
  const view = params.view === "week" || params.view === "day" ? params.view : "month";
  if (view !== "month") {
    const raw = typeof params.date === "string" && isIsoDate(params.date) ? params.date : today;
    // Weeks start on Monday (venue calendar); the day view shows one date.
    const weekday = (new Date(`${raw}T00:00:00Z`).getUTCDay() + 6) % 7;
    const start = view === "week" ? addDays(raw, -weekday) : raw;
    return <CalendarRangeView view={view} start={start} today={today} />;
  }
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : today.slice(0, 7);
  const date = typeof params.date === "string" && isIsoDate(params.date) && params.date.startsWith(month) ? params.date : null;
  const result = await loadCalendar(month);
  const monthName = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-5">
      <PageHeader title="Calendar" subtitle="Live slot availability (same engine as the public booking page)." />
      <ViewSwitch current="month" date={date ?? today} />
      <nav aria-label="Month" className="flex items-center justify-between gap-2">
        <Link href={`/admin/calendar?month=${shift(month, -1)}`} aria-label="Previous month" className="btn btn-outline btn-sm whitespace-nowrap">← Prev</Link>
        <h2 className="text-center font-display text-2xl font-normal text-ink sm:text-[1.75rem]">{monthName}</h2>
        <Link href={`/admin/calendar?month=${shift(month, 1)}`} aria-label="Next month" className="btn btn-outline btn-sm whitespace-nowrap">Next →</Link>
      </nav>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref={`/admin/calendar?month=${month}`} />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-ink-muted" aria-hidden="true">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <ol className="grid grid-cols-7 gap-1" aria-label={`Days in ${monthName}`}>
            {Array.from({ length: (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => (
              <li key={`b${i}`} aria-hidden="true" />
            ))}
            {result.data.days.map((d) => {
              const selected = d.date === date;
              const mark = (slotId: string, state: SlotState) => (result.data.blocks[`${d.date}|${slotId}`] ? MARK.blocked : MARK[state]);
              const label = `${formatEventDate(d.date)}: ${d.slots.map((s) => `${result.data.slots.find((x) => x.id === s.slotId)?.label} ${mark(s.slotId, s.state).word}`).join(", ")}`;
              return (
                <li key={d.date}>
                  <Link
                    href={`/admin/calendar?month=${month}&date=${d.date}`}
                    aria-label={label}
                    aria-current={selected ? "date" : undefined}
                    className={`flex min-h-[52px] flex-col rounded-lg border p-1 text-left text-xs shadow-soft transition-colors sm:min-h-[72px] sm:p-2 ${
                      selected ? "border-gold bg-surface ring-2 ring-gold" : "border-line bg-surface hover:border-gold/60"
                    } ${d.date === today ? "!border-gold-light ring-1 ring-gold-light" : ""}`}
                  >
                    <span className="font-semibold text-ink">{Number(d.date.slice(8))}</span>
                    <span className="mt-auto flex flex-col gap-0.5 leading-tight" aria-hidden="true">
                      {d.slots.map((s) => (
                        <span key={s.slotId} className="flex items-center gap-1">
                          <span className="w-2.5 text-xs font-semibold text-ink-soft">{result.data.slots.find((x) => x.id === s.slotId)?.label.charAt(0)}</span>
                          <span className={`h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5 ${mark(s.slotId, s.state).dot}`} />
                          <span className={`font-semibold sm:hidden ${mark(s.slotId, s.state).cls}`}>{mark(s.slotId, s.state).sym}</span>
                          <span className={`hidden truncate font-semibold sm:inline ${mark(s.slotId, s.state).cls}`}>{mark(s.slotId, s.state).word}</span>
                        </span>
                      ))}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <ul aria-label="Calendar legend" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink-soft shadow-soft">
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-slot-free" /> ○ Available (free)</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-slot-held" /> ◐ Pending / on hold (pending / under review)</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-slot-booked" /> ● Booked</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-ink-muted/30" /> – Closed (past)</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-ink-muted" /> ⊘ Blocked (by admin; shown as unavailable to the public)</li>
            <li className="font-semibold text-ink">D = Day, N = Night</li>
          </ul>

          {date && (
            <Panel title={formatEventDate(date)}>
              <ul className="grid gap-3 md:grid-cols-2">
                {result.data.slots.map((s) => {
                  const day = result.data.days.find((x) => x.date === date);
                  const state = day?.slots.find((x) => x.slotId === s.id)?.state ?? null;
                  const b = result.data.bookings[`${date}|${s.id}`];
                  const blk = result.data.blocks[`${date}|${s.id}`];
                  return (
                    <li key={s.id} className="rounded-xl border border-line bg-surface-low/50 p-3 text-sm">
                      <p className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{s.label}</span>
                        {blk ? <span className={`font-semibold ${MARK.blocked.cls}`}>⊘ Blocked</span> : <SlotStateText state={state} />}
                      </p>
                      {blk ? (
                        <div className="mt-2 flex flex-wrap items-start justify-between gap-2 rounded-lg bg-surface-low p-2">
                          <span className="min-w-0 break-words">
                            <span className="font-semibold">{BLOCK_KIND_LABELS[blk.kind]}</span> · {blk.reason}
                          </span>
                          <UnblockButton slotKey={blk.slotKey} blockId={blk.blockId} label={`${formatEventDate(date, "short")} · ${s.label}`} />
                        </div>
                      ) : b && state !== "available" ? (
                        <Link href={`/admin/bookings/${b.bookingId}`} className="mt-2 block rounded-lg bg-surface-low p-2 hover:bg-surface-mid">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">{b.customerName || "—"}</span>
                            <StatusPill status={b.status} lapsed={b.holdLapsed} />
                          </span>
                          <span className="block text-ink-soft">
                            {b.eventTypeLabel} · {b.guestCount.toLocaleString("en-US")} guests · <span className="font-mono">{b.reference}</span>
                          </span>
                          {(b.status === "confirmed" || b.status === "completed") && (
                            <span className="mt-1 flex flex-wrap items-center gap-2">
                              <OpsStatusPill status={result.data.ops[b.bookingId] ?? "not_started"} />
                            </span>
                          )}
                        </Link>
                      ) : (
                        <p className="mt-2 text-ink-muted">No booking in this slot.</p>
                      )}
                      {b && state !== "available" && (b.status === "confirmed" || b.status === "completed") && (
                        <Link href={`/admin/events/${b.bookingId}`} className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-gold underline-offset-2 hover:underline">
                          Open event sheet →
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          <Panel title="Blocked slots" id="blocked">
            <p className="mb-4 text-sm text-ink-soft">
              Close a date&rsquo;s Day, Night or both slots (holiday, maintenance, private event). Nobody can request a blocked slot and the public calendar
              shows it unavailable. A slot that already has a booking can&rsquo;t be blocked.
            </p>
            <BlockSlotForm today={result.data.today} horizonDays={result.data.horizonDays} initialDate={date && date >= result.data.today ? date : ""} />
            <h3 className="mb-2 mt-6 text-eyebrow font-medium uppercase text-ink-muted">Upcoming blocks</h3>
            {result.data.upcomingBlocks.length === 0 ? (
              <p className="text-sm text-ink-muted">No slots are blocked.</p>
            ) : (
              <ul className="divide-y divide-line">
                {result.data.upcomingBlocks.map((x) => {
                  const slot = result.data.slots.find((y) => y.id === x.slotId)?.label ?? x.slotId;
                  return (
                    <li key={x.slotKey} className="flex flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0 break-words">
                        <span className="font-semibold text-ink">⊘ {formatEventDate(x.date, "short")} · {slot}</span>
                        <span className="text-ink-soft"> — {BLOCK_KIND_LABELS[x.kind]}: {x.reason}</span>
                      </span>
                      <UnblockButton slotKey={x.slotKey} blockId={x.blockId} label={`${formatEventDate(x.date, "short")} · ${slot}`} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

