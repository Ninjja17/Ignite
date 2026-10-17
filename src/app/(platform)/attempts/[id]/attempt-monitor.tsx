"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Attempt, ExecutionEvent, ExecutionEventKind } from "@/lib/domain/types";

const TERMINAL = new Set(["completed", "agent_failed", "policy_blocked", "timed_out", "infra_failed", "cancelled"]);

const KIND_STYLE: Record<ExecutionEventKind, { dot: string; label: string }> = {
  lifecycle: { dot: "bg-zinc-400", label: "lifecycle" },
  agent: { dot: "bg-violet-500", label: "agent" },
  policy: { dot: "bg-indigo-500", label: "policy" },
  browser_started: { dot: "bg-sky-500", label: "browser" },
  browser_stream: { dot: "bg-sky-300", label: "stream" },
  browser_step: { dot: "bg-sky-600", label: "step" },
  browser_error: { dot: "bg-red-500", label: "error" },
  browser_complete: { dot: "bg-emerald-500", label: "complete" },
  validation: { dot: "bg-amber-500", label: "check" },
  score: { dot: "bg-emerald-700", label: "score" },
};

const offset = (start: string | undefined, at: string) => {
  if (!start) return "";
  const ms = new Date(at).getTime() - new Date(start).getTime();
  return `+${(ms / 1000).toFixed(1)}s`;
};

/** Live monitor while running; step-through replay of the persisted trace afterwards. */
export function AttemptMonitor({ initialAttempt, initialEvents }: { initialAttempt: Attempt; initialEvents: ExecutionEvent[] }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(initialAttempt);
  const [events, setEvents] = useState(initialEvents);
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const live = !TERMINAL.has(attempt.status);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (TERMINAL.has(initialAttempt.status)) return;
    const source = new EventSource(`/api/attempts/${initialAttempt.id}/events`);
    source.onmessage = (message) => {
      const data = JSON.parse(message.data) as { type: "event"; event: ExecutionEvent } | { type: "attempt"; attempt: Attempt };
      if (data.type === "event") {
        setEvents((prev) => (prev.some((e) => e.seq === data.event.seq) ? prev : [...prev, data.event].sort((a, b) => a.seq - b.seq)));
      } else {
        setAttempt(data.attempt);
        if (TERMINAL.has(data.attempt.status)) {
          source.close();
          router.refresh();
        }
      }
    };
    return () => source.close();
  }, [initialAttempt.id, initialAttempt.status, router]);

  useEffect(() => {
    if (live && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [events.length, live]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setCursor((c) => {
        const next = (c ?? -1) + 1;
        if (next >= events.length - 1) setPlaying(false);
        return Math.min(next, events.length - 1);
      });
    }, 700);
    return () => clearInterval(timer);
  }, [playing, events.length]);

  const visible = cursor === null ? events : events.slice(0, cursor + 1);
  const current = cursor === null ? events[events.length - 1] : events[cursor];
  const currentUrl = useMemo(() => [...visible].reverse().find((e) => e.url)?.url, [visible]);
  const start = events[0]?.at;

  return (
    <div className="space-y-4">
      {live && attempt.streamingUrl && (
        <a href={attempt.streamingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 hover:bg-sky-100">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" /> Watch the live TinyFish browser session ↗
        </a>
      )}

      {!live && events.length > 1 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (cursor === null || cursor >= events.length - 1) setCursor(0);
                setPlaying((p) => !p);
              }}
              className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white"
            >
              {playing ? "Pause" : "▶ Replay"}
            </button>
            <input
              type="range"
              min={0}
              max={events.length - 1}
              value={cursor ?? events.length - 1}
              onChange={(e) => {
                setPlaying(false);
                setCursor(Number(e.target.value));
              }}
              className="flex-1"
              aria-label="Replay position"
            />
            <span className="w-20 text-right font-mono text-xs">
              {(cursor ?? events.length - 1) + 1}/{events.length}
            </span>
          </div>
          {current && (
            <div className="mt-3 rounded bg-white p-3 text-sm">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className={`h-2 w-2 rounded-full ${KIND_STYLE[current.kind].dot}`} />
                {KIND_STYLE[current.kind].label} · {offset(start, current.at)}
              </div>
              <p className="mt-1 font-medium">{current.message}</p>
              {currentUrl && <p className="mt-1 truncate font-mono text-xs text-zinc-500">📍 {currentUrl}</p>}
            </div>
          )}
        </div>
      )}

      <ol ref={listRef} className="max-h-[480px] space-y-1 overflow-y-auto pr-2 text-sm">
        {visible.map((event) => (
          <li
            key={event.seq}
            className={`flex gap-3 rounded px-2 py-1 ${cursor !== null && event.seq === current?.seq ? "bg-amber-50" : ""}`}
          >
            <span className="w-14 shrink-0 font-mono text-xs text-zinc-400">{offset(start, event.at)}</span>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_STYLE[event.kind].dot}`} />
            <span className="min-w-0">
              <span className={event.kind === "browser_error" ? "text-red-700" : ""}>{event.message}</span>
              {event.url && <span className="block truncate font-mono text-xs text-zinc-400">{event.url}</span>}
            </span>
          </li>
        ))}
        {live && (
          <li className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" /> {attempt.status.replace(/_/g, " ")}…
          </li>
        )}
      </ol>
    </div>
  );
}
