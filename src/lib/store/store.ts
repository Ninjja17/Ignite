import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Attempt,
  Benchmark,
  ExecutionEvent,
  SandboxExfilHit,
  SandboxRegistration,
} from "@/lib/domain/types";
import { TERMINAL_STATUSES } from "@/lib/domain/types";

/**
 * Demo persistence: an in-memory state persisted atomically to a JSON file. All access goes through
 * this module so it can be replaced by the PostgreSQL schema in db/schema.sql without touching callers.
 * Suitable for a single web/worker process only.
 */

interface DbShape {
  benchmarks: Benchmark[];
  attempts: Attempt[];
  events: Record<string, ExecutionEvent[]>;
  sandbox: { registrations: SandboxRegistration[]; exfilHits: SandboxExfilHit[] };
}

const MAX_EVENTS_PER_ATTEMPT = 500;
const DATA_FILE = path.resolve(process.cwd(), process.env.OLYMPICS_DATA_DIR ?? ".data", "olympics.json");

interface StoreGlobal {
  loading?: Promise<DbShape>;
  db?: DbShape;
  writeTimer?: NodeJS.Timeout;
  writing?: Promise<void>;
}

const g = globalThis as unknown as { __olympicsStore?: StoreGlobal };
const state: StoreGlobal = (g.__olympicsStore ??= {});

function empty(): DbShape {
  return { benchmarks: [], attempts: [], events: {}, sandbox: { registrations: [], exfilHits: [] } };
}

async function load(): Promise<DbShape> {
  if (state.db) return state.db;
  state.loading ??= (async () => {
    let db = empty();
    try {
      db = { ...empty(), ...(JSON.parse(await readFile(DATA_FILE, "utf8")) as Partial<DbShape>) } as DbShape;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    // Work in flight when the process stopped can never finish; classify it as a platform failure.
    const now = new Date().toISOString();
    for (const attempt of db.attempts) {
      if (!TERMINAL_STATUSES.includes(attempt.status)) {
        attempt.status = "infra_failed";
        attempt.failure = { source: "platform", message: "Interrupted by a platform restart." };
        attempt.finishedAt = now;
      }
    }
    for (const benchmark of db.benchmarks) {
      if (benchmark.status === "running") {
        benchmark.status = "completed";
        benchmark.finishedAt = now;
      }
    }
    state.db = db;
    return db;
  })();
  return state.loading;
}

function scheduleWrite() {
  if (state.writeTimer) return;
  state.writeTimer = setTimeout(() => {
    state.writeTimer = undefined;
    const previous = state.writing ?? Promise.resolve();
    state.writing = previous.then(async () => {
      if (!state.db) return;
      await mkdir(path.dirname(DATA_FILE), { recursive: true });
      const tmp = `${DATA_FILE}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(state.db), "utf8");
      await rename(tmp, DATA_FILE);
    }).catch((error) => {
      console.error("[store] persist failed", error);
    });
  }, 250);
}

const clone = <T,>(value: T): T => structuredClone(value);

export const store = {
  async listBenchmarks(): Promise<Benchmark[]> {
    const db = await load();
    return clone([...db.benchmarks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async getBenchmark(id: string): Promise<Benchmark | undefined> {
    const db = await load();
    const found = db.benchmarks.find((b) => b.id === id);
    return found && clone(found);
  },

  async createBenchmark(benchmark: Benchmark, attempts: Attempt[]): Promise<void> {
    const db = await load();
    db.benchmarks.push(clone(benchmark));
    db.attempts.push(...clone(attempts));
    scheduleWrite();
  },

  async updateBenchmark(id: string, patch: Partial<Benchmark>): Promise<void> {
    const db = await load();
    const found = db.benchmarks.find((b) => b.id === id);
    if (found) Object.assign(found, clone(patch));
    scheduleWrite();
  },

  async listAttempts(filter: { benchmarkId?: string; agentId?: string } = {}): Promise<Attempt[]> {
    const db = await load();
    return clone(
      db.attempts.filter(
        (a) =>
          (!filter.benchmarkId || a.benchmarkId === filter.benchmarkId) &&
          (!filter.agentId || a.agentId === filter.agentId),
      ),
    );
  },

  async getAttempt(id: string): Promise<Attempt | undefined> {
    const db = await load();
    const found = db.attempts.find((a) => a.id === id);
    return found && clone(found);
  },

  async updateAttempt(id: string, patch: Partial<Attempt>): Promise<Attempt | undefined> {
    const db = await load();
    const found = db.attempts.find((a) => a.id === id);
    if (!found) return undefined;
    Object.assign(found, clone(patch));
    scheduleWrite();
    return clone(found);
  },

  async appendEvent(event: Omit<ExecutionEvent, "seq">): Promise<ExecutionEvent> {
    const db = await load();
    const list = (db.events[event.attemptId] ??= []);
    const full: ExecutionEvent = { ...clone(event), seq: list.length ? list[list.length - 1].seq + 1 : 1 };
    list.push(full);
    if (list.length > MAX_EVENTS_PER_ATTEMPT) list.splice(1, list.length - MAX_EVENTS_PER_ATTEMPT);
    scheduleWrite();
    return clone(full);
  },

  async listEvents(attemptId: string): Promise<ExecutionEvent[]> {
    const db = await load();
    return clone(db.events[attemptId] ?? []);
  },

  async addRegistration(registration: SandboxRegistration): Promise<void> {
    const db = await load();
    db.sandbox.registrations.push(clone(registration));
    scheduleWrite();
  },

  async addExfilHit(hit: SandboxExfilHit): Promise<void> {
    const db = await load();
    db.sandbox.exfilHits.push(clone(hit));
    scheduleWrite();
  },

  async sandboxEvidence(token: string): Promise<DbShape["sandbox"]> {
    const db = await load();
    return clone({
      registrations: db.sandbox.registrations.filter((r) => r.token === token),
      exfilHits: db.sandbox.exfilHits.filter((h) => h.token === token),
    });
  },
};
