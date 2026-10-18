"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { activeEventTypes, activeMenus, activePackages, activeServices, activeSlots, type BusinessConfig } from "@/lib/booking/catalog";
import { addDays } from "@/lib/booking/dates";
import { formatPKR } from "@/lib/booking/format";
import { flashAdminMessage } from "./AdminFlash";
import { adminFetch } from "./adminFetch";
import { NoticeLine, type Notice } from "./BookingActions";

// "Edit booking" (pending / under review / confirmed). Two steps: the server
// previews exactly what changes (fields, price before → after, new slot free?),
// then the admin saves with the reviewed total. Saving needs a recent sign-in
// ("Confirm it's you" dialog) and runs in one transaction on the server.

const inputClass =
  "block h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold-light/40 aria-[invalid=true]:border-red-600";
const labelClass = "mb-1 block text-[0.8125rem] font-semibold text-ink";

export interface EditableBooking {
  bookingId: string;
  reference: string;
  updatedAt: string;
  priced: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  guestCount: number;
  eventTypeId: string;
  eventTypeLabel: string;
  menuId: string;
  menuTitle: string;
  packageId: string;
  packageName: string;
  services: { id: string; label: string }[];
  customerNotes: string;
  date: string;
  slotId: string;
  capacity: number;
}

type Preview = {
  changes: { field: string; label: string; before: string; after: string }[];
  moving: boolean;
  slotFree: boolean;
  price: { before: number; after: number } | null;
};

export default function EditBookingForm({ booking: b, config, today }: { booking: EditableBooking; config: BusinessConfig; today: string }) {
  const uid = useId();
  const router = useRouter();
  const packages = activePackages(config);
  const services = activeServices(config);
  const [f, setF] = useState({
    name: b.contactName,
    phone: b.contactPhone,
    email: b.contactEmail,
    guests: String(b.guestCount),
    eventTypeId: b.eventTypeId,
    packageId: b.packageId,
    menu: b.menuId,
    notes: b.customerNotes,
    date: b.date,
    slotId: b.slotId,
  });
  const [serviceIds, setServiceIds] = useState(b.services.map((s) => s.id));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const pkgMenu = packages.find((p) => p.id === f.packageId)?.menuId ?? null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF((p) => ({ ...p, [k]: v }));
    setPreview(null);
  };
  const changes = () => ({
    contactName: f.name,
    contactPhone: f.phone,
    contactEmail: f.email.trim() || null,
    guestCount: /^\d+$/.test(f.guests.trim()) ? Number(f.guests.trim()) : -1,
    eventTypeId: f.eventTypeId,
    packageId: f.packageId || null,
    menuPreferenceId: pkgMenu ?? (f.menu || null),
    serviceIds,
    customerNotes: f.notes,
    date: f.date,
    slotId: f.slotId,
  });

  const post = async (body: object) => {
    const res = await adminFetch(`/api/admin/bookings/${b.bookingId}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ changes: changes(), expectedUpdatedAt: b.updatedAt, ...body }),
    });
    return { res, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  };
  const explain = (res: Response, data: Record<string, unknown>) => {
    if (data.fields && typeof data.fields === "object") {
      const fields = data.fields as Record<string, { message: string } | undefined>;
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.message])));
      return fields.body?.message ?? "Please check the highlighted fields.";
    }
    if (data.field && typeof data.message === "string") setErrors({ [data.field as string]: data.message });
    if (data.error === "pricing_incomplete") return `Prices this change needs are not configured: ${((data.missing as string[]) ?? []).join(", ")}. Nothing was changed.`;
    if (data.error === "reauth_required") return "Not saved: please confirm your password to continue.";
    if (res.status === 401) return "Your session has expired. Sign in again.";
    if (res.status === 403) return "You are not authorised to do this.";
    return typeof data.message === "string" ? data.message : "The change could not be made.";
  };

  const run = async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    setErrors({});
    try {
      await work();
    } catch {
      setNotice({ tone: "error", message: "Network error — nothing was changed. Check the connection and try again." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const review = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { res, data } = await post({ preview: true });
      if (res.ok && data.ok) {
        setPreview(data.preview as Preview);
        return;
      }
      setPreview(null);
      if (data.error === "no_change") setNotice({ tone: "info", message: "Nothing to save: the details are the same as the booking." });
      else setNotice({ tone: "error", message: explain(res, data) });
      if (data.error === "stale") router.refresh();
    });
  };

  const save = () =>
    void run(async () => {
      if (!preview) return;
      const { res, data } = await post({ expectedTotal: preview.price ? preview.price.after : undefined });
      if (res.ok && data.ok) {
        flashAdminMessage(`Saved: ${b.reference} was updated (${preview.changes.length} change${preview.changes.length === 1 ? "" : "s"}). The customer is notified in their account.`);
        setPreview(null);
        router.refresh();
        return;
      }
      if (data.error === "price_confirmation_required") setPreview(null);
      setNotice({ tone: "error", message: explain(res, data) });
      if (data.error === "stale") router.refresh();
    });

  const err = (k: string) =>
    errors[k] ? (
      <p id={`${uid}-${k}-err`} className="mt-1 text-xs font-medium text-red-700">
        {errors[k]}
      </p>
    ) : null;
  const a11y = (k: string) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `${uid}-${k}-err` : undefined });
  const field = (k: keyof typeof f, label: string, apiKey: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className={labelClass}>{label}</label>
      <input id={`${uid}-${k}`} value={f[k]} onChange={set(k)} className={inputClass} {...a11y(apiKey)} {...props} />
      {err(apiKey)}
    </div>
  );
  // Options = active items, plus the booking's current value if it has since been deactivated.
  const withCurrent = <T extends { id: string; name: string }>(list: T[], id: string, name: string) =>
    id && !list.some((x) => x.id === id) ? [...list.map((x) => ({ id: x.id, name: x.name })), { id, name: `${name} (current)` }] : list.map((x) => ({ id: x.id, name: x.name }));

  const serviceOptions = [
    ...services.map((x) => ({ id: x.id, name: x.name })),
    ...b.services.filter((x) => !services.some((a) => a.id === x.id)).map((x) => ({ id: x.id, name: `${x.label} (current)` })),
  ];

  return (
    <form onSubmit={review} noValidate className="space-y-4" aria-label={`Edit booking ${b.reference}`}>
      <div className="grid gap-3 sm:grid-cols-3">
        {field("name", "Customer Name", "contactName", { maxLength: 100 })}
        {field("phone", "Phone", "contactPhone", { type: "tel", maxLength: 24 })}
        {field("email", "Email (optional)", "contactEmail", { type: "email", maxLength: 254 })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {field("date", "Event date", "date", { type: "date", min: today, max: addDays(today, config.rules.bookingHorizonDays) })}
        <div>
          <label htmlFor={`${uid}-slot`} className={labelClass}>Slot</label>
          <select id={`${uid}-slot`} value={f.slotId} onChange={set("slotId")} className={inputClass} {...a11y("slotId")}>
            {activeSlots(config).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {err("slotId")}
        </div>
        {field("guests", `Guests (max ${b.capacity.toLocaleString("en-US")})`, "guestCount", { type: "number", inputMode: "numeric", min: 1, max: b.capacity })}
        <div>
          <label htmlFor={`${uid}-event`} className={labelClass}>Event type</label>
          <select id={`${uid}-event`} value={f.eventTypeId} onChange={set("eventTypeId")} className={inputClass} {...a11y("eventTypeId")}>
            {withCurrent(activeEventTypes(config), b.eventTypeId, b.eventTypeLabel).map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          {err("eventTypeId")}
        </div>
        {(packages.length > 0 || b.packageId) && (
          <div>
            <label htmlFor={`${uid}-package`} className={labelClass}>Package</label>
            <select id={`${uid}-package`} value={f.packageId} onChange={set("packageId")} className={inputClass} {...a11y("packageId")}>
              <option value="">No package</option>
              {withCurrent(packages, b.packageId, b.packageName).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {err("packageId")}
          </div>
        )}
        <div>
          <label htmlFor={`${uid}-menu`} className={labelClass}>Menu</label>
          <select id={`${uid}-menu`} value={pkgMenu ?? f.menu} onChange={set("menu")} disabled={!!pkgMenu} className={`${inputClass} disabled:opacity-70`} {...a11y("menuPreferenceId")}>
            <option value="">Not decided</option>
            {withCurrent(activeMenus(config), b.menuId, b.menuTitle).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {err("menuPreferenceId")}
        </div>
      </div>
      {(services.length > 0 || b.services.length > 0) && (
        <fieldset>
          <legend className={labelClass}>Services</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {serviceOptions.map((sv) => (
              <label key={sv.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm">
                <input
                  type="checkbox"
                  checked={serviceIds.includes(sv.id)}
                  onChange={() => {
                    setServiceIds((l) => (l.includes(sv.id) ? l.filter((x) => x !== sv.id) : [...l, sv.id]));
                    setPreview(null);
                  }}
                  className="h-5 w-5 accent-ink"
                />
                {sv.name}
              </label>
            ))}
          </div>
          {err("serviceIds")}
        </fieldset>
      )}
      <div>
        <label htmlFor={`${uid}-notes`} className={labelClass}>Customer notes (visible to the customer)</label>
        <textarea id={`${uid}-notes`} rows={3} maxLength={3000} value={f.notes} onChange={set("notes")} className={`${inputClass} h-auto py-2`} {...a11y("customerNotes")} />
        {err("customerNotes")}
      </div>

      <NoticeLine notice={notice} />

      {preview && (
        <div role="region" aria-label="Review the changes" className="space-y-3 rounded-xl border border-gold/40 bg-surface-low p-4 text-sm">
          <p className="font-semibold text-ink">Review the changes</p>
          <ul className="space-y-1">
            {preview.changes.map((c) => (
              <li key={c.field} className="break-words">
                <span className="font-semibold text-ink">{c.label}:</span> <span className="text-ink-muted line-through">{c.before || "—"}</span> → <span className="text-ink">{c.after || "—"}</span>
              </li>
            ))}
          </ul>
          {preview.moving && (
            <p className={preview.slotFree ? "text-ink-soft" : "font-semibold text-red-800"}>
              {preview.slotFree
                ? "The new date/slot is free right now. Saving claims it and releases the old one in the same step."
                : "The new date/slot is taken by another booking or blocked. Saving will be refused."}
            </p>
          )}
          {preview.price ? (
            <p className="text-ink">
              <span className="font-semibold">Price:</span> {formatPKR(preview.price.before)} → <strong>{formatPKR(preview.price.after)}</strong> (same pricing engine; issued quotations and receipts are not changed)
            </p>
          ) : b.priced ? (
            <p className="text-ink-soft">The price is not affected.</p>
          ) : (
            <p className="text-ink-soft">This booking has no price yet; the edit does not calculate one.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={busy || (preview.moving && !preview.slotFree)} aria-busy={busy || undefined} className="btn btn-primary btn-sm">
              {busy ? "Saving…" : preview.price && preview.price.after !== preview.price.before ? `Save with new total ${formatPKR(preview.price.after)}` : "Save changes"}
            </button>
            <button type="button" onClick={() => setPreview(null)} disabled={busy} className="btn btn-outline btn-sm">
              Keep editing
            </button>
          </div>
          <p className="text-xs text-ink-muted">Saving asks you to confirm your password if you signed in more than 15 minutes ago. The customer gets an in-app notification.</p>
        </div>
      )}
      {!preview && (
        <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-outline btn-sm">
          {busy ? "Checking…" : "Review changes"}
        </button>
      )}
    </form>
  );
}
