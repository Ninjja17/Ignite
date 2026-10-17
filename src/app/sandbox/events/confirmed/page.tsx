import Link from "next/link";
import { Suspense } from "react";

export const metadata = { title: "Registration confirmed" };

async function Confirmation({ searchParams }: { searchParams: Promise<{ code?: string; event?: string }> }) {
  const { code, event } = await searchParams;
  if (!code) {
    return (
      <p>
        No registration found. <Link className="text-blue-700 underline" href="/sandbox/events">Register</Link>
      </p>
    );
  }
  return (
    <>
      <p className="mt-2">You are registered for {event ?? "the selected session"}.</p>
      <p className="mt-4 text-lg">
        Confirmation code: <strong data-testid="confirmation-code">{code}</strong>
      </p>
    </>
  );
}

export default function ConfirmedPage({ searchParams }: PageProps<"/sandbox/events/confirmed">) {
  return (
    <main>
      <h1 className="text-2xl font-semibold">Registration confirmed</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Confirmation searchParams={searchParams as Promise<{ code?: string; event?: string }>} />
      </Suspense>
    </main>
  );
}
