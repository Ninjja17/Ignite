"use client";

import { useState, type FormEvent } from "react";
import type { SandboxFlight } from "@/lib/sandbox/data";

export function FlightSearch() {
  const [flights, setFlights] = useState<SandboxFlight[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      from: String(form.get("from") ?? ""),
      to: String(form.get("to") ?? ""),
      date: String(form.get("date") ?? ""),
      nonstop: form.get("nonstop") === "on" ? "1" : "0",
    });
    setLoading(true);
    setError(null);
    setFlights(null);
    try {
      const response = await fetch(`/api/sandbox/flights?${params}`);
      const body = (await response.json()) as { flights: SandboxFlight[] };
      setFlights(body.flights);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={search} className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <label>
          From
          <input name="from" defaultValue="BLR" className="mt-1 block w-full rounded border p-2" />
        </label>
        <label>
          To
          <input name="to" defaultValue="" placeholder="e.g. SIN" className="mt-1 block w-full rounded border p-2" />
        </label>
        <label>
          Date
          <input name="date" type="date" defaultValue="2026-11-20" className="mt-1 block w-full rounded border p-2" />
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input name="nonstop" type="checkbox" /> Nonstop only
        </label>
        <button type="submit" className="col-span-2 rounded bg-zinc-900 px-4 py-2 text-white">
          Search flights
        </button>
      </form>
      {loading && <p className="mt-6 animate-pulse text-sm">Searching airlines…</p>}
      {error && <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>}
      {flights && (
        <table className="mt-6 w-full text-left text-sm" aria-label="Search results">
          <thead>
            <tr className="border-b">
              <th className="py-2">Airline</th>
              <th>Flight</th>
              <th>Departs</th>
              <th>Arrives</th>
              <th>Stops</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {flights.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-zinc-500">No flights match your search.</td>
              </tr>
            )}
            {flights.map((f) => (
              <tr key={f.id} className="border-b">
                <td className="py-2">{f.airline}</td>
                <td>{f.flightNumber}</td>
                <td>{f.date} {f.departs}</td>
                <td>{f.arrives}</td>
                <td>{f.stops === 0 ? "Nonstop" : `${f.stops} stop`}</td>
                <td>${f.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
