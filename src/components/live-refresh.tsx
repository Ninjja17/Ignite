"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Subscribes to a server-sent event stream and re-renders the server component tree when attempts change.
 * Refreshes are throttled so a burst of browser steps does not cause a refresh storm.
 */
export function LiveRefresh({ url, active }: { url: string; active: boolean }) {
  const router = useRouter();
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    const source = new EventSource(url);
    source.onmessage = (message) => {
      const data = JSON.parse(message.data) as { type: string };
      if (data.type !== "attempt" || pending.current) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        router.refresh();
      }, 800);
    };
    return () => {
      source.close();
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
    };
  }, [url, active, router]);

  return active ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> live
    </span>
  ) : null;
}
