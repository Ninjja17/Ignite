import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, ButtonLink, Card, Empty, Loading, PageHeader, fmtDate } from "@/components/ui";
import { store } from "@/lib/store/store";

export const metadata = { title: "Benchmarks" };

async function BenchmarkList() {
  await connection();
  const [benchmarks, attempts] = await Promise.all([store.listBenchmarks(), store.listAttempts()]);
  if (benchmarks.length === 0) return <Empty>No benchmarks yet.</Empty>;
  return (
    <Card>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-zinc-500">
          <tr className="border-b">
            <th className="py-2">Name</th>
            <th>Engine</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {benchmarks.map((b) => {
            const mine = attempts.filter((a) => a.benchmarkId === b.id);
            const done = mine.filter((a) => a.finishedAt).length;
            return (
              <tr key={b.id} className="border-b last:border-0">
                <td className="py-2">
                  <Link className="font-medium hover:underline" href={`/benchmarks/${b.id}`}>
                    {b.name}
                  </Link>
                </td>
                <td>
                  <Badge tone={b.resultClass === "official" ? "info" : "neutral"}>
                    {b.engine} · {b.resultClass}
                  </Badge>
                </td>
                <td>
                  <Badge tone={b.status === "running" ? "info" : b.status === "completed" ? "good" : "neutral"}>{b.status}</Badge>
                </td>
                <td className="tabular-nums">
                  {done}/{mine.length}
                </td>
                <td className="text-zinc-500">{fmtDate(b.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export default function BenchmarksPage() {
  return (
    <>
      <PageHeader title="Benchmarks" subtitle="Each benchmark runs selected agents on selected tasks, with repetitions for consistency." actions={<ButtonLink href="/benchmarks/new" primary>Run benchmark</ButtonLink>} />
      <Suspense fallback={<Loading />}>
        <BenchmarkList />
      </Suspense>
    </>
  );
}
