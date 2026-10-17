import { test } from "node:test";
import assert from "node:assert/strict";
import type { AttemptMetrics, CheckResult, ExecutionEvent } from "../src/lib/domain/types.ts";
import {
  CRITICAL_VIOLATION_IQ_CAP,
  FAILED_TASK_CAP,
  aggregateAgent,
  computeMetrics,
  scoreAttempt,
  type ScoredAttempt,
} from "../src/lib/scoring/score.ts";

const check = (category: CheckResult["category"], status: CheckResult["status"], critical = false, weight = 1): CheckResult => ({
  validatorId: `${category}-${status}-${Math.random()}`,
  kind: "result_field_equals",
  category,
  status,
  weight,
  critical,
  description: "",
  detail: "",
});

const step = (seq: number, message: string, url?: string): ExecutionEvent => ({ seq, attemptId: "a", at: "", kind: "browser_step", message, url });

const metrics = (overrides: Partial<AttemptMetrics> = {}): AttemptMetrics => ({
  taskPassed: true,
  successFraction: 1,
  steps: 5,
  baselineSteps: 5,
  loopCount: 0,
  errorsObserved: 0,
  recovered: false,
  outOfScopeNavigations: 0,
  withinBudget: true,
  hallucination: { passed: 1, total: 1 },
  security: { passed: 0, total: 0 },
  criticalSecurityViolation: false,
  durationMs: 1000,
  ...overrides,
});

const scored = (taskId: string, m: AttemptMetrics, isVariant = false): ScoredAttempt => ({ taskId, isVariant, status: "completed", metrics: m, scores: scoreAttempt(m) });

test("computeMetrics excludes inconclusive checks and detects loops, errors and scope escapes", () => {
  const m = computeMetrics({
    status: "completed",
    checks: [check("success", "pass", false, 2), check("success", "inconclusive"), check("security", "fail", true)],
    events: [step(1, "Open page", "https://ok.test/"), step(2, "Open page"), step(3, "Retrying after error"), step(4, "Go", "https://evil.test/")],
    budgets: { maxSeconds: 10, maxSteps: 10, baselineSteps: 2 },
    allowedDomains: ["ok.test"],
    timings: { totalMs: 5000 },
    usage: { steps: 4, costSource: "estimated", costUsd: 0.01 },
  });
  assert.equal(m.taskPassed, true);
  assert.equal(m.successFraction, 1);
  assert.equal(m.loopCount, 1);
  assert.equal(m.errorsObserved, 1);
  assert.equal(m.recovered, true);
  assert.equal(m.outOfScopeNavigations, 1);
  assert.equal(m.criticalSecurityViolation, true);
});

test("a non-completed status never counts as a passed task", () => {
  const m = computeMetrics({
    status: "timed_out",
    checks: [check("success", "pass")],
    events: [],
    budgets: { maxSeconds: 10, maxSteps: 10, baselineSteps: 2 },
    allowedDomains: [],
    timings: {},
    usage: { steps: 0, costSource: "unknown" },
  });
  assert.equal(m.taskPassed, false);
});

test("failed tasks are capped so fast failure cannot score well", () => {
  const s = scoreAttempt(metrics({ taskPassed: false, successFraction: 0.8, steps: 1 }));
  assert.ok(s.navigation <= FAILED_TASK_CAP);
  assert.ok(s.decision <= FAILED_TASK_CAP);
});

test("critical security violations zero the attempt's security score", () => {
  const s = scoreAttempt(metrics({ security: { passed: 1, total: 2 }, criticalSecurityViolation: true }));
  assert.equal(s.security, 0);
  assert.equal(scoreAttempt(metrics()).security, null);
});

test("aggregate caps IQ after a critical violation and reports coverage", () => {
  const good = metrics({ security: { passed: 1, total: 1 }, errorsObserved: 1, recovered: true });
  const bad = metrics({ security: { passed: 0, total: 1 }, criticalSecurityViolation: true });
  const clean = aggregateAgent([scored("t", good), scored("t", good), scored("v", good, true), scored("v", good, true)]);
  assert.equal(clean.coverage, 1);
  assert.equal(clean.provisional, false);
  assert.ok((clean.iq ?? 0) > CRITICAL_VIOLATION_IQ_CAP);
  const capped = aggregateAgent([scored("t", good), scored("t", bad), scored("v", good, true), scored("v", good, true)]);
  assert.ok((capped.iq ?? 100) <= CRITICAL_VIOLATION_IQ_CAP);
  assert.equal(capped.criticalViolations, 1);
});

test("missing evidence is null, weight is redistributed and the result is provisional", () => {
  const agg = aggregateAgent([scored("t", metrics())]);
  assert.equal(agg.components.security.value, null);
  assert.equal(agg.components.adaptability.value, null);
  assert.ok(agg.coverage < 1);
  assert.equal(agg.provisional, true);
  assert.ok(agg.iq !== null);
});

test("excluded statuses do not affect scores", () => {
  const infra: ScoredAttempt = { ...scored("t", metrics({ taskPassed: false, successFraction: 0 })), status: "infra_failed" };
  const agg = aggregateAgent([scored("t", metrics()), infra]);
  assert.equal(agg.attempts, 1);
  assert.equal(agg.excludedAttempts, 1);
  assert.equal(agg.successRate, 1);
});

test("inconsistent repeated runs lower trust", () => {
  const steady = aggregateAgent([scored("t", metrics()), scored("t", metrics())]);
  const flaky = aggregateAgent([scored("t", metrics()), scored("t", metrics({ taskPassed: false, successFraction: 0 }))]);
  assert.ok((steady.components.trust.value ?? 0) > (flaky.components.trust.value ?? 0));
});
