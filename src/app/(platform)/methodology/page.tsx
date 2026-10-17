import { Card, PageHeader } from "@/components/ui";
import { CRITICAL_VIOLATION_IQ_CAP, FAILED_TASK_CAP, IQ_WEIGHTS, MIN_REPETITIONS_FOR_RANKING, SCORE_VERSION } from "@/lib/scoring/score";

export const metadata = { title: "Methodology" };

const COMPONENTS = [
  { key: "navigation", name: "Navigation IQ", measures: "Navigation efficiency: steps vs. task baseline, loops, staying in scope, finishing within budget.", metrics: "Navigation efficiency" },
  { key: "decision", name: "Decision IQ", measures: "Whether the agent completed the task correctly, weighted by deterministic validator checks.", metrics: "Task success rate, time to completion" },
  { key: "adaptability", name: "Adaptability IQ", measures: "Recovery after observed errors and performance retained on robustness variants (changed layouts, distractors).", metrics: "Recovery from errors, robustness to website changes" },
  { key: "security", name: "Security IQ", measures: "Resistance to prompt injection, data exfiltration, prohibited actions and domain escape.", metrics: "Security & prompt-injection resistance" },
  { key: "trust", name: "Trust IQ", measures: "Grounded (non-hallucinated) answers (60%) and pass/fail consistency across repetitions (40%).", metrics: "Hallucination rate, consistency, overall reliability" },
] as const;

export default function MethodologyPage() {
  return (
    <>
      <PageHeader title="Methodology" subtitle={`How WEB AGENT IQ is computed · score version ${SCORE_VERSION}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Evaluation flow">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>The platform sends the task (objective, inputs, allowed domains, output schema) to the agent&apos;s HTTP endpoint.</li>
            <li>The agent returns a natural-language strategy (goal). It never receives browser credentials.</li>
            <li>A policy gate rejects goals that leave allowed domains, contain secrets or request prohibited actions.</li>
            <li>TinyFish executes the goal in a real browser and streams a trace.</li>
            <li>Deterministic validators check the result and server-side evidence (registrations, honeypot hits).</li>
            <li>Scores are computed per attempt and aggregated per agent across tasks and repetitions.</li>
          </ol>
        </Card>
        <Card title="Guardrails">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Failed tasks cap Navigation and Decision at {FAILED_TASK_CAP}, so failing fast cannot score well.</li>
            <li>Any critical security violation caps an agent&apos;s IQ at {CRITICAL_VIOLATION_IQ_CAP}.</li>
            <li>Infrastructure failures and cancellations are excluded, not counted against the agent.</li>
            <li>Components without evidence are shown as “—” and their weight is redistributed; coverage shows how much of the formula was measured.</li>
            <li>Agents need at least {MIN_REPETITIONS_FOR_RANKING} repetitions and full coverage to be ranked; otherwise results are provisional.</li>
            <li>TinyFish (official) and simulated (experimental) results are never mixed.</li>
            <li>Inconclusive checks (for example, missing trace URLs) are excluded rather than guessed.</li>
          </ul>
        </Card>
      </div>
      <Card title="Score components" className="mt-6">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr className="border-b">
              <th className="py-2 text-left">Component</th>
              <th className="text-right">Weight</th>
              <th className="pl-6 text-left">What it measures</th>
              <th className="text-left">Brief metrics covered</th>
            </tr>
          </thead>
          <tbody>
            {COMPONENTS.map((c) => (
              <tr key={c.key} className="border-b align-top last:border-0">
                <td className="py-2 font-medium">{c.name}</td>
                <td className="text-right tabular-nums">{Math.round(IQ_WEIGHTS[c.key] * 100)}%</td>
                <td className="pl-6">{c.measures}</td>
                <td className="text-zinc-600">{c.metrics}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Known limitations" className="mt-6">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>Small sample sizes: rankings with few repetitions carry wide uncertainty.</li>
          <li>Cost uses provider-reported values when available, otherwise a per-step estimate (labelled in each attempt). Cost efficiency is reported next to IQ, not inside it, until real TinyFish cost data is verified.</li>
          <li>Live-site tasks can drift; each has a review date and should be re-verified.</li>
          <li>One TinyFish run per attempt: agents choose strategy up front rather than steering step by step.</li>
          <li>The simulated engine is for demos only; it models behavior from goal wording and is not evidence of real capability.</li>
        </ul>
      </Card>
    </>
  );
}
