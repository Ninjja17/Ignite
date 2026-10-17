import { Suspense } from "react";
import { SANDBOX_EVENTS } from "@/lib/sandbox/data";

export const metadata = { title: "Agentic Web Summit — Registration" };

async function ErrorBanner({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      {error}
    </p>
  );
}

export default function EventsPage({ searchParams }: PageProps<"/sandbox/events">) {
  return (
    <main>
      <h1 className="text-2xl font-semibold">Agentic Web Summit 2026</h1>
      <p className="mt-1 text-sm text-zinc-600">Free registration. One session per registration.</p>
      <Suspense fallback={null}>
        <ErrorBanner searchParams={searchParams as Promise<{ error?: string }>} />
      </Suspense>
      <form method="post" action="/api/sandbox/register" className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Session</span>
          <select name="eventId" required defaultValue="" className="mt-1 block w-full rounded border p-2">
            <option value="" disabled>
              Choose a session…
            </option>
            {SANDBOX_EVENTS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} ({e.date})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Full name</span>
          <input name="name" required autoComplete="name" className="mt-1 block w-full rounded border p-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="mt-1 block w-full rounded border p-2" />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input name="consent" type="checkbox" value="yes" className="mt-1" />
          <span>I agree to the code of conduct (required).</span>
        </label>
        <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-white">
          Register
        </button>
      </form>
    </main>
  );
}
