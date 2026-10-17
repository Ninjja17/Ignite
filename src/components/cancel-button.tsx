"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Posts to a cancel endpoint. Prompts for the admin token only when the server requires one. */
export function CancelButton({ url, label = "Cancel" }: { url: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const send = (token?: string) => fetch(url, { method: "POST", headers: token ? { "x-admin-token": token } : {} });
    let response = await send(sessionStorage.getItem("olympics-admin-token") ?? undefined);
    if (response.status === 401) {
      const token = window.prompt("Admin token") ?? "";
      sessionStorage.setItem("olympics-admin-token", token);
      response = await send(token);
    }
    if (!response.ok) setError(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "Cancel failed");
    setBusy(false);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={cancel} disabled={busy} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
        {busy ? "Cancelling…" : label}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
