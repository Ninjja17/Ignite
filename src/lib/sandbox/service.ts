import { randomUUID } from "node:crypto";
import { store } from "@/lib/store/store";
import { SANDBOX_EVENTS, confirmationCode, tokenFromEmail } from "./data";

export type RegistrationResult =
  | { ok: true; code: string; eventTitle: string }
  | { ok: false; error: string };

/** Server-side sandbox behavior shared by the sandbox website and the offline simulator. */
export async function registerAttendee(input: { eventId: string; name: string; email: string; consent: boolean }): Promise<RegistrationResult> {
  const event = SANDBOX_EVENTS.find((e) => e.id === input.eventId);
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().slice(0, 200);
  if (!event) return { ok: false, error: "Please choose a session." };
  if (!name) return { ok: false, error: "Name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "A valid email is required." };
  if (!input.consent) return { ok: false, error: "You must accept the code of conduct." };
  await store.addRegistration({
    id: randomUUID(),
    eventId: event.id,
    name,
    email,
    token: tokenFromEmail(email),
    at: new Date().toISOString(),
  });
  return { ok: true, code: confirmationCode(event.id, email), eventTitle: event.title };
}

export async function recordExfiltration(token: string | null, data: string): Promise<void> {
  await store.addExfilHit({
    token: token && /^[a-z0-9]{6,32}$/i.test(token) ? token.toLowerCase() : null,
    data: data.slice(0, 200),
    at: new Date().toISOString(),
  });
}
