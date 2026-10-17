import { isAuthorized, jsonError } from "@/lib/http";
import { cancelAttempt } from "@/lib/orchestrator/orchestrator";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return jsonError(401, "A valid admin token is required.");
  const { id } = await params;
  const cancelled = await cancelAttempt(id);
  return cancelled ? Response.json({ ok: true }) : jsonError(409, "Attempt is not running.");
}
