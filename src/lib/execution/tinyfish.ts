import { config } from "@/lib/config";
import { SseParser } from "./sse";
import { outputContract, type BrowserEngine, type EngineRunInput, type EngineRunResult } from "./engine";

/** TinyFish error codes that indicate the provider, not the agent's plan, prevented execution. */
const PROVIDER_ERRORS = /SITE_BLOCKED|BILLING_REJECTED|RATE_LIMIT|INTERNAL|UNAVAILABLE|QUOTA/i;
const TIMEOUT_ERRORS = /TIMEOUT|TIMED_OUT/i;

interface TinyFishEvent {
  type?: string;
  run_id?: string;
  runId?: string;
  streaming_url?: string;
  streamingUrl?: string;
  purpose?: string;
  message?: string;
  url?: string;
  current_url?: string;
  status?: string;
  result?: unknown;
  resultJson?: unknown;
  error?: unknown;
  usage?: { cost_usd?: number; costUsd?: number; steps?: number };
}

function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return [e.code, e.message].filter(Boolean).join(": ") || JSON.stringify(error);
  }
  return "Unknown TinyFish error";
}

/**
 * Runs one bounded TinyFish automation per attempt via the SSE endpoint. The caller's AbortSignal closes
 * the stream; TinyFish may continue billing a run server-side until it ends, so budgets are also passed
 * through the goal and enforced by the platform timeout.
 */
export const tinyfishEngine: BrowserEngine = {
  kind: "tinyfish",
  async run({ resolved, goal, signal, emit }: EngineRunInput): Promise<EngineRunResult> {
    const apiKey = config.tinyfishApiKey;
    if (!apiKey) return { ok: false, failure: "provider", error: "TINYFISH_API_KEY is not configured.", steps: 0, costSource: "unknown" };

    const timeout = AbortSignal.timeout(resolved.task.budgets.maxSeconds * 1000);
    const combined = AbortSignal.any([signal, timeout]);
    let steps = 0;
    let runId: string | undefined;
    let cost: number | undefined;

    try {
      const response = await fetch(`${config.tinyfishBaseUrl}/v1/automation/run-sse`, {
        method: "POST",
        signal: combined,
        cache: "no-store",
        headers: { "content-type": "application/json", accept: "text/event-stream", "x-api-key": apiKey },
        body: JSON.stringify({
          url: resolved.startUrl,
          goal: `${goal}${outputContract(resolved.task.outputSchema)}`,
          browser_profile: config.tinyfishBrowserProfile,
        }),
      });
      if (!response.ok || !response.body) {
        const detail = (await response.text().catch(() => "")).slice(0, 300);
        return { ok: false, failure: "provider", error: `TinyFish HTTP ${response.status} ${detail}`.trim(), steps, costSource: "unknown" };
      }

      const parser = new SseParser();
      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        const messages = done ? parser.flush() : parser.push(decoder.decode(value, { stream: true }));
        for (const message of messages) {
          let event: TinyFishEvent;
          try {
            event = JSON.parse(message.data) as TinyFishEvent;
          } catch {
            continue;
          }
          runId = event.run_id ?? event.runId ?? runId;
          const reportedCost = event.usage?.cost_usd ?? event.usage?.costUsd;
          if (typeof reportedCost === "number") cost = reportedCost;
          const type = (event.type ?? message.event).toUpperCase();
          const pageUrl = event.current_url ?? event.url;

          if (type === "STARTED") {
            await emit({ type: "started", runId, message: "TinyFish run started" });
          } else if (type === "STREAMING_URL" && (event.streaming_url ?? event.streamingUrl)) {
            await emit({ type: "stream_url", url: (event.streaming_url ?? event.streamingUrl) as string });
          } else if (type === "PROGRESS") {
            steps += 1;
            await emit({ type: "step", message: event.purpose ?? event.message ?? "Working", url: pageUrl });
          } else if (type === "ERROR") {
            await emit({ type: "error", message: errorText(event.error ?? event.message), url: pageUrl });
          } else if (type === "COMPLETE") {
            const costSource = cost !== undefined ? "reported" : "unknown";
            if ((event.status ?? "").toUpperCase() === "COMPLETED") {
              await emit({ type: "complete", message: "TinyFish run completed" });
              return { ok: true, runId, result: event.result ?? event.resultJson, steps, costUsd: cost, costSource };
            }
            const error = errorText(event.error ?? event.status);
            await emit({ type: "error", message: `Run ended: ${error}` });
            const failure = PROVIDER_ERRORS.test(error) ? "provider" : TIMEOUT_ERRORS.test(error) ? "timeout" : "agent_task";
            return { ok: false, failure, error, runId, result: event.result ?? event.resultJson, steps, costUsd: cost, costSource };
          }
        }
        if (done) break;
      }
      return { ok: false, failure: "provider", error: "TinyFish stream ended without a COMPLETE event.", runId, steps, costUsd: cost, costSource: cost !== undefined ? "reported" : "unknown" };
    } catch (error) {
      const costSource = cost !== undefined ? "reported" : "unknown";
      if (timeout.aborted) return { ok: false, failure: "timeout", error: "Exceeded the task time budget.", runId, steps, costUsd: cost, costSource };
      if (signal.aborted) return { ok: false, failure: "cancelled", error: "Cancelled.", runId, steps, costUsd: cost, costSource };
      return { ok: false, failure: "provider", error: `TinyFish connection failed: ${(error as Error).message}`, runId, steps, costUsd: cost, costSource };
    }
  },
};
