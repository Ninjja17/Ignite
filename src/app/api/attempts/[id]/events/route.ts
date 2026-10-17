import { liveStream } from "@/lib/http";
import { store } from "@/lib/store/store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attempt = await store.getAttempt(id);
  if (!attempt) return new Response("Not found", { status: 404 });
  return liveStream(request, `attempt:${id}`, async () => {
    const [current, events] = await Promise.all([store.getAttempt(id), store.listEvents(id)]);
    return [
      ...(current ? [{ type: "attempt" as const, attempt: current }] : []),
      ...events.map((event) => ({ type: "event" as const, event })),
    ];
  });
}
