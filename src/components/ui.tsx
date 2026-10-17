import Link from "next/link";
import type { ReactNode } from "react";
import type { AttemptStatus, CheckStatus } from "@/lib/domain/types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>}
      {children}
    </section>
  );
}

const TONES = {
  neutral: "bg-zinc-100 text-zinc-700",
  good: "bg-emerald-100 text-emerald-800",
  bad: "bg-red-100 text-red-800",
  warn: "bg-amber-100 text-amber-800",
  info: "bg-sky-100 text-sky-800",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<AttemptStatus, Tone> = {
  queued: "neutral",
  agent_deciding: "info",
  policy_check: "info",
  browser_running: "info",
  validating: "info",
  scoring: "info",
  completed: "good",
  agent_failed: "bad",
  policy_blocked: "bad",
  timed_out: "warn",
  infra_failed: "warn",
  cancelled: "neutral",
};

export function StatusBadge({ status }: { status: AttemptStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status.replace(/_/g, " ")}</Badge>;
}

export function CheckBadge({ status }: { status: CheckStatus }) {
  return <Badge tone={status === "pass" ? "good" : status === "fail" ? "bad" : "neutral"}>{status}</Badge>;
}

export function scoreTone(value: number | null | undefined): Tone {
  if (value === null || value === undefined) return "neutral";
  return value >= 75 ? "good" : value >= 50 ? "warn" : "bad";
}

const BAR_COLORS: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  neutral: "bg-zinc-300",
  info: "bg-sky-500",
};

export function ScoreBar({ label, value, note }: { label: string; value: number | null | undefined; note?: string }) {
  const tone = scoreTone(value);
  return (
    <div title={note}>
      <div className="flex justify-between text-xs">
        <span className="text-zinc-600">{label}</span>
        <span className="font-mono">{fmtScore(value)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-zinc-100">
        <div className={`h-1.5 rounded-full ${BAR_COLORS[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
      </div>
    </div>
  );
}

export function IqBadge({ value, provisional }: { value: number | null; provisional?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-bold tabular-nums">{fmtScore(value)}</span>
      {provisional && <span className="text-xs text-amber-700">provisional</span>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div title={hint}>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function ButtonLink({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          : "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
      }
    >
      {children}
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{children}</p>;
}

export function Loading() {
  return <p className="animate-pulse text-sm text-zinc-500">Loading…</p>;
}

export const fmtScore = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toFixed(1));
export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);
export const fmtMs = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(1)} s`;
export const fmtUsd = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `$${v.toFixed(4)}`);
export const fmtDate = (iso: string | undefined) => (iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "—");
