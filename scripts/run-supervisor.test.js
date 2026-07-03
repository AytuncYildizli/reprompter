"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeRun } = require("./run-supervisor");

const SCRIPT = path.join(__dirname, "run-supervisor.js");

function event(overrides = {}) {
  return {
    timestamp: "2026-07-03T10:00:00.000Z",
    runId: "rpt-1",
    taskId: "task-1",
    stage: "poll_artifacts",
    status: "ok",
    ...overrides,
  };
}

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rpt-supervisor-"));
}

function writeNdjson(root, events) {
  const dir = path.join(root, ".reprompter", "telemetry");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "events.ndjson"),
    `${events.map((item) => JSON.stringify(item)).join("\n")}\n`,
    "utf8"
  );
}

test("analyzeRun reports healthy for recent in-flight runs", () => {
  const result = analyzeRun(
    [
      event({ stage: "spawn_agent", timestamp: "2026-07-03T10:00:00.000Z" }),
      event({ stage: "poll_artifacts", timestamp: "2026-07-03T10:01:00.000Z" }),
    ],
    { now: "2026-07-03T10:01:30.000Z" }
  );

  assert.equal(result.verdict, "healthy");
  assert.equal(result.runId, "rpt-1");
  assert.deepEqual(result.advice, ["No supervisor action. Continue the current polling loop."]);
});

test("analyzeRun reports stalled when a run emits stalled or timeout status", () => {
  const result = analyzeRun(
    [
      event({ stage: "spawn_agent" }),
      event({ stage: "poll_artifacts", status: "stalled" }),
    ],
    { now: "2026-07-03T10:01:00.000Z" }
  );

  assert.equal(result.verdict, "stalled");
  assert.ok(result.evidence.some((item) => item.includes("poll_artifacts:stalled")));
  assert.ok(result.advice.some((item) => item.includes("/tmp/rpt-{taskname}-*.md")));
});

test("analyzeRun reports stalled when active run has stale telemetry", () => {
  const result = analyzeRun(
    [
      event({ stage: "spawn_agent", timestamp: "2026-07-03T10:00:00.000Z" }),
      event({ stage: "poll_artifacts", timestamp: "2026-07-03T10:00:01.000Z" }),
    ],
    { now: "2026-07-03T10:03:00.000Z", staleMs: 120000 }
  );

  assert.equal(result.verdict, "stalled");
  assert.ok(result.evidence.some((item) => item.includes("last event age")));
});

test("analyzeRun reports failing-evals after two failed evaluate_artifact events", () => {
  const result = analyzeRun(
    [
      event({ stage: "evaluate_artifact", status: "error", pass: false, attempt: 1 }),
      event({ stage: "evaluate_artifact", status: "error", pass: false, attempt: 2 }),
    ],
    { now: "2026-07-03T10:01:00.000Z" }
  );

  assert.equal(result.verdict, "failing-evals");
  assert.ok(result.advice.some((item) => item.includes("Phase-4 delta prompt")));
});

test("analyzeRun future-proofs retry_artifact as failing-evals", () => {
  const result = analyzeRun(
    [event({ stage: "retry_artifact", status: "ok", attempt: 1 })],
    { now: "2026-07-03T10:01:00.000Z" }
  );

  assert.equal(result.verdict, "failing-evals");
});

test("analyzeRun reports completed success and failure from finalize_run", () => {
  const success = analyzeRun(
    [event({ stage: "finalize_run", status: "ok", pass: true })],
    { now: "2026-07-03T10:01:00.000Z" }
  );
  const failure = analyzeRun(
    [event({ stage: "finalize_run", status: "error", pass: false })],
    { now: "2026-07-03T10:01:00.000Z" }
  );

  assert.equal(success.verdict, "completed");
  assert.ok(success.evidence.some((item) => item.includes("success=true")));
  assert.equal(failure.verdict, "completed");
  assert.ok(failure.evidence.some((item) => item.includes("success=false")));
});

test("analyzeRun returns unknown for a missing run id", () => {
  const result = analyzeRun([event({ runId: "rpt-present" })], {
    runId: "rpt-missing",
    now: "2026-07-03T10:01:00.000Z",
  });

  assert.equal(result.verdict, "unknown");
  assert.equal(result.runId, "rpt-missing");
});

test("analyzeRun excludes gate runs from auto-pick", () => {
  const result = analyzeRun(
    [
      event({
        runId: "gate-123",
        stage: "gate_prompt",
        status: "timeout",
        timestamp: "2026-07-03T10:05:00.000Z",
      }),
      event({
        runId: "rpt-real",
        stage: "poll_artifacts",
        status: "ok",
        timestamp: "2026-07-03T10:00:00.000Z",
      }),
    ],
    { now: "2026-07-03T10:00:30.000Z" }
  );

  assert.equal(result.runId, "rpt-real");
  assert.equal(result.verdict, "healthy");
});

test("CLI --json reports stalled for fabricated telemetry", () => {
  const root = tmpRoot();
  writeNdjson(root, [
    event({ stage: "route_intent" }),
    event({ stage: "plan_ready" }),
    event({ stage: "spawn_agent" }),
    event({ stage: "poll_artifacts", status: "ok" }),
    event({ stage: "poll_artifacts", status: "stalled" }),
    event({ stage: "evaluate_artifact", status: "skipped" }),
  ]);

  const res = spawnSync(process.execPath, [SCRIPT, "--advise", "--root", root, "--json"], {
    encoding: "utf8",
  });
  assert.equal(res.status, 0);
  assert.equal(JSON.parse(res.stdout).verdict, "stalled");
});

test("CLI fail-softs to unknown on missing telemetry file", () => {
  const root = tmpRoot();
  const res = spawnSync(process.execPath, [SCRIPT, "--advise", "--root", root, "--json"], {
    encoding: "utf8",
  });

  assert.equal(res.status, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.verdict, "unknown");
  assert.equal(parsed.runId, null);
});
