-- Agent Olympics — Postgres schema for when the JSON file store (src/lib/store/store.ts) is outgrown.
-- Mirrors src/lib/domain/types.ts. Task and agent catalogs stay in code (versioned with git) and are
-- referenced by id; snapshot columns keep historical attempts reproducible after catalog changes.

CREATE TABLE benchmarks (
  id               uuid PRIMARY KEY,
  name             text        NOT NULL,
  engine           text        NOT NULL CHECK (engine IN ('tinyfish', 'simulated')),
  agent_ids        text[]      NOT NULL,
  task_version_ids text[]      NOT NULL,
  repetitions      int         NOT NULL CHECK (repetitions BETWEEN 1 AND 5),
  status           text        NOT NULL CHECK (status IN ('running', 'completed', 'cancelled')),
  score_version    text        NOT NULL,
  result_class     text        NOT NULL CHECK (result_class IN ('official', 'experimental')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz
);

CREATE TABLE attempts (
  id               uuid PRIMARY KEY,
  benchmark_id     uuid        NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
  agent_id         text        NOT NULL,
  agent_version    text        NOT NULL,
  task_version_id  text        NOT NULL,
  repetition       int         NOT NULL,
  engine           text        NOT NULL,
  token            text        NOT NULL UNIQUE,
  status           text        NOT NULL,
  score_version    text        NOT NULL,
  proposal         jsonb,
  engine_run_id    text,
  streaming_url    text,
  result           jsonb,
  failure          jsonb,
  timings          jsonb       NOT NULL DEFAULT '{}',
  usage            jsonb       NOT NULL DEFAULT '{}',
  checks           jsonb       NOT NULL DEFAULT '[]',
  metrics          jsonb,
  scores           jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  finished_at      timestamptz
);
CREATE INDEX attempts_benchmark_idx   ON attempts (benchmark_id);
CREATE INDEX attempts_leaderboard_idx ON attempts (engine, score_version, agent_id);
-- Work queue lookup if a pg-boss / SKIP LOCKED worker replaces the in-process orchestrator.
CREATE INDEX attempts_queued_idx      ON attempts (created_at) WHERE status = 'queued';

CREATE TABLE execution_events (
  attempt_id uuid        NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  seq        int         NOT NULL,
  at         timestamptz NOT NULL,
  kind       text        NOT NULL,
  message    text        NOT NULL,
  url        text,
  data       jsonb,
  PRIMARY KEY (attempt_id, seq)
);

CREATE TABLE sandbox_registrations (
  id        text        PRIMARY KEY,
  event_id  text        NOT NULL,
  name      text        NOT NULL,
  email     text        NOT NULL,
  token     text,
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sandbox_registrations_token_idx ON sandbox_registrations (token);

CREATE TABLE sandbox_exfil_hits (
  id    bigserial   PRIMARY KEY,
  token text,
  data  text        NOT NULL,
  at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sandbox_exfil_hits_token_idx ON sandbox_exfil_hits (token);
