export type EngineKind = "tinyfish" | "simulated";

export type TaskCategory =
  | "comparison"
  | "registration"
  | "travel"
  | "extraction"
  | "security";

export type TaskEnvironment = "sandbox" | "live";

export type CheckCategory = "success" | "hallucination" | "security";

export type ValidatorKind =
  | "result_fields_present"
  | "result_field_equals"
  | "result_field_in_set"
  | "result_excludes"
  | "sandbox_registration"
  | "no_exfiltration"
  | "domain_containment";

export interface ValidatorSpec {
  id: string;
  kind: ValidatorKind;
  description: string;
  category: CheckCategory;
  weight: number;
  critical?: boolean;
  params: Record<string, unknown>;
}

export interface TaskBudgets {
  maxSeconds: number;
  maxSteps: number;
  baselineSteps: number;
}

export interface TaskVersion {
  id: string;
  taskId: string;
  version: number;
  title: string;
  summary: string;
  category: TaskCategory;
  environment: TaskEnvironment;
  variantOf?: string;
  /** Sandbox tasks use an app-relative path; live tasks use an absolute URL. */
  start: string;
  /** Required only for live tasks; sandbox tasks are scoped to the public app host. */
  liveDomains?: string[];
  objective: string;
  inputs: Record<string, string>;
  outputSchema: Record<string, string>;
  budgets: TaskBudgets;
  prohibitedPatterns: { pattern: string; reason: string }[];
  validators: ValidatorSpec[];
  reviewBy?: string;
}

/** A task version bound to one attempt: templated values, expected answers and runtime scope. */
export interface ResolvedTask {
  task: TaskVersion;
  startUrl: string;
  allowedDomains: string[];
  inputs: Record<string, string>;
  expected: Record<string, string>;
  token: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  organization: string;
  description: string;
  version: string;
  /** Absolute HTTPS URL or app-relative path for built-in demo agents. */
  endpoint: string;
  builtIn: boolean;
  color: string;
}

export type AttemptStatus =
  | "queued"
  | "agent_deciding"
  | "policy_check"
  | "browser_running"
  | "validating"
  | "scoring"
  | "completed"
  | "agent_failed"
  | "policy_blocked"
  | "timed_out"
  | "infra_failed"
  | "cancelled";

export const TERMINAL_STATUSES: readonly AttemptStatus[] = [
  "completed",
  "agent_failed",
  "policy_blocked",
  "timed_out",
  "infra_failed",
  "cancelled",
];

/** Attempts with these statuses are not the agent's fault and are excluded from agent scores. */
export const UNSCORED_STATUSES: readonly AttemptStatus[] = ["infra_failed", "cancelled"];

export type CheckStatus = "pass" | "fail" | "inconclusive";

export interface CheckResult {
  validatorId: string;
  kind: ValidatorKind | "policy";
  category: CheckCategory;
  status: CheckStatus;
  weight: number;
  critical: boolean;
  description: string;
  detail: string;
}

export type CostSource = "reported" | "estimated" | "unknown";

export interface AttemptUsage {
  steps: number;
  costUsd?: number;
  costSource: CostSource;
}

export interface AttemptTimings {
  agentMs?: number;
  engineMs?: number;
  totalMs?: number;
}

export interface AttemptMetrics {
  taskPassed: boolean;
  successFraction: number;
  steps: number;
  baselineSteps: number;
  loopCount: number;
  errorsObserved: number;
  recovered: boolean;
  outOfScopeNavigations: number;
  withinBudget: boolean;
  hallucination: { passed: number; total: number };
  security: { passed: number; total: number };
  criticalSecurityViolation: boolean;
  durationMs: number;
  costUsd?: number;
}

export interface AttemptScores {
  navigation: number;
  decision: number;
  recovery: number | null;
  security: number | null;
  hallucination: number | null;
}

export interface Attempt {
  id: string;
  benchmarkId: string;
  agentId: string;
  agentVersion: string;
  taskVersionId: string;
  repetition: number;
  engine: EngineKind;
  token: string;
  status: AttemptStatus;
  scoreVersion: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  proposal?: { goal: string; rationale?: string; agentVersion: string };
  engineRunId?: string;
  streamingUrl?: string;
  result?: unknown;
  failure?: { source: "agent" | "policy" | "provider" | "platform" | "timeout" | "user"; message: string };
  timings: AttemptTimings;
  usage: AttemptUsage;
  checks: CheckResult[];
  metrics?: AttemptMetrics;
  scores?: AttemptScores;
}

export type BenchmarkStatus = "running" | "completed" | "cancelled";

export interface Benchmark {
  id: string;
  name: string;
  createdAt: string;
  finishedAt?: string;
  engine: EngineKind;
  agentIds: string[];
  taskVersionIds: string[];
  repetitions: number;
  status: BenchmarkStatus;
  scoreVersion: string;
  resultClass: "official" | "experimental";
}

export type ExecutionEventKind =
  | "lifecycle"
  | "agent"
  | "policy"
  | "browser_started"
  | "browser_stream"
  | "browser_step"
  | "browser_error"
  | "browser_complete"
  | "validation"
  | "score";

export interface ExecutionEvent {
  seq: number;
  attemptId: string;
  at: string;
  kind: ExecutionEventKind;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
}

export interface SandboxRegistration {
  id: string;
  eventId: string;
  name: string;
  email: string;
  token: string | null;
  at: string;
}

export interface SandboxExfilHit {
  token: string | null;
  data: string;
  at: string;
}
