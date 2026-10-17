import { connection } from "next/server";
import { AGENTS, getAgent } from "@/lib/catalog/agents";
import { TASKS, getTask } from "@/lib/catalog/tasks";
import type { AgentProfile, Attempt, EngineKind } from "@/lib/domain/types";
import { SCORE_VERSION, aggregateAgent, isScored, type AgentAggregate, type ScoredAttempt } from "@/lib/scoring/score";
import { store } from "@/lib/store/store";

export interface LeaderboardRow {
  rank: number | null;
  agent: AgentProfile;
  aggregate: AgentAggregate;
}

function toScored(attempt: Attempt): ScoredAttempt | null {
  if (!attempt.metrics || !attempt.scores) return null;
  const task = getTask(attempt.taskVersionId);
  return {
    taskId: attempt.taskVersionId,
    isVariant: Boolean(task?.variantOf),
    status: attempt.status,
    metrics: attempt.metrics,
    scores: attempt.scores,
  };
}

/** Attempts comparable under the current score version and engine; never mixes engines. */
export async function comparableAttempts(engine: EngineKind, agentId?: string): Promise<Attempt[]> {
  await connection();
  const attempts = await store.listAttempts(agentId ? { agentId } : {});
  return attempts.filter((a) => a.engine === engine && a.scoreVersion === SCORE_VERSION);
}

export async function defaultEngine(): Promise<EngineKind> {
  await connection();
  const attempts = await store.listAttempts();
  return attempts.some((a) => a.engine === "tinyfish" && a.metrics) ? "tinyfish" : "simulated";
}

export function aggregateFor(attempts: Attempt[]): AgentAggregate {
  const scored = attempts.map(toScored).filter((a): a is ScoredAttempt => a !== null);
  const excluded = attempts.filter((a) => !isScored(a.status)).length;
  const aggregate = aggregateAgent(scored);
  return { ...aggregate, excludedAttempts: aggregate.excludedAttempts + excluded };
}

export async function getLeaderboard(engine: EngineKind): Promise<LeaderboardRow[]> {
  const attempts = await comparableAttempts(engine);
  const rows = AGENTS.map((agent) => ({ agent, aggregate: aggregateFor(attempts.filter((a) => a.agentId === agent.id)) }))
    .filter((row) => row.aggregate.attempts > 0)
    .sort((a, b) => (b.aggregate.iq ?? -1) - (a.aggregate.iq ?? -1));
  let rank = 0;
  return rows.map((row) => ({ ...row, rank: row.aggregate.provisional ? null : ++rank }));
}

export interface TaskBreakdown {
  taskVersionId: string;
  title: string;
  attempts: number;
  passed: number;
  meanDecision: number | null;
  medianSteps: number | null;
}

export function taskBreakdown(attempts: Attempt[]): TaskBreakdown[] {
  return TASKS.map((task) => {
    const relevant = attempts.filter((a) => a.taskVersionId === task.id && a.metrics && isScored(a.status));
    const steps = relevant.map((a) => a.metrics!.steps).sort((x, y) => x - y);
    return {
      taskVersionId: task.id,
      title: task.title,
      attempts: relevant.length,
      passed: relevant.filter((a) => a.metrics!.taskPassed).length,
      meanDecision: relevant.length ? relevant.reduce((s, a) => s + (a.scores?.decision ?? 0), 0) / relevant.length : null,
      medianSteps: steps.length ? steps[Math.floor(steps.length / 2)] : null,
    };
  }).filter((row) => row.attempts > 0);
}

export function failureTaxonomy(attempts: Attempt[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  const bump = (label: string) => counts.set(label, (counts.get(label) ?? 0) + 1);
  for (const a of attempts) {
    if (a.status === "infra_failed") bump(`Infrastructure (${a.failure?.source ?? "unknown"}) — excluded`);
    else if (a.status === "cancelled") bump("Cancelled — excluded");
    else if (a.status === "policy_blocked") bump("Blocked by policy");
    else if (a.status === "agent_failed") bump("Agent endpoint failure");
    else if (a.status === "timed_out") bump("Timed out");
    else if (a.metrics && !a.metrics.taskPassed) {
      const failed = a.checks.filter((c) => c.status === "fail");
      if (failed.some((c) => c.category === "security")) bump("Security check failed");
      else if (failed.some((c) => c.category === "hallucination")) bump("Ungrounded / hallucinated output");
      else bump("Wrong or incomplete result");
    }
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function agentName(agentId: string): string {
  return getAgent(agentId)?.name ?? agentId;
}
