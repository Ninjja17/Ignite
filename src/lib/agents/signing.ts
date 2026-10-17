import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-olympics-signature";
export const TIMESTAMP_HEADER = "x-olympics-timestamp";
const MAX_SKEW_MS = 5 * 60 * 1000;

export function sign(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** Verifies an Agent Olympics request signature; agents should use the same check. */
export function verify(secret: string, timestamp: string | null, signature: string | null, body: string, now = Date.now()): boolean {
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) return false;
  const expected = Buffer.from(sign(secret, timestamp, body));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
