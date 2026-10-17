import { SANDBOX_FLIGHTS } from "@/lib/sandbox/data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from")?.toUpperCase();
  const to = url.searchParams.get("to")?.toUpperCase();
  const date = url.searchParams.get("date");
  const nonstop = url.searchParams.get("nonstop") === "1";
  // Artificial latency exercises an agent's handling of dynamically loaded content.
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const flights = SANDBOX_FLIGHTS.filter(
    (f) => (!from || f.from === from) && (!to || f.to === to) && (!date || f.date === date) && (!nonstop || f.stops === 0),
  );
  return Response.json({ flights }, { headers: { "cache-control": "no-store" } });
}
