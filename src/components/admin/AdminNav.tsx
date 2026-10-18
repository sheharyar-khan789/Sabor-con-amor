"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "../Icon";

interface Item {
  href: string;
  label: string;
  icon: IconName;
  match: (p: string) => boolean;
}

const starts = (prefix: string) => (p: string) => p === prefix || p.startsWith(`${prefix}/`) || p.startsWith(`${prefix}?`);

// The approved admin structure (Stitch "Admin Overview Dashboard" sidebar),
// plus the existing operational tools kept under "More".
const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", icon: "star", match: (p) => p === "/admin" },
      { href: "/admin/bookings", label: "Bookings", icon: "doc", match: starts("/admin/bookings") },
      { href: "/admin/calendar", label: "Availability & calendar", icon: "calendar", match: starts("/admin/calendar") },
      { href: "/admin/customers", label: "Customers", icon: "user", match: starts("/admin/customers") },
    ],
  },
  {
    label: "Catalogue & money",
    items: [
      { href: "/admin/menus", label: "Menus & packages", icon: "dining", match: starts("/admin/menus") },
      { href: "/admin/gallery", label: "Gallery", icon: "expand", match: starts("/admin/gallery") },
      { href: "/admin/finance", label: "Quotations & payments", icon: "download", match: starts("/admin/finance") },
    ],
  },
  {
    label: "Site & settings",
    items: [
      { href: "/admin/content", label: "Website content", icon: "light", match: starts("/admin/content") },
      { href: "/admin/settings", label: "Business settings", icon: "shield", match: starts("/admin/settings") },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/admin/events", label: "Events", icon: "groups", match: starts("/admin/events") },
      { href: "/admin/vendors", label: "Vendors", icon: "groups", match: starts("/admin/vendors") },
      { href: "/admin/communications", label: "Communications", icon: "chat", match: starts("/admin/communications") },
      { href: "/admin/reviews", label: "Reviews", icon: "star", match: starts("/admin/reviews") },
      { href: "/admin/reports", label: "Reports", icon: "doc", match: starts("/admin/reports") },
    ],
  },
];

/** Waiting requests (pending + under review + open change requests) and how many are new since the last visit. */
export interface NavAlerts {
  count: number;
  newCount: number;
}

/**
 * Sidebar on large screens; a horizontally scrolling bar on smaller ones.
 * Navigation only: every admin page and API verifies the Super Admin on the server.
 */
export default function AdminNav({ alerts = null }: { alerts?: NavAlerts | null }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Admin">
      <div className="flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar lg:block lg:space-y-6 lg:overflow-visible lg:px-3 lg:pb-0">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex shrink-0 gap-1 lg:block">
            <p className="hidden px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted lg:block">{group.label}</p>
            <ul className="flex gap-1 lg:block lg:space-y-0.5">
              {group.items.map((item) => {
                const current = item.match(pathname);
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={`flex min-h-[44px] items-center gap-3 whitespace-nowrap rounded-md px-3 text-sm font-semibold transition-colors ${
                        current ? "bg-imperial text-white" : "text-ink-soft hover:bg-surface-mid hover:text-imperial"
                      }`}
                    >
                      <Icon name={item.icon} className={`h-[18px] w-[18px] shrink-0 ${current ? "text-brass-light" : "text-ink-muted"}`} />
                      <span>{item.label}</span>
                      {item.href === "/admin" && alerts && alerts.count > 0 && (
                        <span
                          className={`tnum ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${
                            current ? "bg-brass-light text-imperial" : "bg-brass-container text-brass-text"
                          }`}
                          aria-label={`${alerts.count} waiting${alerts.newCount ? `, ${alerts.newCount} new` : ""}`}
                        >
                          <span aria-hidden="true">{alerts.count}</span>
                          {alerts.newCount > 0 && <span aria-hidden="true">· {alerts.newCount} new</span>}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
