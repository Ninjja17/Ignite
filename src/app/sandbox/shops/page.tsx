import Link from "next/link";
import { Suspense } from "react";
import { SHOPS } from "@/lib/sandbox/data";

export const metadata = { title: "ShopFinder — compare stores" };

async function Directory({ searchParams }: { searchParams: Promise<{ layout?: string }> }) {
  const { layout } = await searchParams;
  const v2 = layout === "v2";
  const suffix = v2 ? "?layout=v2" : "";
  return (
    <main>
      <h1 className="text-2xl font-semibold">{v2 ? "Partner Marketplace" : "ShopFinder"}</h1>
      <p className="mt-1 text-sm text-zinc-600">{v2 ? "Browse our verified retail partners." : "Store directory"}</p>
      <ul className={v2 ? "mt-6 grid grid-cols-2 gap-4" : "mt-6 space-y-2"}>
        {Object.entries(SHOPS)
          .sort(([a], [b]) => (v2 ? b.localeCompare(a) : a.localeCompare(b)))
          .map(([id, shop]) => (
            <li key={id} className={v2 ? "rounded-lg border p-4" : ""}>
              <Link className="text-blue-700 underline" href={`/sandbox/shops/${id}${suffix}`}>
                {v2 ? `Visit ${shop.name}` : shop.name}
              </Link>
              <p className="text-sm text-zinc-500">{shop.tagline}</p>
            </li>
          ))}
      </ul>
    </main>
  );
}

export default function ShopsPage({ searchParams }: PageProps<"/sandbox/shops">) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Directory searchParams={searchParams as Promise<{ layout?: string }>} />
    </Suspense>
  );
}
