import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CancelButton } from "@/components/cancel-button";
import { LiveRefresh } from "@/components/live-refresh";
import { Badge, Card, Loading, PageHeader, StatusBadge, fmtDate, fmtPct, fmtScore, scoreTone } from "@/components/ui";
import { getAgent } from "@/lib/catalog/agents";
import { getTask } from "@/lib/catalog/tasks";
import { aggregateFor, failureTaxonomy } from "@/lib/reporting/reports";
import { store } from "@/lib/store/store";

async function BenchmarkDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const benchmark = await store.getBenchmark(id);
  if (!benchmark) notFound();
  const attempts = await store.listAttempts({ benchmarkId: id });
  const done = attempts.filter((a) => a.finishedAt).length;
  const running = benchmark.status === "running";

  return (
    <>
      <PageHeader
        title={benchmark.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={benchmark.resultClass === "official" ? "info" : "neutral"}>
              {benchmark.engine} · {benchmark.resultClass}
            </Badge>
            <Badge tone={running ? "info" : "good"}>{benchmark.status}</Badge>
            <span>
              {done}/{attempts.length} attempts finished · started {fmtDate(benchmark.createdAt)} · score {benchmark.scoreVersion}
            </span>
            <LiveRefresh url={`/api/benchmarks/${id}/events`} active={running} />
          </span>
        }
        actions={running ? <CancelButton url={`/api/benchmarks/${id}/cancel`} label="Cancel benchmark" /> : undefined}
      />

      <div className="mb-6 h-2 rounded-full bg-zinc-200">
        <div className="h-2 rounded-full bg-zinc-900 transition-all" style={{ width: `${attempts.length ? (100 * done) / attempts.length : 0}%` }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Attempt matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr className="border-b">
                  <th className="py-2 pr-4">Task</th>
                  {benchmark.agentIds.map((agentId) => (
                    <th key={agentId} className="pr-4">
                      {getAgent(agentId)?.name ?? agentId}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {benchmark.taskVersionIds.map((taskId) => (
                  <tr key={taskId} className="border-b align-top last:border-0">
                    <td className="py-3 pr-4 font-medium">{getTask(taskId)?.title ?? taskId}</td>
                    {benchmark.agentIds.map((agentId) => (
                      <td key={agentId} className="py-3 pr-4">
                        <div className="flex flex-col gap-1">
                          {attempts
                            .filter((a) => a.taskVersionId === taskId && a.agentId === agentId)
                            .sort((a, b) => a.repetition - b.repetition)
                            .map((a) => (
                              <Link key={a.id} href={`/attempts/${a.id}`} className="flex items-center gap-2 rounded px-1 hover:bg-zinc-50">
                                <span className="text-xs text-zinc-400">#{a.repetition}</span>
                                <StatusBadge status={a.status} />
                                {a.metrics && (
                                  <Badge tone={a.metrics.taskPassed ? "good" : "bad"}>{a.metrics.taskPassed ? "pass" : "fail"}</Badge>
                                )}
                                {a.scores && <Badge tone={scoreTone(a.scores.decision)}>D {fmtScore(a.scores.decision)}</Badge>}
                              </Link>
                            ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="This benchmark">
            <ul className="space-y-3 text-sm">
              {benchmark.agentIds.map((agentId) => {
                const agg = aggregateFor(attempts.filter((a) => a.agentId === agentId));
                return (
                  <li key={agentId} className="flex items-center justify-between">
                    <span>{getAgent(agentId)?.name ?? agentId}</span>
                    <span className="text-right">
                      <span className="font-semibold tabular-nums">{fmtScore(agg.iq)}</span>
                      <span className="ml-2 text-xs text-zinc-500">success {fmtPct(agg.successRate)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">IQ within this benchmark only. The leaderboard aggregates all comparable runs.</p>
          </Card>
          <Card title="Failure breakdown">
            {failureTaxonomy(attempts).length === 0 ? (
              <p className="text-sm text-zinc-500">No failures recorded.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {failureTaxonomy(attempts).map((f) => (
                  <li key={f.label} className="flex justify-between">
                    <span>{f.label}</span>
                    <span className="font-mono">{f.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function BenchmarkPage({ params }: PageProps<"/benchmarks/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <BenchmarkDetail params={params} />
    </Suspense>
  );
}
