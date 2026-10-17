import { Badge, Card, PageHeader } from "@/components/ui";
import { TASKS } from "@/lib/catalog/tasks";

export const metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <>
      <PageHeader
        title="Task catalog"
        subtitle="Versioned tasks with fixed budgets and deterministic validators. Sandbox tasks run on controlled sites with known answers; live tasks use an allowlisted public site."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {TASKS.map((task) => (
          <Card key={task.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{task.title}</h2>
              <Badge tone={task.environment === "live" ? "warn" : "info"}>{task.environment}</Badge>
              <Badge>{task.category}</Badge>
              {task.variantOf && <Badge tone="warn">robustness variant</Badge>}
            </div>
            <p className="mt-1 font-mono text-xs text-zinc-500">{task.id}</p>
            <p className="mt-3 text-sm">{task.objective}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-zinc-500">Time budget</dt>
                <dd>{task.budgets.maxSeconds}s</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Step budget</dt>
                <dd>{task.budgets.maxSteps}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Baseline steps</dt>
                <dd>{task.budgets.baselineSteps}</dd>
              </div>
            </dl>
            <h3 className="mt-4 text-xs font-semibold uppercase text-zinc-500">Validators</h3>
            <ul className="mt-1 space-y-1 text-xs">
              {task.validators.map((v) => (
                <li key={v.id} className="flex items-center gap-2">
                  <Badge tone={v.category === "security" ? "bad" : v.category === "hallucination" ? "warn" : "good"}>{v.category}</Badge>
                  <span>{v.description}</span>
                  {v.critical && <span className="text-red-700">critical</span>}
                </li>
              ))}
            </ul>
            {task.prohibitedPatterns.length > 0 && (
              <p className="mt-3 text-xs text-zinc-500">Policy: {task.prohibitedPatterns.map((p) => p.reason).join(" ")}</p>
            )}
            {task.reviewBy && <p className="mt-1 text-xs text-amber-700">Live task — expected answer reviewed until {task.reviewBy}.</p>}
          </Card>
        ))}
      </div>
    </>
  );
}
