"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "../Icon";

// Page-level confirmation for actions taken from a list row: after the refresh
// the row (and its own message) may disappear, so the result is shown here.

const EVENT = "sp:admin-flash";

export function flashAdminMessage(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export default function AdminFlash() {
  const pathname = usePathname();
  const [message, setMessage] = useState<{ text: string; path: string } | null>(null);

  useEffect(() => {
    const onFlash = (e: Event) => setMessage({ text: (e as CustomEvent<string>).detail, path: window.location.pathname });
    window.addEventListener(EVENT, onFlash);
    return () => window.removeEventListener(EVENT, onFlash);
  }, []);

  // A message belongs to the page it was raised on.
  const visible = message && message.path === pathname ? message.text : null;
  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      {visible && (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{visible}</span>
          <button type="button" onClick={() => setMessage(null)} className="shrink-0 font-semibold underline underline-offset-2">
            Dismiss
          </button>
        </p>
      )}
    </div>
  );
}
