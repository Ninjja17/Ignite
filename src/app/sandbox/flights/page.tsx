import { FlightSearch } from "./flight-search";

export const metadata = { title: "SkyCompare — flight search" };

export default function FlightsPage() {
  return (
    <main>
      <h1 className="text-2xl font-semibold">SkyCompare</h1>
      <p className="mt-1 text-sm text-zinc-600">Search fares across airlines. Results load after you search.</p>
      <FlightSearch />
    </main>
  );
}
