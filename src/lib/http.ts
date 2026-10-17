import { timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
import { subscribe, type LiveMessage } from "@/lib/store/bus";

/** When OLYMPICS_ADMIN_TOKEN is set, run-launching and cancelling endpoints require it. */
export function isAuthorized(request: Request): boolean {
  const expected = config.adminToken;
  if (!expected) return true;
  const provided = request.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** Streams an initial snapshot followed by live bus messages as Server-Sent Events. */
export function liveStream(request: Request, channel: string, snapshot: () => Promise<LiveMessage[]>): Response {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (message: LiveMessage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const buffered: LiveMessage[] = [];
      let ready = false;
      const unsubscribe = subscribe(channel, (message) => (ready ? send(message) : buffered.push(message)));
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          cleanup();
        }
      }, 15_000);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
      for (const message of await snapshot()) send(message);
      ready = true;
      for (const message of buffered) send(message);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
