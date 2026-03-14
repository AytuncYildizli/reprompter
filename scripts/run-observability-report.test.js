"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeEvents, writeReport } = require("./run-observability-report");

test("summarizeEvents computes run and stage metrics", () => {
  const events = [
    {
      timestamp: new Date().toISOString(),
      runId: "run-1",
      taskId: "task-a",
      stage: "route_intent",
      status: "ok",
      latencyMs: 10,
      provider: "anthropic",
    },
    {
      timestamp: new Date().toISOString(),
      runId: "run-1",
      taskId: "task-a",
      stage: "poll_artifacts",
      status: "stalled",
      latencyMs: 20,
      provider: "anthropic",
    },
    {
      timestamp: new Date().toISOString(),
      runId: "run-1",
      taskId: "task-a",
      stage: "finalize_run",
      status: "error",
      pass: false,
    },
  ];

  const summary = summarizeEvents(events);
  assert.equal(summary.totals.runs, 1);
  assert.equal(summary.totals.stalledEvents, 1);
  assert.equal(summary.totals.failedRuns, 1);
  assert.ok(summary.stageLatency.some((row) => row.stage === "route_intent"));
});

test("writeReport writes markdown and json outputs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-observe-"));
  const summary = {
    generatedAt: new Date().toISOString(),
    totals: {
      events: 1,
      runs: 1,
      finalizedRuns: 1,
      successfulRuns: 1,
      failedRuns: 0,
      retryEvents: 0,
      stalledEvents: 0,
      timeoutEvents: 0,
      stallRatePercent: 0,
      timeoutRatePercent: 0,
    },
    stageLatency: [{ stage: "route_intent", samples: 1, avgLatencyMs: 12 }],
    providers: [{ provider: "openai", count: 1, sharePercent: 100 }],
  };

  const paths = writeReport(summary, tmp);
  assert.equal(fs.existsSync(paths.mdPath), true);
  assert.equal(fs.existsSync(paths.jsonPath), true);
});
