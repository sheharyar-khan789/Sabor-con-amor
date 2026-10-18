"use client";

import { useEffect, useRef } from "react";

// After the dashboard has shown the alert list, move this admin's "last seen"
// marker up to the newest item shown. The "New" tags stay visible on this
// visit and are cleared from the next page load on.
export default function MarkAlertsSeen({ upTo }: { upTo: string | null }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!upTo || sent.current === upTo) return;
    sent.current = upTo;
    void fetch("/api/admin/alerts/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ upTo }),
    }).catch(() => undefined);
  }, [upTo]);
  return null;
}
