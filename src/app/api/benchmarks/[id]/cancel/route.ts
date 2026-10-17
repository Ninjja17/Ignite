import { isAuthorized, jsonError } from "@/lib/http";
import { cancelBenchmark } from "@/lib/orchestrator/orchestrator";
import { store } from "@/lib/store/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return jsonError(401, "A valid admin token is required.");
  const { id } = await params;
  if (!(await store.getBenchmark(id))) return jsonError(404, "Benchmark not found.");
  await cancelBenchmark(id);
  return Response.json({ ok: true });
}
