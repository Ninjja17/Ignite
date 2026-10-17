import Link from "next/link";
import { Suspense } from "react";
import { EngineTabs, resolveEngine } from "@/components/engine-tabs";
import { Badge, ButtonLink, Card, Empty, Loading, PageHeader, ScoreBar, fmtMs, fmtPct, fmtScore, fmtUsd } from "@/components/ui";
import { defaultEngine, getLeaderboard } from "@/lib/reporting/reports";
import { IQ_WEIGHTS, SCORE_VERSION, type IqComponent } from "@/lib/scoring/score";

const COMPONENT_LABELS: Record<IqComponent, string> = {
  navigation: "Navigation IQ",
  decision: "Decision IQ",
  adaptability: "Adaptability IQ",
  security: "Security IQ",
  trust: "Trust IQ",
};

async function Leaderboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const engine = await resolveEngine(searchParams, defaultEngine);
  const rows = await getLeaderboard(engine);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <EngineTabs engine={engine} basePath="/" />
        <span className="text-xs text-zinc-500">Score version {SCORE_VERSION}</span>
      </div>
      {rows.length === 0 ? (
        <Empty>
          No scored {engine === "tinyfish" ? "TinyFish" : "simulated"} attempts yet.{" "}
          <Link className="underline" href="/benchmarks/new">
            Run a benchmark
          </Link>{" "}
          to populate the leaderboard.
        </Empty>
      ) : (
        <div className="space-y-4">
          {rows.map(({ rank, agent, aggregate }) => (
            <Card key={agent.id}>
              <div className="grid gap-6 md:grid-cols-[220px_1fr_260px]">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-2xl font-bold text-zinc-400">{rank ? `#${rank}` : "–"}</span>
                    <span className="h-3 w-3 rounded-full" style={{ background: agent.color }} />
                    <Link href={`/agents/${agent.id}?engine=${engine}`} className="font-semibold hover:underline">
                      {agent.name}
                    </Link>
                  </div>
                  <p className="ml-11 text-xs text-zinc-500">
                    {agent.organization} · v{agent.version}
                  </p>
                  <div className="ml-11 mt-3">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Web Agent IQ</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold tabular-nums">{fmtScore(aggregate.iq)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={aggregate.coverage >= 0.99 ? "good" : "warn"} title="Share of the IQ formula backed by evidence">
                        coverage {fmtPct(aggregate.coverage)}
                      </Badge>
                      {aggregate.provisional && (
                        <Badge tone="warn" title={aggregate.provisionalReasons.join("\n")}>
                          provisional
                        </Badge>
                      )}
                      {aggregate.criticalViolations > 0 && <Badge tone="bad">{aggregate.criticalViolations} critical</Badge>}
                    </div>
                  </div>
                </div>
                <div className="grid content-center gap-3 sm:grid-cols-2">
                  {(Object.keys(COMPONENT_LABELS) as IqComponent[]).map((key) => (
                    <ScoreBar
                      key={key}
                      label={`${COMPONENT_LABELS[key]} · ${Math.round(IQ_WEIGHTS[key] * 100)}%`}
                      value={aggregate.components[key].value}
                      note={`${aggregate.components[key].note} (evidence: ${aggregate.components[key].evidence})`}
                    />
                  ))}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-zinc-500">Success rate</dt>
                    <dd className="font-semibold">{fmtPct(aggregate.successRate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Attempts</dt>
                    <dd className="font-semibold">
                      {aggregate.attempts}
                      {aggregate.excludedAttempts > 0 && <span className="text-xs text-zinc-500"> (+{aggregate.excludedAttempts} excl.)</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Median time</dt>
                    <dd className="font-semibold">{fmtMs(aggregate.medianDurationMs)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Total cost</dt>
                    <dd className="font-semibold" title={`Cost known for ${fmtPct(aggregate.costCoverage)} of attempts`}>
                      {fmtUsd(aggregate.totalCostUsd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Hallucination rate</dt>
                    <dd className="font-semibold">{fmtPct(aggregate.hallucinationRate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Consistency σ</dt>
                    <dd className="font-semibold">{fmtScore(aggregate.decisionStdDev)}</dd>
                  </div>
                </dl>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader
        title="WEB AGENT IQ Leaderboard"
        subtitle="AI web agents ranked on real browser tasks. Agents choose the strategy; TinyFish executes it; deterministic validators judge the outcome."
        actions={
          <>
            <ButtonLink href="/methodology">How scoring works</ButtonLink>
            <ButtonLink href="/benchmarks/new" primary>
              Run benchmark
            </ButtonLink>
          </>
        }
      />
      <Suspense fallback={<Loading />}>
        <Leaderboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}
