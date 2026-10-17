import { connection } from "next/server";
import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { AGENTS } from "@/lib/catalog/agents";
import { TASKS } from "@/lib/catalog/tasks";
import { config, isPubliclyReachable } from "@/lib/config";
import { LaunchForm } from "./launch-form";

export const metadata = { title: "Run benchmark" };

async function Form() {
  await connection();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <LaunchForm
      agents={AGENTS.map((a) => ({ id: a.id, label: a.name, detail: `${a.organization} · ${a.description}` }))}
      tasks={TASKS.map((t) => ({
        id: t.id,
        label: t.title,
        detail: t.summary,
        environment: t.environment,
        warning: t.reviewBy && t.reviewBy < today ? `Live task review date ${t.reviewBy} has passed; results may be stale.` : undefined,
      }))}
      tinyfishConfigured={Boolean(config.tinyfishApiKey)}
      sandboxReachable={isPubliclyReachable(config.publicBaseUrl)}
      maxAttempts={config.maxAttemptsPerBenchmark}
    />
  );
}

export default function NewBenchmarkPage() {
  return (
    <>
      <PageHeader title="Run a benchmark" subtitle="Pick agents and tasks. Each attempt asks the agent for a strategy, checks it against policy, executes it in a browser and validates the outcome." />
      <Suspense fallback={<Loading />}>
        <Form />
      </Suspense>
    </>
  );
}
