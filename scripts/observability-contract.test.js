#!/usr/bin/env node
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  REDACTED,
  createObservabilityContext,
  normalizeLabels,
  redactString,
  redactTelemetry,
  renderSample,
} = require("./observability-contract");

test("redacts private strings and sensitive object keys", () => {
  const text = redactString("mail test@example.com phone +90 555 111 2233 token abcdefghijklmnopqrstuvwxyzABCDEFG");
  assert.equal(text.includes("test@example.com"), false);
  assert.equal(text.includes("555"), false);
  assert.equal(text.includes("abcdefghijklmnopqrstuvwxyzABCDEFG"), false);

  const safe = redactTelemetry({ prompt: "raw prompt", nested: { apiKey: "secret", ok: "fine" } });
  assert.equal(safe.prompt, REDACTED);
  assert.equal(safe.nested.apiKey, REDACTED);
  assert.equal(safe.nested.ok, "fine");
});

test("creates correlation context from bounded headers", () => {
  const context = createObservabilityContext({
    "x-request-id": "req-1\nbad",
    "x-correlation-id": "corr-1",
    "x-client-surface": "cli",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  });
  assert.equal(context.request_id, "req-1bad");
  assert.equal(context.correlation_id, "corr-1");
  assert.equal(context.trace_id, "4bf92f3577b34da6a3ce929d0e0e4736");
  assert.equal(context.span_id, "00f067aa0ba902b7");
});

test("drops high-cardinality ids from metric labels", () => {
  const labels = normalizeLabels({ route: "goal", request_id: "req", success: "true" });
  assert.deepEqual(labels, { route: "goal", success: "true" });
  assert.equal(renderSample("reprompter_runs_total", labels, 1), 'reprompter_runs_total{route="goal",success="true"} 1');
});
