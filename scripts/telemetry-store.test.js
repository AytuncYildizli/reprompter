"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTelemetryStore } = require("./telemetry-store");

test("telemetry store writes and reads events", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-telemetry-"));
  const store = createTelemetryStore({ rootDir: tmp });

  store.clear();
  store.writeEvent({
    runId: "run-1",
    taskId: "task-1",
    stage: "plan_ready",
    status: "ok",
    latencyMs: 5,
  });

  const events = store.readEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].runId, "run-1");
});

test("telemetry store rejects invalid events", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-telemetry-"));
  const store = createTelemetryStore({ rootDir: tmp });

  assert.throws(() => {
    store.writeEvent({ runId: "x", taskId: "y", stage: "invalid", status: "ok" });
  }, /Invalid telemetry event/);
});

test("telemetry store readEvents limit returns latest N records", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-telemetry-"));
  const store = createTelemetryStore({ rootDir: tmp });

  store.clear();
  for (let i = 1; i <= 5; i += 1) {
    store.writeEvent({
      runId: `run-${i}`,
      taskId: `task-${i}`,
      stage: "plan_ready",
      status: "ok",
    });
  }

  const events = store.readEvents({ limit: 2 });
  assert.equal(events.length, 2);
  assert.equal(events[0].runId, "run-4");
  assert.equal(events[1].runId, "run-5");
});
