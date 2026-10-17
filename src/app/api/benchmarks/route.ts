import { isAuthorized, jsonError } from "@/lib/http";
import { LaunchError, launchBenchmark } from "@/lib/orchestrator/orchestrator";
import type { EngineKind } from "@/lib/domain/types";

export async function POST(request: Request) {
  if (!isAuthorized(request)) return jsonError(401, "A valid admin token is required to launch benchmarks.");
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "Request body must be JSON.");
  }
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
  try {
    const benchmark = await launchBenchmark({
      name: typeof body.name === "string" ? body.name : undefined,
      agentIds: strings(body.agentIds),
      taskVersionIds: strings(body.taskVersionIds),
      repetitions: Number(body.repetitions ?? 1),
      engine: body.engine as EngineKind,
    });
    return Response.json({ id: benchmark.id }, { status: 201 });
  } catch (error) {
    if (error instanceof LaunchError) return jsonError(400, error.message);
    throw error;
  }
}
