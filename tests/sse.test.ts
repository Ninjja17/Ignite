import { test } from "node:test";
import assert from "node:assert/strict";
import { SseParser } from "../src/lib/execution/sse.ts";

test("parses complete messages and ignores comments", () => {
  const parser = new SseParser();
  const out = parser.push(': keep-alive\n\ndata: {"type":"STARTED"}\n\n');
  assert.deepEqual(out.map((m) => m.data), ['{"type":"STARTED"}']);
});

test("handles chunk boundaries anywhere, including split CRLF", () => {
  const parser = new SseParser();
  const stream = 'event: progress\r\ndata: {"a":1}\r\n\r\ndata: line1\r\ndata: line2\r\n\r\n';
  const messages = [];
  for (const ch of stream) messages.push(...parser.push(ch));
  messages.push(...parser.flush());
  assert.equal(messages.length, 2);
  assert.equal(messages[0].event, "progress");
  assert.equal(messages[0].data, '{"a":1}');
  assert.equal(messages[1].event, "message");
  assert.equal(messages[1].data, "line1\nline2");
});

test("flush emits a trailing message without a final blank line", () => {
  const parser = new SseParser();
  assert.equal(parser.push("data: tail").length, 0);
  assert.deepEqual(parser.flush().map((m) => m.data), ["tail"]);
});
