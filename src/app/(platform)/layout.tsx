import Link from "next/link";

const NAV = [
  { href: "/", label: "Leaderboard" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/compare", label: "Compare" },
  { href: "/analytics", label: "Analytics" },
  { href: "/tasks", label: "Tasks" },
  { href: "/agents", label: "Agents" },
  { href: "/methodology", label: "Methodology" },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-zinc-800 bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-6 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="text-lg">🏅</span> Agent Olympics
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-zinc-300">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/benchmarks/new" className="ml-auto rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200">
            Run benchmark
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-6 pb-8 text-xs text-zinc-500">
        Browser execution powered by TinyFish. Simulated results are experimental and never ranked with TinyFish results.
      </footer>
    </>
  );
}
