"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateEvent } = require("./telemetry-schema");

test("validateEvent accepts a valid telemetry event", () => {
  const result = validateEvent({
    runId: "rpt-1",
    taskId: "task-1",
    stage: "route_intent",
    status: "ok",
    latencyMs: 12,
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.event.stage, "route_intent");
});

test("validateEvent rejects missing required fields", () => {
  const result = validateEvent({ stage: "route_intent" });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("runId")));
  assert.ok(result.errors.some((error) => error.includes("taskId")));
});

test("validateEvent rejects invalid stage", () => {
  const result = validateEvent({
    runId: "rpt-2",
    taskId: "task-2",
    stage: "unknown_stage",
    status: "ok",
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("stage must be one of")));
});
