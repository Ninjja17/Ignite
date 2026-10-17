import { registerAttendee } from "@/lib/sandbox/service";

/** Sandbox form target. Uses a 303 redirect so browser agents land on a normal confirmation page. */
export async function POST(request: Request) {
  const form = await request.formData();
  const result = await registerAttendee({
    eventId: String(form.get("eventId") ?? ""),
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    consent: form.get("consent") === "yes",
  });
  const target = new URL(result.ok ? "/sandbox/events/confirmed" : "/sandbox/events", request.url);
  if (result.ok) {
    target.searchParams.set("code", result.code);
    target.searchParams.set("event", result.eventTitle);
  } else {
    target.searchParams.set("error", result.error);
  }
  return Response.redirect(target, 303);
}
