import { Suspense } from "react";
import { EngineTabs, resolveEngine } from "@/components/engine-tabs";
import { Card, Empty, Loading, PageHeader, Stat, fmtMs, fmtPct, fmtScore, fmtUsd } from "@/components/ui";
import { AGENTS } from "@/lib/catalog/agents";
import { comparableAttempts, defaultEngine, failureTaxonomy, taskBreakdown } from "@/lib/reporting/reports";
import { isScored } from "@/lib/scoring/score";

export const metadata = { title: "Analytics" };

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 flex-1 rounded-full bg-zinc-100">
      <div className="h-2 rounded-full" style={{ width: `${max ? (100 * value) / max : 0}%`, background: color }} />
    </div>
  );
}

async function Analytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const engine = await resolveEngine(searchParams, defaultEngine);
  const attempts = await comparableAttempts(engine);
  const scored = attempts.filter((a) => a.metrics && isScored(a.status));
  const passed = scored.filter((a) => a.metrics!.taskPassed).length;
  const totalCost = scored.reduce((s, a) => s + (a.usage.costUsd ?? 0), 0);
  const durations = scored.map((a) => a.metrics!.durationMs).sort((x, y) => x - y);
  const p50 = durations.length ? durations[Math.floor(durations.length * 0.5)] : null;
  const p90 = durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.9))] : null;
  const tasks = taskBreakdown(attempts);
  const failures = failureTaxonomy(attempts);
  const maxFailures = Math.max(1, ...failures.map((f) => f.count));
  const securityChecks = scored.flatMap((a) => a.checks.filter((c) => c.category === "security" && c.status !== "inconclusive"));

  return (
    <>
      <div className="mb-6">
        <EngineTabs engine={engine} basePath="/analytics" />
      </div>
      {attempts.length === 0 ? (
        <Empty>No attempts on this engine yet.</Empty>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-6">
              <Stat label="Attempts" value={attempts.length} />
              <Stat label="Scored" value={scored.length} hint="Infra failures and cancellations are excluded" />
              <Stat label="Success rate" value={fmtPct(scored.length ? passed / scored.length : null)} />
              <Stat label="Duration p50 / p90" value={`${fmtMs(p50)} / ${fmtMs(p90)}`} />
              <Stat label="Security checks passed" value={fmtPct(securityChecks.length ? securityChecks.filter((c) => c.status === "pass").length / securityChecks.length : null)} />
              <Stat label="Total cost" value={fmtUsd(totalCost)} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Task difficulty">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr className="border-b">
                    <th className="py-2 text-left">Task</th>
                    <th className="text-right">Pass</th>
                    <th className="text-right">Mean decision</th>
                    <th className="text-right">Median steps</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.taskVersionId} className="border-b last:border-0">
                      <td className="py-2">{t.title}</td>
                      <td className="text-right tabular-nums">{fmtPct(t.passed / t.attempts)}</td>
                      <td className="text-right tabular-nums">{fmtScore(t.meanDecision)}</td>
                      <td className="text-right tabular-nums">{t.medianSteps ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Failure taxonomy">
              {failures.length === 0 ? (
                <p className="text-sm text-zinc-500">No failures recorded.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {failures.map((f) => (
                    <li key={f.label} className="flex items-center gap-3">
                      <span className="w-64 shrink-0">{f.label}</span>
                      <Bar value={f.count} max={maxFailures} color="#ef4444" />
                      <span className="w-8 text-right font-mono">{f.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Agent × task success matrix">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr className="border-b">
                    <th className="py-2 text-left">Agent</th>
                    {tasks.map((t) => (
                      <th key={t.taskVersionId} className="px-2 text-center">
                        {t.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AGENTS.map((agent) => {
                    const rows = taskBreakdown(attempts.filter((a) => a.agentId === agent.id));
                    return (
                      <tr key={agent.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{agent.name}</td>
                        {tasks.map((t) => {
                          const r = rows.find((x) => x.taskVersionId === t.taskVersionId);
                          const rate = r ? r.passed / r.attempts : null;
                          const bg = rate === null ? "#f4f4f5" : `hsl(${Math.round(rate * 130)} 70% 88%)`;
                          return (
                            <td key={t.taskVersionId} className="px-2 py-1 text-center">
                              <span className="block rounded px-2 py-1 tabular-nums" style={{ background: bg }}>
                                {r ? `${r.passed}/${r.attempts}` : "—"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <>
      <PageHeader title="Performance analytics" subtitle="Where agents succeed, where they fail, and what it costs." />
      <Suspense fallback={<Loading />}>
        <Analytics searchParams={searchParams} />
      </Suspense>
    </>
  );
}
