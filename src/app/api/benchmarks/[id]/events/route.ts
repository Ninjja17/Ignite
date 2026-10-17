import { liveStream } from "@/lib/http";
import { store } from "@/lib/store/store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const benchmark = await store.getBenchmark(id);
  if (!benchmark) return new Response("Not found", { status: 404 });
  return liveStream(request, `benchmark:${id}`, async () =>
    (await store.listAttempts({ benchmarkId: id })).map((attempt) => ({ type: "attempt" as const, attempt })),
  );
}
