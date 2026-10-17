const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/gi,
  /\b(api[_-]?key|token|password|passwd|secret|authorization)(["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi,
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{1,4}\b/g,
];

/** Removes configured secrets and common credential shapes before anything is persisted or streamed. */
export function redactText(text: string, secrets: string[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) out = out.split(secret).join("[REDACTED]");
  }
  out = out.replace(SECRET_PATTERNS[0], "[REDACTED]");
  out = out.replace(SECRET_PATTERNS[1], "Bearer [REDACTED]");
  out = out.replace(SECRET_PATTERNS[2], (_m, key: string, sep: string) => `${key}${sep}[REDACTED]`);
  out = out.replace(SECRET_PATTERNS[3], "[REDACTED-CARD]");
  return out;
}

/** Recursively redacts string values in a JSON-like structure. */
export function redactValue<T>(value: T, secrets: string[] = []): T {
  if (typeof value === "string") return redactText(value, secrets) as T;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, secrets)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactValue(v, secrets)])) as T;
  }
  return value;
}
