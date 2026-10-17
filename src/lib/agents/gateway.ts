import type { AgentProfile } from "@/lib/domain/types";
import { config } from "@/lib/config";
import { MAX_AGENT_RESPONSE_BYTES, parseDecideResponse, type DecideRequest, type DecideResponse } from "./protocol";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, sign } from "./signing";

const AGENT_TIMEOUT_MS = 20_000;

export class AgentCallError extends Error {}

export function resolveEndpoint(agent: AgentProfile): URL {
  const url = agent.endpoint.startsWith("/") ? new URL(agent.endpoint, config.internalBaseUrl) : new URL(agent.endpoint);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(agent.builtIn || local || config.allowInsecureAgentEndpoints)) {
    throw new AgentCallError("Agent endpoints must use HTTPS.");
  }
  return url;
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_AGENT_RESPONSE_BYTES) {
      await reader.cancel();
      throw new AgentCallError(`Agent response exceeded ${MAX_AGENT_RESPONSE_BYTES} bytes.`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** Calls an agent's decide endpoint with a signed, idempotent request and validates the reply. */
export async function callAgent(agent: AgentProfile, request: DecideRequest, signal: AbortSignal): Promise<DecideResponse> {
  const url = resolveEndpoint(agent);
  const body = JSON.stringify(request);
  const timestamp = String(Date.now());
  const timeout = AbortSignal.timeout(AGENT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.any([signal, timeout]),
      headers: {
        "content-type": "application/json",
        "idempotency-key": request.attemptId,
        [TIMESTAMP_HEADER]: timestamp,
        [SIGNATURE_HEADER]: sign(config.agentSigningSecret, timestamp, body),
      },
      body,
    });
  } catch (error) {
    if (timeout.aborted) throw new AgentCallError(`Agent did not respond within ${AGENT_TIMEOUT_MS / 1000}s.`);
    throw error;
  }
  if (!response.ok) throw new AgentCallError(`Agent endpoint returned HTTP ${response.status}.`);

  let json: unknown;
  try {
    json = JSON.parse(await readLimited(response));
  } catch (error) {
    if (error instanceof AgentCallError) throw error;
    throw new AgentCallError("Agent response was not valid JSON.");
  }
  const parsed = parseDecideResponse(json);
  if (!parsed.ok) throw new AgentCallError(`Invalid agent response: ${parsed.error}`);
  return parsed.value;
}
