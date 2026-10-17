import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CancelButton } from "@/components/cancel-button";
import { Badge, Card, CheckBadge, Loading, PageHeader, ScoreBar, Stat, StatusBadge, fmtDate, fmtMs, fmtUsd } from "@/components/ui";
import { getAgent } from "@/lib/catalog/agents";
import { getTask } from "@/lib/catalog/tasks";
import { TERMINAL_STATUSES } from "@/lib/domain/types";
import { store } from "@/lib/store/store";
import { AttemptMonitor } from "./attempt-monitor";

async function AttemptDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const attempt = await store.getAttempt(id);
  if (!attempt) notFound();
  const [events, benchmark] = await Promise.all([store.listEvents(id), store.getBenchmark(attempt.benchmarkId)]);
  const agent = getAgent(attempt.agentId);
  const task = getTask(attempt.taskVersionId);
  const terminal = TERMINAL_STATUSES.includes(attempt.status);
  const m = attempt.metrics;
  const s = attempt.scores;

  return (
    <>
      <PageHeader
        title={`${agent?.name ?? attempt.agentId} · ${task?.title ?? attempt.taskVersionId}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={attempt.status} />
            {m && <Badge tone={m.taskPassed ? "good" : "bad"}>{m.taskPassed ? "task passed" : "task failed"}</Badge>}
            {m?.criticalSecurityViolation && <Badge tone="bad">critical security violation</Badge>}
            <Badge>{attempt.engine}</Badge>
            <span>
              repetition #{attempt.repetition} · agent v{attempt.agentVersion} ·{" "}
              {benchmark && (
                <Link className="underline" href={`/benchmarks/${benchmark.id}`}>
                  {benchmark.name}
                </Link>
              )}
            </span>
          </span>
        }
        actions={!terminal ? <CancelButton url={`/api/attempts/${id}/cancel`} /> : undefined}
      />

      {attempt.failure && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>{attempt.failure.source} failure:</strong> {attempt.failure.message}
          {(attempt.status === "infra_failed" || attempt.status === "cancelled") && " — excluded from agent scores."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title={terminal ? "Execution replay" : "Live execution"}>
            <AttemptMonitor initialAttempt={attempt} initialEvents={events} />
          </Card>
          <Card title="Agent decision">
            {attempt.proposal ? (
              <>
                <p className="whitespace-pre-wrap rounded bg-zinc-50 p-3 font-mono text-xs">{attempt.proposal.goal}</p>
                {attempt.proposal.rationale && <p className="mt-2 text-sm text-zinc-600">Rationale: {attempt.proposal.rationale}</p>}
              </>
            ) : (
              <p className="text-sm text-zinc-500">No goal proposed yet.</p>
            )}
          </Card>
          <Card title="Returned result">
            <pre className="overflow-x-auto rounded bg-zinc-50 p-3 text-xs">{attempt.result === undefined ? "—" : JSON.stringify(attempt.result, null, 2)}</pre>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Attempt scorecard">
            {s ? (
              <div className="space-y-3">
                <ScoreBar label="Navigation" value={s.navigation} />
                <ScoreBar label="Decision" value={s.decision} />
                <ScoreBar label="Recovery" value={s.recovery} note={s.recovery === null ? "No errors observed — not applicable" : undefined} />
                <ScoreBar label="Security" value={s.security} note={s.security === null ? "No security checks in this task" : undefined} />
                <ScoreBar label="Grounding (anti-hallucination)" value={s.hallucination} />
                <p className="text-xs text-zinc-500">Per-attempt components feed the agent-level WEB AGENT IQ (adaptability and trust are computed across attempts).</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">{terminal ? "Not scored." : "Scores appear when the attempt finishes."}</p>
            )}
          </Card>
          <Card title="Metrics">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Steps" value={m ? `${m.steps} / ${m.baselineSteps} base` : attempt.usage.steps} />
              <Stat label="Duration" value={fmtMs(m?.durationMs ?? attempt.timings.totalMs)} />
              <Stat label="Agent latency" value={fmtMs(attempt.timings.agentMs)} />
              <Stat label="Browser time" value={fmtMs(attempt.timings.engineMs)} />
              <Stat label="Cost" value={fmtUsd(attempt.usage.costUsd)} hint={`Source: ${attempt.usage.costSource}`} />
              <Stat label="Cost source" value={attempt.usage.costSource} />
              {m && <Stat label="Errors / recovered" value={`${m.errorsObserved} / ${m.recovered ? "yes" : "no"}`} />}
              {m && <Stat label="Loops · off-scope" value={`${m.loopCount} · ${m.outOfScopeNavigations}`} />}
            </div>
          </Card>
          <Card title="Validator checks">
            {attempt.checks.length === 0 ? (
              <p className="text-sm text-zinc-500">No checks yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {attempt.checks.map((c) => (
                  <li key={c.validatorId} className="rounded border border-zinc-100 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.description}</span>
                      <CheckBadge status={c.status} />
                    </div>
                    <div className="mt-1 flex gap-2 text-xs text-zinc-500">
                      <span>{c.category}</span>
                      {c.critical && <span className="text-red-700">critical</span>}
                      <span>weight {c.weight}</span>
                    </div>
                    {c.detail && <p className="mt-1 text-xs text-zinc-600">{c.detail}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Run details">
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between"><dt className="text-zinc-500">Created</dt><dd>{fmtDate(attempt.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Finished</dt><dd>{fmtDate(attempt.finishedAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Engine run</dt><dd className="font-mono">{attempt.engineRunId ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Score version</dt><dd>{attempt.scoreVersion}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function AttemptPage({ params }: PageProps<"/attempts/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <AttemptDetail params={params} />
    </Suspense>
  );
}
