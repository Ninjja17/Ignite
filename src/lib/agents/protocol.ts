export const AGENT_PROTOCOL_VERSION = "1.0";
export const MAX_GOAL_LENGTH = 4000;
export const MAX_AGENT_RESPONSE_BYTES = 32 * 1024;

export interface DecideRequest {
  protocolVersion: typeof AGENT_PROTOCOL_VERSION;
  attemptId: string;
  task: {
    id: string;
    version: number;
    title: string;
    objective: string;
    startUrl: string;
    allowedDomains: string[];
    inputs: Record<string, string>;
    outputSchema: Record<string, string>;
    budgets: { maxSeconds: number; maxSteps: number };
  };
}

export type DecideResponse =
  | { action: "execute"; agentVersion: string; goal: string; rationale?: string }
  | { action: "abort"; agentVersion: string; abortReason: string };

const ALLOWED_KEYS = new Set(["action", "agentVersion", "goal", "rationale", "abortReason"]);

/** Strictly validates an untrusted agent response; unknown fields are rejected. */
export function parseDecideResponse(value: unknown): { ok: true; value: DecideResponse } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Response must be a JSON object." };
  }
  const record = value as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !ALLOWED_KEYS.has(key));
  if (unknownKeys.length > 0) {
    return { ok: false, error: `Unknown response fields: ${unknownKeys.join(", ")}.` };
  }
  const { action, agentVersion } = record;
  if (typeof agentVersion !== "string" || agentVersion.length === 0 || agentVersion.length > 64) {
    return { ok: false, error: "agentVersion must be a non-empty string of at most 64 characters." };
  }
  if (action === "abort") {
    if (typeof record.abortReason !== "string" || record.abortReason.length === 0) {
      return { ok: false, error: "abortReason is required when action is abort." };
    }
    return { ok: true, value: { action, agentVersion, abortReason: record.abortReason.slice(0, 500) } };
  }
  if (action !== "execute") {
    return { ok: false, error: "action must be execute or abort." };
  }
  if (typeof record.goal !== "string" || record.goal.trim().length === 0) {
    return { ok: false, error: "goal is required when action is execute." };
  }
  if (record.goal.length > MAX_GOAL_LENGTH) {
    return { ok: false, error: `goal exceeds ${MAX_GOAL_LENGTH} characters.` };
  }
  if (record.rationale !== undefined && typeof record.rationale !== "string") {
    return { ok: false, error: "rationale must be a string." };
  }
  return {
    ok: true,
    value: {
      action,
      agentVersion,
      goal: record.goal.trim(),
      rationale: typeof record.rationale === "string" ? record.rationale.slice(0, 1000) : undefined,
    },
  };
}
