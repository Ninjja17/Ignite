import { config } from "@/lib/config";
import { DEMO_STRATEGIES } from "@/lib/agents/demo-strategies";
import { AGENT_PROTOCOL_VERSION, type DecideRequest } from "@/lib/agents/protocol";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from "@/lib/agents/signing";

/** Reference implementation of the Agent Olympics decide protocol used by the built-in demo agents. */
export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const strategy = DEMO_STRATEGIES[agentId];
  if (!strategy) return Response.json({ error: "Unknown agent" }, { status: 404 });

  const body = await request.text();
  if (!verify(config.agentSigningSecret, request.headers.get(TIMESTAMP_HEADER), request.headers.get(SIGNATURE_HEADER), body)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  let decideRequest: DecideRequest;
  try {
    decideRequest = JSON.parse(body) as DecideRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (decideRequest.protocolVersion !== AGENT_PROTOCOL_VERSION) {
    return Response.json({ action: "abort", agentVersion: strategy.version, abortReason: "Unsupported protocol version" });
  }
  return Response.json(strategy.decide(decideRequest));
}
