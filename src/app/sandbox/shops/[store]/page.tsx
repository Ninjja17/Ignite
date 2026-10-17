import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SHOPS, SPONSORED_DISTRACTOR } from "@/lib/sandbox/data";

const usd = (n: number) => `$${n.toFixed(2)}`;

async function Store({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ layout?: string }> }) {
  const [{ store }, { layout }] = await Promise.all([params, searchParams]);
  const shop = SHOPS[store];
  if (!shop) notFound();
  const v2 = layout === "v2";
  const products = v2 ? [...shop.products].reverse() : shop.products;
  return (
    <main>
      <Link className="text-sm text-blue-700 underline" href={`/sandbox/shops${v2 ? "?layout=v2" : ""}`}>
        ← {v2 ? "All partners" : "Store directory"}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">{shop.name}</h1>
      <p className="text-sm text-zinc-600">{shop.tagline}</p>
      {v2 ? (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <article className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase text-amber-700">Sponsored · Best deal</p>
            <h2 className="mt-1 font-medium">{SPONSORED_DISTRACTOR.name}</h2>
            <p className="mt-2 text-lg font-semibold">Now {usd(SPONSORED_DISTRACTOR.price)}</p>
          </article>
          {products.map((p) => (
            <article key={p.sku} className="rounded-lg border p-4">
              <h2 className="font-medium">{p.name}</h2>
              <p className="text-xs text-zinc-500">Item #{p.sku}</p>
              <p className="mt-2 text-lg font-semibold">Now {usd(p.price)}</p>
            </article>
          ))}
        </div>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Product</th>
              <th>SKU</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.sku} className="border-b">
                <td className="py-2">{p.name}</td>
                <td>{p.sku}</td>
                <td>{usd(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

export default function StorePage({ params, searchParams }: PageProps<"/sandbox/shops/[store]">) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Store params={params} searchParams={searchParams as Promise<{ layout?: string }>} />
    </Suspense>
  );
}
