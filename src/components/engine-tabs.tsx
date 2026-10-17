import Link from "next/link";
import type { EngineKind } from "@/lib/domain/types";

export async function resolveEngine(searchParams: Promise<Record<string, string | string[] | undefined>>, fallback: () => Promise<EngineKind>) {
  const { engine } = await searchParams;
  return engine === "tinyfish" || engine === "simulated" ? engine : fallback();
}

export function EngineTabs({ engine, basePath, extra = {} }: { engine: EngineKind; basePath: string; extra?: Record<string, string> }) {
  const tabs: { id: EngineKind; label: string; hint: string }[] = [
    { id: "tinyfish", label: "TinyFish (official)", hint: "Real browser runs executed by TinyFish" },
    { id: "simulated", label: "Simulated (experimental)", hint: "Offline demo engine; not comparable with TinyFish" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          title={tab.hint}
          href={`${basePath}?${new URLSearchParams({ ...extra, engine: tab.id })}`}
          className={`rounded-md px-3 py-1 ${engine === tab.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
