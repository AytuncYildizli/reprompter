"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRuntimeAdapter } = require("./runtime-adapter");

test("openclaw adapter supports parallel execution", () => {
  const adapter = createRuntimeAdapter("openclaw");
  assert.equal(adapter.name, "openclaw");
  assert.equal(adapter.supportsParallel(), true);
});

test("sequential adapter disables parallel execution", () => {
  const adapter = createRuntimeAdapter("sequential");
  assert.equal(adapter.name, "sequential");
  assert.equal(adapter.supportsParallel(), false);
});

test("spawnAgent returns run metadata", async () => {
  const adapter = createRuntimeAdapter("openclaw", {
    spawnFn: async (payload) => ({ runId: `run-${payload.label}` }),
  });

  const result = await adapter.spawnAgent("Do work", { model: "openai/gpt-5", provider: "openai" }, "agent-1");
  assert.equal(result.runId, "run-agent-1");
  assert.equal(result.payload.model, "openai/gpt-5");
});

test("pollArtifacts detects completion when all outputs exist", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-adapter-"));
  const a = path.join(tmp, "a.md");
  const b = path.join(tmp, "b.md");

  fs.writeFileSync(a, "hello", "utf8");
  fs.writeFileSync(b, "world", "utf8");

  const adapter = createRuntimeAdapter("openclaw", { waitFn: async () => {} });
  const result = await adapter.pollArtifacts("task-1", [a, b], { maxPolls: 5, intervalMs: 0 });

  assert.equal(result.status, "completed");
  assert.equal(result.missingArtifacts.length, 0);
});

test("pollArtifacts returns stalled when no progress across polls", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-adapter-"));
  const existing = path.join(tmp, "exists.md");
  const missing = path.join(tmp, "missing.md");

  fs.writeFileSync(existing, "stable", "utf8");

  const adapter = createRuntimeAdapter("openclaw", { waitFn: async () => {} });
  const result = await adapter.pollArtifacts("task-2", [existing, missing], {
    maxPolls: 6,
    stableThreshold: 2,
    intervalMs: 0,
  });

  assert.equal(result.status, "stalled");
  assert.ok(result.missingArtifacts.includes(missing));
});
