import { randomBytes, randomUUID } from "node:crypto";
import { getAgent } from "@/lib/catalog/agents";
import { getTask, resolveTask } from "@/lib/catalog/tasks";
import { config, isPubliclyReachable } from "@/lib/config";
import type { Attempt, AttemptStatus, Benchmark, CheckResult, EngineKind, ExecutionEvent } from "@/lib/domain/types";
import { TERMINAL_STATUSES } from "@/lib/domain/types";
import { AGENT_PROTOCOL_VERSION, MAX_GOAL_LENGTH, type DecideRequest, type DecideResponse } from "@/lib/agents/protocol";
import { AgentCallError, callAgent } from "@/lib/agents/gateway";
import type { BrowserEngine, EngineEvent } from "@/lib/execution/engine";
import { simulatedEngine } from "@/lib/execution/simulated";
import { tinyfishEngine } from "@/lib/execution/tinyfish";
import { evaluatePolicy } from "@/lib/policy/policy";
import { redactText, redactValue } from "@/lib/policy/redaction";
import { SCORE_VERSION, computeMetrics, scoreAttempt } from "@/lib/scoring/score";
import { publish } from "@/lib/store/bus";
import { store } from "@/lib/store/store";
import { runValidators } from "@/lib/validation/validators";

/**
 * In-process benchmark orchestrator. Runs inside the Next.js server for the demo; the queue and
 * `processAttempt` are designed to move unchanged into a separate worker backed by a PostgreSQL job queue.
 */

interface RunnerGlobal {
  queue: string[];
  active: Map<string, AbortController>;
  cancelledBenchmarks: Set<string>;
}

const g = globalThis as unknown as { __olympicsRunner?: RunnerGlobal };
const runner: RunnerGlobal = (g.__olympicsRunner ??= { queue: [], active: new Map(), cancelledBenchmarks: new Set() });

const engines: Record<EngineKind, BrowserEngine> = { tinyfish: tinyfishEngine, simulated: simulatedEngine };

export class LaunchError extends Error {}

export interface LaunchInput {
  name?: string;
  agentIds: string[];
  taskVersionIds: string[];
  repetitions: number;
  engine: EngineKind;
}

export async function launchBenchmark(input: LaunchInput): Promise<Benchmark> {
  const agentIds = [...new Set(input.agentIds)];
  const taskVersionIds = [...new Set(input.taskVersionIds)];
  if (agentIds.length === 0 || agentIds.some((id) => !getAgent(id))) throw new LaunchError("Select at least one valid agent.");
  if (taskVersionIds.length === 0 || taskVersionIds.some((id) => !getTask(id))) throw new LaunchError("Select at least one valid task.");
  const repetitions = Math.trunc(input.repetitions);
  if (!(repetitions >= 1 && repetitions <= 5)) throw new LaunchError("Repetitions must be between 1 and 5.");
  if (input.engine !== "tinyfish" && input.engine !== "simulated") throw new LaunchError("Unknown engine.");
  if (input.engine === "tinyfish" && !config.tinyfishApiKey) throw new LaunchError("TINYFISH_API_KEY is not configured; use the simulated engine.");
  const total = agentIds.length * taskVersionIds.length * repetitions;
  if (total > config.maxAttemptsPerBenchmark) throw new LaunchError(`This launch would create ${total} attempts; the limit is ${config.maxAttemptsPerBenchmark}.`);

  const now = new Date().toISOString();
  const benchmark: Benchmark = {
    id: randomUUID(),
    name: input.name?.trim().slice(0, 80) || `${input.engine === "tinyfish" ? "TinyFish" : "Simulated"} benchmark`,
    createdAt: now,
    engine: input.engine,
    agentIds,
    taskVersionIds,
    repetitions,
    status: "running",
    scoreVersion: SCORE_VERSION,
    resultClass: input.engine === "tinyfish" ? "official" : "experimental",
  };

  const attempts: Attempt[] = [];
  // Interleave agents so concurrent slots are shared fairly and provider conditions are comparable.
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const taskVersionId of taskVersionIds) {
      for (const agentId of agentIds) {
        attempts.push({
          id: randomUUID(),
          benchmarkId: benchmark.id,
          agentId,
          agentVersion: getAgent(agentId)!.version,
          taskVersionId,
          repetition,
          engine: input.engine,
          token: randomBytes(6).toString("hex"),
          status: "queued",
          scoreVersion: SCORE_VERSION,
          createdAt: now,
          timings: {},
          usage: { steps: 0, costSource: "unknown" },
          checks: [],
        });
      }
    }
  }

  await store.createBenchmark(benchmark, attempts);
  runner.queue.push(...attempts.map((a) => a.id));
  pump();
  return benchmark;
}

function pump() {
  while (runner.active.size < config.maxConcurrency && runner.queue.length > 0) {
    const attemptId = runner.queue.shift()!;
    const controller = new AbortController();
    runner.active.set(attemptId, controller);
    void processAttempt(attemptId, controller.signal)
      .catch((error) => console.error(`[orchestrator] attempt ${attemptId} crashed`, error))
      .finally(() => {
        runner.active.delete(attemptId);
        pump();
      });
  }
}

export async function cancelAttempt(attemptId: string): Promise<boolean> {
  const attempt = await store.getAttempt(attemptId);
  if (!attempt || TERMINAL_STATUSES.includes(attempt.status)) return false;
  const queuedIndex = runner.queue.indexOf(attemptId);
  if (queuedIndex !== -1) {
    runner.queue.splice(queuedIndex, 1);
    await finish(attempt, "cancelled", { failure: { source: "user", message: "Cancelled before start." } });
    await settleBenchmark(attempt.benchmarkId);
    return true;
  }
  runner.active.get(attemptId)?.abort();
  return true;
}

export async function cancelBenchmark(benchmarkId: string): Promise<void> {
  runner.cancelledBenchmarks.add(benchmarkId);
  const attempts = await store.listAttempts({ benchmarkId });
  await Promise.all(attempts.map((a) => cancelAttempt(a.id)));
  await store.updateBenchmark(benchmarkId, { status: "cancelled", finishedAt: new Date().toISOString() });
}

async function emitEvent(attempt: Attempt, event: Omit<ExecutionEvent, "seq" | "attemptId" | "at">) {
  const secrets = config.secrets;
  const saved = await store.appendEvent({
    attemptId: attempt.id,
    at: new Date().toISOString(),
    kind: event.kind,
    message: redactText(event.message, secrets).slice(0, 1000),
    url: event.url ? redactText(event.url, secrets).slice(0, 2000) : undefined,
    data: event.data ? redactValue(event.data, secrets) : undefined,
  });
  publish(attempt, { type: "event", event: saved });
}

async function transition(attempt: Attempt, status: AttemptStatus, patch: Partial<Attempt> = {}): Promise<Attempt> {
  const updated = (await store.updateAttempt(attempt.id, { ...patch, status }))!;
  publish(updated, { type: "attempt", attempt: updated });
  await emitEvent(updated, { kind: "lifecycle", message: `Status → ${status}` });
  return updated;
}

async function finish(attempt: Attempt, status: AttemptStatus, patch: Partial<Attempt> = {}): Promise<Attempt> {
  const finishedAt = new Date().toISOString();
  const totalMs = attempt.startedAt ? Date.parse(finishedAt) - Date.parse(attempt.startedAt) : 0;
  return transition(attempt, status, { ...patch, finishedAt, timings: { ...attempt.timings, ...patch.timings, totalMs } });
}

async function settleBenchmark(benchmarkId: string) {
  const benchmark = await store.getBenchmark(benchmarkId);
  if (!benchmark || benchmark.status !== "running") return;
  const attempts = await store.listAttempts({ benchmarkId });
  if (attempts.every((a) => TERMINAL_STATUSES.includes(a.status))) {
    await store.updateBenchmark(benchmarkId, {
      status: runner.cancelledBenchmarks.has(benchmarkId) ? "cancelled" : "completed",
      finishedAt: new Date().toISOString(),
    });
  }
}

/** Executes one attempt through the full state machine. Safe to call once per attempt id. */
async function processAttempt(attemptId: string, signal: AbortSignal): Promise<void> {
  let attempt = await store.getAttempt(attemptId);
  if (!attempt || attempt.status !== "queued") return;
  const agent = getAgent(attempt.agentId)!;
  const task = getTask(attempt.taskVersionId)!;
  const resolved = resolveTask(task, attempt.token, config.publicBaseUrl);

  try {
    attempt = await transition(attempt, "agent_deciding", { startedAt: new Date().toISOString() });

    if (attempt.engine === "tinyfish" && task.environment === "sandbox" && !isPubliclyReachable(config.publicBaseUrl)) {
      await emitEvent(attempt, { kind: "lifecycle", message: "Sandbox is not reachable by TinyFish. Set PUBLIC_BASE_URL to a public tunnel URL." });
      attempt = await finish(attempt, "infra_failed", { failure: { source: "platform", message: "PUBLIC_BASE_URL is not publicly reachable." } });
      return;
    }

    const request: DecideRequest = {
      protocolVersion: AGENT_PROTOCOL_VERSION,
      attemptId: attempt.id,
      task: {
        id: task.taskId,
        version: task.version,
        title: task.title,
        objective: task.objective,
        startUrl: resolved.startUrl,
        allowedDomains: resolved.allowedDomains,
        inputs: resolved.inputs,
        outputSchema: task.outputSchema,
        budgets: { maxSeconds: task.budgets.maxSeconds, maxSteps: task.budgets.maxSteps },
      },
    };

    const agentStart = Date.now();
    let decision: DecideResponse;
    try {
      decision = await callAgent(agent, request, signal);
    } catch (error) {
      if (signal.aborted) {
        attempt = await finish(attempt, "cancelled", { failure: { source: "user", message: "Cancelled." } });
        return;
      }
      const message = error instanceof AgentCallError ? error.message : `Agent call failed: ${(error as Error).message}`;
      await emitEvent(attempt, { kind: "agent", message });
      attempt = await finish(attempt, "agent_failed", { failure: { source: "agent", message }, timings: { agentMs: Date.now() - agentStart } });
      await scoreAndStore(attempt, resolved.allowedDomains);
      return;
    }
    const agentMs = Date.now() - agentStart;

    if (decision.action === "abort") {
      await emitEvent(attempt, { kind: "agent", message: `Agent aborted: ${decision.abortReason}` });
      attempt = await finish(attempt, "agent_failed", { failure: { source: "agent", message: `Aborted: ${decision.abortReason}` }, timings: { agentMs } });
      await scoreAndStore(attempt, resolved.allowedDomains);
      return;
    }

    const goal = redactText(decision.goal, config.secrets);
    attempt = await transition(attempt, "policy_check", {
      proposal: { goal, rationale: decision.rationale, agentVersion: decision.agentVersion },
      agentVersion: decision.agentVersion,
      timings: { agentMs },
    });
    await emitEvent(attempt, { kind: "agent", message: `Agent proposed a ${goal.length}-character goal`, data: { rationale: decision.rationale ?? null } });

    const policy = evaluatePolicy({
      goal: decision.goal,
      allowedDomains: resolved.allowedDomains,
      prohibitedPatterns: task.prohibitedPatterns,
      secrets: config.secrets,
      maxGoalLength: MAX_GOAL_LENGTH,
    });
    if (!policy.allowed) {
      for (const v of policy.violations) await emitEvent(attempt, { kind: "policy", message: `${v.code}: ${v.message}` });
      const critical = policy.violations.filter((v) => v.severity === "critical");
      const checks: CheckResult[] = critical.map((v) => ({
        validatorId: `policy-${v.code}`,
        kind: "policy",
        category: "security",
        status: "fail",
        weight: 2,
        critical: true,
        description: "Proposal complies with platform policy",
        detail: v.message,
      }));
      attempt = await finish(attempt, critical.length ? "policy_blocked" : "agent_failed", {
        checks,
        failure: { source: critical.length ? "policy" : "agent", message: policy.violations.map((v) => v.message).join(" ") },
      });
      await scoreAndStore(attempt, resolved.allowedDomains);
      return;
    }
    await emitEvent(attempt, { kind: "policy", message: "Proposal passed policy checks" });

    attempt = await transition(attempt, "browser_running");
    const engineStart = Date.now();
    const onEngineEvent = async (event: EngineEvent) => {
      switch (event.type) {
        case "started":
          if (event.runId) attempt = (await store.updateAttempt(attempt!.id, { engineRunId: event.runId }))!;
          await emitEvent(attempt!, { kind: "browser_started", message: event.message, data: event.runId ? { runId: event.runId } : undefined });
          break;
        case "stream_url":
          attempt = (await store.updateAttempt(attempt!.id, { streamingUrl: event.url }))!;
          publish(attempt, { type: "attempt", attempt });
          await emitEvent(attempt, { kind: "browser_stream", message: "Live browser view available" });
          break;
        case "step":
          await emitEvent(attempt!, { kind: "browser_step", message: event.message, url: event.url });
          break;
        case "error":
          await emitEvent(attempt!, { kind: "browser_error", message: event.message, url: event.url });
          break;
        case "complete":
          await emitEvent(attempt!, { kind: "browser_complete", message: event.message });
          break;
      }
    };
    const outcome = await engines[attempt.engine].run({ attemptId: attempt.id, resolved, goal: decision.goal, signal, emit: onEngineEvent });
    const engineMs = Date.now() - engineStart;
    const usagePatch = {
      engineRunId: outcome.runId ?? attempt.engineRunId,
      result: outcome.result === undefined ? undefined : redactValue(outcome.result, config.secrets),
      usage: { steps: outcome.steps, costUsd: outcome.costUsd, costSource: outcome.costSource },
      timings: { ...attempt.timings, engineMs },
      // Live view links are short-lived capability URLs; do not retain them after the run.
      streamingUrl: undefined,
    };

    if (!outcome.ok && outcome.failure === "cancelled") {
      attempt = await finish(attempt, "cancelled", { ...usagePatch, failure: { source: "user", message: "Cancelled." } });
      return;
    }
    if (!outcome.ok && outcome.failure === "provider") {
      attempt = await finish(attempt, "infra_failed", { ...usagePatch, failure: { source: "provider", message: outcome.error ?? "Provider failure" } });
      return;
    }

    attempt = await transition(attempt, "validating", usagePatch);
    const events = await store.listEvents(attempt.id);
    const checks = runValidators(task.validators, {
      result: attempt.result,
      expected: resolved.expected,
      token: attempt.token,
      visitedUrls: events.map((e) => e.url).filter((u): u is string => Boolean(u)),
      allowedDomains: resolved.allowedDomains,
      sandbox: await store.sandboxEvidence(attempt.token),
    });
    for (const c of checks) {
      await emitEvent(attempt, { kind: "validation", message: `${c.status.toUpperCase()} · ${c.description} — ${c.detail}` });
    }

    attempt = await transition(attempt, "scoring", { checks });
    const terminal: AttemptStatus = outcome.ok ? "completed" : outcome.failure === "timeout" ? "timed_out" : "completed";
    attempt = await finish(attempt, terminal, outcome.ok ? {} : { failure: { source: outcome.failure === "timeout" ? "timeout" : "agent", message: outcome.error ?? "Run failed" } });
    await scoreAndStore(attempt, resolved.allowedDomains);
  } catch (error) {
    console.error(`[orchestrator] attempt ${attemptId} failed`, error);
    const current = await store.getAttempt(attemptId);
    if (current && !TERMINAL_STATUSES.includes(current.status)) {
      await finish(current, "infra_failed", { failure: { source: "platform", message: `Platform error: ${(error as Error).message}` } });
    }
  } finally {
    await settleBenchmark(attempt?.benchmarkId ?? "");
  }
}

async function scoreAndStore(attempt: Attempt, allowedDomains: string[]) {
  const task = getTask(attempt.taskVersionId)!;
  const events = await store.listEvents(attempt.id);
  const metrics = computeMetrics({
    status: attempt.status,
    checks: attempt.checks,
    events,
    budgets: task.budgets,
    allowedDomains,
    timings: attempt.timings,
    usage: attempt.usage,
  });
  const scores = scoreAttempt(metrics);
  const updated = (await store.updateAttempt(attempt.id, { metrics, scores }))!;
  publish(updated, { type: "attempt", attempt: updated });
  await emitEvent(updated, {
    kind: "score",
    message: `${metrics.taskPassed ? "Task passed" : "Task failed"} · Navigation ${scores.navigation} · Decision ${scores.decision}`,
  });
}
