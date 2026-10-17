import type { CostSource, ResolvedTask } from "@/lib/domain/types";

export type EngineEvent =
  | { type: "started"; runId?: string; message: string }
  | { type: "stream_url"; url: string }
  | { type: "step"; message: string; url?: string }
  | { type: "error"; message: string; url?: string }
  | { type: "complete"; message: string };

export type EngineFailure = "agent_task" | "provider" | "timeout" | "cancelled";

export interface EngineRunInput {
  attemptId: string;
  resolved: ResolvedTask;
  goal: string;
  signal: AbortSignal;
  emit: (event: EngineEvent) => Promise<void>;
}

export interface EngineRunResult {
  ok: boolean;
  failure?: EngineFailure;
  error?: string;
  runId?: string;
  result?: unknown;
  steps: number;
  costUsd?: number;
  costSource: CostSource;
}

/** Provider-neutral browser execution boundary; TinyFish is the production implementation. */
export interface BrowserEngine {
  readonly kind: "tinyfish" | "simulated";
  run(input: EngineRunInput): Promise<EngineRunResult>;
}

/** Output contract appended by the platform so every agent's result is machine-validatable. */
export function outputContract(schema: Record<string, string>): string {
  const keys = Object.entries(schema)
    .map(([key, description]) => `"${key}": ${description}`)
    .join("; ");
  return `\n\nWhen finished, return only a JSON object with these keys: ${keys}.`;
}
