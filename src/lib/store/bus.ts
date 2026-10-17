import { EventEmitter } from "node:events";
import type { Attempt, ExecutionEvent } from "@/lib/domain/types";

export type LiveMessage =
  | { type: "event"; event: ExecutionEvent }
  | { type: "attempt"; attempt: Attempt };

const g = globalThis as unknown as { __olympicsBus?: EventEmitter };
const bus = (g.__olympicsBus ??= new EventEmitter().setMaxListeners(500));

/** In-process pub/sub for live monitoring. Replace with PostgreSQL LISTEN/NOTIFY when a separate worker runs. */
export function publish(attempt: Pick<Attempt, "id" | "benchmarkId">, message: LiveMessage) {
  bus.emit(`attempt:${attempt.id}`, message);
  bus.emit(`benchmark:${attempt.benchmarkId}`, message);
}

export function subscribe(channel: string, listener: (message: LiveMessage) => void): () => void {
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}
