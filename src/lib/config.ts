/** Centralized, validated runtime configuration. Secrets are only read server-side. */
export const config = {
  get publicBaseUrl(): string {
    return (process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/$/, "");
  },
  get internalBaseUrl(): string {
    return (process.env.INTERNAL_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/$/, "");
  },
  get tinyfishApiKey(): string | undefined {
    return process.env.TINYFISH_API_KEY || undefined;
  },
  get tinyfishBaseUrl(): string {
    return (process.env.TINYFISH_BASE_URL ?? "https://agent.tinyfish.ai").replace(/\/$/, "");
  },
  get tinyfishBrowserProfile(): string {
    return process.env.TINYFISH_BROWSER_PROFILE ?? "lite";
  },
  get agentSigningSecret(): string {
    return process.env.AGENT_SIGNING_SECRET ?? "dev-only-signing-secret-change-me";
  },
  get adminToken(): string | undefined {
    return process.env.OLYMPICS_ADMIN_TOKEN || undefined;
  },
  get maxConcurrency(): number {
    return clampInt(process.env.MAX_CONCURRENT_ATTEMPTS, 3, 1, 20);
  },
  get maxAttemptsPerBenchmark(): number {
    return clampInt(process.env.MAX_ATTEMPTS_PER_BENCHMARK, 60, 1, 500);
  },
  get estimatedCostPerStepUsd(): number | undefined {
    const value = Number(process.env.ESTIMATED_COST_PER_STEP_USD);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  },
  get allowInsecureAgentEndpoints(): boolean {
    return process.env.ALLOW_INSECURE_AGENT_ENDPOINTS === "true";
  },
  /** Secrets that must never appear in persisted traces or be forwarded to agents/browsers. */
  get secrets(): string[] {
    return [process.env.TINYFISH_API_KEY, process.env.AGENT_SIGNING_SECRET, process.env.OLYMPICS_ADMIN_TOKEN].filter(
      (v): v is string => Boolean(v),
    );
  },
};

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function isPubliclyReachable(baseUrl: string): boolean {
  const host = new URL(baseUrl).hostname;
  return !(host === "localhost" || host.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^0\.0\.0\.0$|^\[?::1\]?$/.test(host));
}
