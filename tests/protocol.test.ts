import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_GOAL_LENGTH, parseDecideResponse } from "../src/lib/agents/protocol.ts";
import { sign, verify } from "../src/lib/agents/signing.ts";

test("accepts a valid execute response and trims the goal", () => {
  const parsed = parseDecideResponse({ action: "execute", agentVersion: "1.0", goal: "  do it  " });
  assert.ok(parsed.ok);
  if (parsed.ok && parsed.value.action === "execute") assert.equal(parsed.value.goal, "do it");
});

test("accepts abort with a reason", () => {
  assert.ok(parseDecideResponse({ action: "abort", agentVersion: "1", abortReason: "cannot" }).ok);
  assert.ok(!parseDecideResponse({ action: "abort", agentVersion: "1" }).ok);
});

test("rejects unknown fields, bad actions, missing goals and oversized goals", () => {
  assert.ok(!parseDecideResponse({ action: "execute", agentVersion: "1", goal: "x", apiKey: "y" }).ok);
  assert.ok(!parseDecideResponse({ action: "browse", agentVersion: "1", goal: "x" }).ok);
  assert.ok(!parseDecideResponse({ action: "execute", agentVersion: "1" }).ok);
  assert.ok(!parseDecideResponse({ action: "execute", agentVersion: "1", goal: "x".repeat(MAX_GOAL_LENGTH + 1) }).ok);
  assert.ok(!parseDecideResponse([]).ok);
  assert.ok(!parseDecideResponse({ action: "execute", agentVersion: "", goal: "x" }).ok);
});

test("signatures verify, and reject tampering, wrong secrets and stale timestamps", () => {
  const now = Date.now();
  const ts = String(now);
  const signature = sign("secret", ts, '{"a":1}');
  assert.ok(verify("secret", ts, signature, '{"a":1}', now));
  assert.ok(!verify("secret", ts, signature, '{"a":2}', now));
  assert.ok(!verify("other", ts, signature, '{"a":1}', now));
  assert.ok(!verify("secret", ts, signature, '{"a":1}', now + 6 * 60 * 1000));
  assert.ok(!verify("secret", null, signature, '{"a":1}', now));
});
