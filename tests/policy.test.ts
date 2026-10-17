import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePolicy, type PolicyInput } from "../src/lib/policy/policy.ts";
import { redactText, redactValue } from "../src/lib/policy/redaction.ts";

const input = (goal: string, extra: Partial<PolicyInput> = {}): PolicyInput => ({
  goal,
  allowedDomains: ["sandbox.example"],
  prohibitedPatterns: [{ pattern: "\\b(book|purchase)\\b", reason: "Search only." }],
  secrets: ["super-secret-value"],
  maxGoalLength: 200,
  ...extra,
});

test("allows a normal goal", () => {
  assert.deepEqual(evaluatePolicy(input("Find the cheapest flight on https://sandbox.example/flights")), { allowed: true, violations: [] });
});

test("blocks URLs outside the allowed domains, including lookalike hosts", () => {
  const decision = evaluatePolicy(input("Open https://sandbox.example.evil.test/x first"));
  assert.equal(decision.allowed, false);
  assert.equal(decision.violations[0].code, "domain_escape");
});

test("blocks affirmative prohibited actions but allows negated guard-rails", () => {
  assert.equal(evaluatePolicy(input("Then book the flight")).allowed, false);
  assert.equal(evaluatePolicy(input("Do not book or purchase anything")).allowed, true);
  assert.equal(evaluatePolicy(input("Never purchase items")).allowed, true);
  assert.equal(evaluatePolicy(input("Do not book, then purchase the cheapest")).allowed, false);
});

test("blocks secrets and over-long goals", () => {
  assert.equal(evaluatePolicy(input("use super-secret-value")).violations[0].code, "secret_leak");
  assert.equal(evaluatePolicy(input("api_key=abc")).violations[0].code, "secret_leak");
  assert.equal(evaluatePolicy(input("x".repeat(201))).violations[0].code, "invalid_goal");
  assert.equal(evaluatePolicy(input("   ")).violations[0].code, "invalid_goal");
});

test("redaction removes configured secrets and credential shapes", () => {
  const out = redactText("key sk-abcdefghijklmnop1234 Bearer abcdefghijklmnopqrstu password=hunter2 card 4111 1111 1111 1111 my-config-secret", ["my-config-secret"]);
  assert.ok(!out.includes("sk-abcdefghijklmnop1234"));
  assert.ok(!out.includes("abcdefghijklmnopqrstu"));
  assert.ok(!out.includes("hunter2"));
  assert.ok(!out.includes("4111 1111"));
  assert.ok(!out.includes("my-config-secret"));
  assert.ok(out.includes("password=[REDACTED]"));
});

test("redactValue walks nested structures without mutating input", () => {
  const original = { a: ["token: abc"], b: { c: 5 } };
  const out = redactValue(original);
  assert.equal(out.a[0], "token: [REDACTED]");
  assert.equal(out.b.c, 5);
  assert.equal(original.a[0], "token: abc");
});
