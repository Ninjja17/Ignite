import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EngineTabs, resolveEngine } from "@/components/engine-tabs";
import { Badge, Card, Empty, Loading, PageHeader, ScoreBar, StatusBadge, fmtDate, fmtPct, fmtScore } from "@/components/ui";
import { getAgent } from "@/lib/catalog/agents";
import { getTask } from "@/lib/catalog/tasks";
import { aggregateFor, comparableAttempts, defaultEngine, failureTaxonomy, taskBreakdown } from "@/lib/reporting/reports";

async function AgentReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) notFound();
  const engine = await resolveEngine(searchParams, defaultEngine);
  const attempts = await comparableAttempts(engine, id);
  const agg = aggregateFor(attempts);
  const recent = [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 15);

  return (
    <>
      <PageHeader
        title={agent.name}
        subtitle={`${agent.organization} · v${agent.version} · ${agent.description}`}
        actions={<EngineTabs engine={engine} basePath={`/agents/${id}`} />}
      />
      {attempts.length === 0 ? (
        <Empty>No attempts on this engine yet.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-6">
            <Card title="Benchmark report">
              <div className="text-xs uppercase text-zinc-500">Web Agent IQ</div>
              <div className="text-5xl font-bold tabular-nums">{fmtScore(agg.iq)}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge tone={agg.coverage >= 0.99 ? "good" : "warn"}>coverage {fmtPct(agg.coverage)}</Badge>
                {agg.provisional && <Badge tone="warn">provisional</Badge>}
              </div>
              {agg.provisionalReasons.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-xs text-amber-800">
                  {agg.provisionalReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <div className="mt-4 space-y-3">
                {(Object.entries(agg.components) as [string, { value: number | null; note: string; evidence: number }][]).map(([key, c]) => (
                  <ScoreBar key={key} label={`${key[0].toUpperCase()}${key.slice(1)} IQ`} value={c.value} note={`${c.note} (evidence: ${c.evidence})`} />
                ))}
              </div>
            </Card>
            <Card title="Failure modes">
              <ul className="space-y-1 text-sm">
                {failureTaxonomy(attempts).map((f) => (
                  <li key={f.label} className="flex justify-between">
                    <span>{f.label}</span>
                    <span className="font-mono">{f.count}</span>
                  </li>
                ))}
                {failureTaxonomy(attempts).length === 0 && <li className="text-zinc-500">None recorded.</li>}
              </ul>
            </Card>
          </div>
          <div className="space-y-6">
            <Card title="Per-task results">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr className="border-b">
                    <th className="py-2 text-left">Task</th>
                    <th className="text-right">Passed</th>
                    <th className="text-right">Mean decision</th>
                    <th className="text-right">Median steps</th>
                  </tr>
                </thead>
                <tbody>
                  {taskBreakdown(attempts).map((t) => (
                    <tr key={t.taskVersionId} className="border-b last:border-0">
                      <td className="py-2">{t.title}</td>
                      <td className="text-right tabular-nums">
                        {t.passed}/{t.attempts}
                      </td>
                      <td className="text-right tabular-nums">{fmtScore(t.meanDecision)}</td>
                      <td className="text-right tabular-nums">{t.medianSteps ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Recent attempts">
              <ul className="divide-y text-sm">
                {recent.map((a) => (
                  <li key={a.id}>
                    <Link href={`/attempts/${a.id}`} className="flex items-center gap-3 py-2 hover:bg-zinc-50">
                      <StatusBadge status={a.status} />
                      <span className="flex-1">{getTask(a.taskVersionId)?.title ?? a.taskVersionId}</span>
                      {a.metrics && <Badge tone={a.metrics.taskPassed ? "good" : "bad"}>{a.metrics.taskPassed ? "pass" : "fail"}</Badge>}
                      <span className="text-xs text-zinc-500">{fmtDate(a.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

export default function AgentPage({ params, searchParams }: PageProps<"/agents/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <AgentReport params={params} searchParams={searchParams} />
    </Suspense>
  );
}
