import Link from "next/link";
import { Suspense } from "react";
import { EngineTabs, resolveEngine } from "@/components/engine-tabs";
import { Card, Empty, Loading, PageHeader, fmtMs, fmtPct, fmtScore, fmtUsd } from "@/components/ui";
import { AGENTS, getAgent } from "@/lib/catalog/agents";
import { aggregateFor, comparableAttempts, defaultEngine, taskBreakdown } from "@/lib/reporting/reports";
import type { AgentAggregate, IqComponent } from "@/lib/scoring/score";

export const metadata = { title: "Compare agents" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const ROWS: { label: string; get: (a: AgentAggregate) => number | null; fmt: (v: number | null) => string; higherIsBetter: boolean }[] = [
  { label: "WEB AGENT IQ", get: (a) => a.iq, fmt: fmtScore, higherIsBetter: true },
  ...(["navigation", "decision", "adaptability", "security", "trust"] as IqComponent[]).map((key) => ({
    label: `${key[0].toUpperCase()}${key.slice(1)} IQ`,
    get: (a: AgentAggregate) => a.components[key].value,
    fmt: fmtScore,
    higherIsBetter: true,
  })),
  { label: "Success rate", get: (a) => a.successRate, fmt: fmtPct, higherIsBetter: true },
  { label: "Hallucination rate", get: (a) => a.hallucinationRate, fmt: fmtPct, higherIsBetter: false },
  { label: "Critical violations", get: (a) => a.criticalViolations, fmt: (v) => (v === null ? "—" : String(v)), higherIsBetter: false },
  { label: "Median time", get: (a) => a.medianDurationMs, fmt: fmtMs, higherIsBetter: false },
  { label: "Total cost", get: (a) => a.totalCostUsd, fmt: fmtUsd, higherIsBetter: false },
  { label: "Consistency σ (decision)", get: (a) => a.decisionStdDev, fmt: fmtScore, higherIsBetter: false },
];

async function Comparison({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const engine = await resolveEngine(searchParams, defaultEngine);
  const a = typeof sp.a === "string" && getAgent(sp.a) ? sp.a : AGENTS[0].id;
  const b = typeof sp.b === "string" && getAgent(sp.b) ? sp.b : AGENTS[1].id;
  const attempts = await comparableAttempts(engine);
  const left = attempts.filter((x) => x.agentId === a);
  const right = attempts.filter((x) => x.agentId === b);
  const aggA = aggregateFor(left);
  const aggB = aggregateFor(right);
  const tasksA = taskBreakdown(left);
  const tasksB = taskBreakdown(right);
  const taskIds = [...new Set([...tasksA, ...tasksB].map((t) => t.taskVersionId))];

  return (
    <>
      <form className="mb-6 flex flex-wrap items-end gap-3 text-sm">
        <input type="hidden" name="engine" value={engine} />
        {(["a", "b"] as const).map((side) => (
          <label key={side}>
            Agent {side.toUpperCase()}
            <select name={side} defaultValue={side === "a" ? a : b} className="mt-1 block rounded border bg-white p-2">
              {AGENTS.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button className="rounded-lg bg-zinc-900 px-3 py-2 text-white">Compare</button>
        <span className="ml-auto">
          <EngineTabs engine={engine} basePath="/compare" extra={{ a, b }} />
        </span>
      </form>

      {left.length + right.length === 0 ? (
        <Empty>No comparable attempts for these agents on this engine yet.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Head to head">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr className="border-b">
                  <th className="py-2 text-left">Metric</th>
                  <th className="text-right">{getAgent(a)!.name}</th>
                  <th className="text-right">{getAgent(b)!.name}</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const va = row.get(aggA);
                  const vb = row.get(aggB);
                  const winner = va === null || vb === null || va === vb ? null : (va > vb) === row.higherIsBetter ? "a" : "b";
                  return (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="py-2">{row.label}</td>
                      <td className={`text-right tabular-nums ${winner === "a" ? "font-semibold text-emerald-700" : ""}`}>{row.fmt(va)}</td>
                      <td className={`text-right tabular-nums ${winner === "b" ? "font-semibold text-emerald-700" : ""}`}>{row.fmt(vb)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-zinc-500">
              Attempts: {aggA.attempts} vs {aggB.attempts}. Differences on small samples may not be significant.
            </p>
          </Card>
          <Card title="Per-task success">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr className="border-b">
                  <th className="py-2 text-left">Task</th>
                  <th className="text-right">{getAgent(a)!.name}</th>
                  <th className="text-right">{getAgent(b)!.name}</th>
                </tr>
              </thead>
              <tbody>
                {taskIds.map((taskId) => {
                  const ta = tasksA.find((t) => t.taskVersionId === taskId);
                  const tb = tasksB.find((t) => t.taskVersionId === taskId);
                  return (
                    <tr key={taskId} className="border-b last:border-0">
                      <td className="py-2">{(ta ?? tb)!.title}</td>
                      <td className="text-right tabular-nums">{ta ? `${ta.passed}/${ta.attempts}` : "—"}</td>
                      <td className="text-right tabular-nums">{tb ? `${tb.passed}/${tb.attempts}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-zinc-500">
              Drill into individual runs from the <Link className="underline" href="/benchmarks">benchmarks</Link> page.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <>
      <PageHeader title="Agent comparison" subtitle="Side-by-side WEB AGENT IQ components and per-task outcomes on the same engine and score version." />
      <Suspense fallback={<Loading />}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </>
  );
}
