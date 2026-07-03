#!/usr/bin/env node
"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createOutcomeStore } = require("./outcome-collector");
const { fingerprint } = require("./recipe-fingerprint");
const { recommendStrategy } = require("./strategy-learner");
const {
  PACK_SCHEMA,
  sanitizeRow,
  exportPack,
  importPacks,
} = require("./flywheel-sync");

const roots = [];

function tmpRoot(prefix = "rpt-flywheel-sync-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

function scoreForBucket(bucket) {
  switch (bucket) {
    case "excellent":
      return 9;
    case "good":
      return 7;
    case "fair":
      return 5;
    case "weak":
      return 3;
    case "poor":
    default:
      return 0;
  }
}

function sampleOutcome(overrides = {}) {
  const recipeInput = {
    templateId: "fix_bug",
    patterns: ["delta-retry-scaffold"],
    capabilityTier: "reasoning_high",
    domain: "berry-agent",
    contextLayers: 3,
    qualityScore: 8.5,
    ...(overrides.recipeInput || {}),
  };
  return {
    timestamp: overrides.timestamp || "2026-07-03T09:00:00.000Z",
    runId: overrides.runId || "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    taskId: overrides.taskId || "raw-task-slug-user-project",
    recipe: fingerprint(recipeInput),
    signals: {
      artifactScore: 8.5,
      retryCount: 0,
      filesChanged: 2,
      source: "flywheel-ingest-v1",
      artifactPass: true,
      unknownText: "drop me",
      ...(overrides.signals || {}),
    },
    effectivenessScore: overrides.effectivenessScore || 8.5,
    applied_recommendation: overrides.applied_recommendation,
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {}
  }
});

describe("flywheel-sync", () => {
  it("sanitizes leak fields deterministically and recomputes recipe fingerprint", () => {
    const row = sampleOutcome();
    const a = sanitizeRow(row, { originLabel: "o-test" });
    const b = sanitizeRow(row, { originLabel: "o-test" });
    assert.deepEqual(a, b);

    assert.match(a.runId, /^fw-[0-9a-f]{12}$/);
    assert.match(a.taskId, /^ft-[0-9a-f]{12}$/);
    assert.notEqual(a.runId, row.runId);
    assert.notEqual(a.taskId, row.taskId);
    assert.match(a.recipe.vector.domain, /^d-[0-9a-f]{8}$/);
    assert.doesNotMatch(a.recipe.readable, /berry-agent/);
    assert.deepEqual(Object.keys(a.signals).sort(), [
      "artifactScore",
      "filesChanged",
      "retryCount",
    ]);

    const expected = fingerprint({
      ...a.recipe.vector,
      qualityScore: scoreForBucket(a.recipe.vector.qualityBucket),
    });
    assert.equal(a.recipe.hash, expected.hash);
    assert.equal(a.recipe.readable, expected.readable);

    const otherOrigin = sanitizeRow(row, { originLabel: "o-other" });
    assert.equal(otherOrigin.recipe.hash, a.recipe.hash);
    assert.equal(otherOrigin.runId, a.runId);
    assert.equal(otherOrigin.taskId, a.taskId);
  });

  it("passes allowlisted domains through", () => {
    const row = sampleOutcome({ recipeInput: { domain: "security" } });
    const sanitized = sanitizeRow(row, { originLabel: "o-test" });
    assert.equal(sanitized.recipe.vector.domain, "security");
    assert.match(sanitized.recipe.readable, /security/);
  });

  it("rejects non-pack files during import", () => {
    const root = tmpRoot();
    const packDir = path.join(root, "packs");
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(path.join(packDir, "not-a-pack.ndjson"), "{\"pack\":\"nope\"}\n", "utf8");

    const result = importPacks({ rootDir: root, from: packDir });
    assert.equal(result.imported, 0);
    assert.equal(result.skipped, 1);
    assert.match(result.warnings.join("\n"), /non-flywheel pack/);
  });

  it("dedupes imports against existing ledger and within a batch", () => {
    const root = tmpRoot();
    const store = createOutcomeStore({ rootDir: root });
    const existing = sanitizeRow(sampleOutcome({ taskId: "existing-task" }), { originLabel: "o-src" });
    store.writeOutcome(existing);

    const fresh = sanitizeRow(
      sampleOutcome({
        timestamp: "2026-07-03T10:00:00.000Z",
        runId: "sha256:fresh",
        taskId: "fresh-task",
      }),
      { originLabel: "o-src" }
    );
    const pack = path.join(root, "pack.ndjson");
    fs.writeFileSync(
      pack,
      [
        JSON.stringify({ pack: PACK_SCHEMA, exported_at: "2026-07-03T10:00:00.000Z", origin: "o-src", rows: 4 }),
        JSON.stringify(existing),
        JSON.stringify(fresh),
        JSON.stringify(fresh),
        "{malformed",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = importPacks({ rootDir: root, from: pack });
    assert.equal(result.imported, 1);
    assert.equal(result.duplicates, 2);
    assert.equal(result.skipped, 1);
    assert.equal(store.readOutcomes({ limit: Number.MAX_SAFE_INTEGER }).length, 2);
  });

  it("round-trips sanitized rows and learner groups imported rows with local recipe rows", () => {
    const sourceRoot = tmpRoot("rpt-flywheel-sync-source-");
    const destRoot = tmpRoot("rpt-flywheel-sync-dest-");
    const sourceStore = createOutcomeStore({ rootDir: sourceRoot });
    const destStore = createOutcomeStore({ rootDir: destRoot });
    const recipeInput = {
      templateId: "security-template",
      patterns: ["constraint-first-framing"],
      capabilityTier: "reasoning_high",
      domain: "security",
      contextLayers: 4,
      qualityScore: 8.5,
    };

    destStore.writeOutcome(sampleOutcome({
      runId: "local-1",
      taskId: "local-security",
      recipeInput,
      effectivenessScore: 8.1,
    }));
    sourceStore.writeOutcome(sampleOutcome({
      timestamp: "2026-07-03T10:00:00.000Z",
      runId: "sha256:remote-a",
      taskId: "remote-security-a",
      recipeInput,
      effectivenessScore: 8.9,
    }));
    sourceStore.writeOutcome(sampleOutcome({
      timestamp: "2026-07-03T11:00:00.000Z",
      runId: "sha256:remote-b",
      taskId: "remote-security-b",
      recipeInput,
      effectivenessScore: 9.0,
    }));

    const { out } = exportPack({ rootDir: sourceRoot, originLabel: "o-src" });
    const packText = fs.readFileSync(out, "utf8");
    assert.doesNotMatch(packText, /sha256:remote/);
    assert.doesNotMatch(packText, /remote-security/);
    assert.doesNotMatch(packText, new RegExp(os.hostname().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const result = importPacks({ rootDir: destRoot, from: out });
    assert.equal(result.imported, 2);
    assert.equal(result.duplicates, 0);

    const target = fingerprint(recipeInput).vector;
    const recommendation = recommendStrategy(target, { store: destStore, domain: "security" });
    assert.equal(recommendation.hasData, true);
    assert.ok(recommendation.recommendation);
    assert.equal(recommendation.recommendation.sampleCount, 3);
  });
});
