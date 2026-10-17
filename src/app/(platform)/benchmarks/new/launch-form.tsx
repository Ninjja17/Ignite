"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { EngineKind } from "@/lib/domain/types";

export interface LaunchOption {
  id: string;
  label: string;
  detail: string;
  warning?: string;
}

export function LaunchForm({
  agents,
  tasks,
  tinyfishConfigured,
  sandboxReachable,
  maxAttempts,
}: {
  agents: LaunchOption[];
  tasks: (LaunchOption & { environment: "sandbox" | "live" })[];
  tinyfishConfigured: boolean;
  sandboxReachable: boolean;
  maxAttempts: number;
}) {
  const router = useRouter();
  const [engine, setEngine] = useState<EngineKind>(tinyfishConfigured ? "tinyfish" : "simulated");
  const [agentIds, setAgentIds] = useState(agents.map((a) => a.id));
  const [taskIds, setTaskIds] = useState(tasks.filter((t) => t.environment === "sandbox").map((t) => t.id));
  const [repetitions, setRepetitions] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = agentIds.length * taskIds.length * repetitions;

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    const send = (token?: string) =>
      fetch("/api/benchmarks", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ name, engine, agentIds, taskVersionIds: taskIds, repetitions }),
      });
    let response = await send(sessionStorage.getItem("olympics-admin-token") ?? undefined);
    if (response.status === 401) {
      const token = window.prompt("This deployment requires an admin token to launch benchmarks.") ?? "";
      sessionStorage.setItem("olympics-admin-token", token);
      response = await send(token);
    }
    const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    if (response.ok && body.id) {
      router.push(`/benchmarks/${body.id}`);
      return;
    }
    setError(body.error ?? `Launch failed (${response.status}).`);
    setBusy(false);
  }

  const sandboxWarning = engine === "tinyfish" && !sandboxReachable && taskIds.some((id) => tasks.find((t) => t.id === id)?.environment === "sandbox");

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="rounded-xl border border-zinc-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold">Execution engine</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`rounded-lg border p-3 ${engine === "tinyfish" ? "border-zinc-900" : "border-zinc-200"} ${!tinyfishConfigured ? "opacity-50" : ""}`}>
            <input type="radio" name="engine" className="mr-2" checked={engine === "tinyfish"} disabled={!tinyfishConfigured} onChange={() => setEngine("tinyfish")} />
            <strong>TinyFish</strong> — real browser, official results
            {!tinyfishConfigured && <p className="mt-1 text-xs text-zinc-500">Set TINYFISH_API_KEY on the server to enable.</p>}
          </label>
          <label className={`rounded-lg border p-3 ${engine === "simulated" ? "border-zinc-900" : "border-zinc-200"}`}>
            <input type="radio" name="engine" className="mr-2" checked={engine === "simulated"} onChange={() => setEngine("simulated")} />
            <strong>Simulated</strong> — offline demo, experimental results
          </label>
        </div>
        {sandboxWarning && (
          <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
            PUBLIC_BASE_URL is not publicly reachable, so TinyFish cannot open sandbox tasks. Those attempts will be marked infra_failed (not scored).
            Expose the app through a tunnel and set PUBLIC_BASE_URL, or choose only live tasks.
          </p>
        )}
      </fieldset>

      <div className="grid gap-6 md:grid-cols-2">
        <fieldset className="rounded-xl border border-zinc-200 bg-white p-5">
          <legend className="px-1 text-sm font-semibold">Agents</legend>
          {agents.map((a) => (
            <label key={a.id} className="flex gap-2 py-1.5 text-sm">
              <input type="checkbox" checked={agentIds.includes(a.id)} onChange={() => setAgentIds(toggle(agentIds, a.id))} />
              <span>
                <strong>{a.label}</strong> <span className="text-zinc-500">{a.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="rounded-xl border border-zinc-200 bg-white p-5">
          <legend className="px-1 text-sm font-semibold">Tasks</legend>
          {tasks.map((t) => (
            <label key={t.id} className="flex gap-2 py-1.5 text-sm">
              <input type="checkbox" checked={taskIds.includes(t.id)} onChange={() => setTaskIds(toggle(taskIds, t.id))} />
              <span>
                <strong>{t.label}</strong> <span className="text-zinc-500">{t.detail}</span>
                {t.warning && <span className="block text-xs text-amber-700">{t.warning}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="flex flex-wrap items-end gap-6 rounded-xl border border-zinc-200 bg-white p-5">
        <label className="text-sm">
          Name
          <input name="name" placeholder="optional" maxLength={80} className="mt-1 block rounded border p-2" />
        </label>
        <label className="text-sm">
          Repetitions
          <input
            type="number"
            min={1}
            max={5}
            value={repetitions}
            onChange={(e) => setRepetitions(Number(e.target.value))}
            className="mt-1 block w-24 rounded border p-2"
          />
        </label>
        <p className={`text-sm ${total > maxAttempts ? "text-red-700" : "text-zinc-600"}`}>
          {total} attempts (limit {maxAttempts}). At least 2 repetitions are needed for a ranked consistency score.
        </p>
        <button type="submit" disabled={busy || total === 0 || total > maxAttempts} className="ml-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Launching…" : "Launch benchmark"}
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </form>
  );
}
