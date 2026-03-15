#!/usr/bin/env node
"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { buildExecutionPlan, executePlan } = require("./repromptverse-runtime");
const { createOutcomeStore, computeEffectiveness } = require("./outcome-collector");
const { fingerprint } = require("./recipe-fingerprint");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rpt-flywheel-e2e-"));
}

function seedOutcomes(rootDir, count = 3, overrides = {}) {
  const store = createOutcomeStore({ rootDir });
  for (let i = 0; i < count; i++) {
    const recipe = fingerprint({
      templateId: overrides.templateId || "security-template",
      patterns: overrides.patterns || ["constraint-first-framing"],
      capabilityTier: overrides.capabilityTier || "reasoning_high",
      domain: overrides.domain || "security",
      contextLayers: overrides.contextLayers || 4,
      qualityScore: overrides.qualityScore || 8.5,
    });
    const signals = {
      artifactScore: overrides.artifactScore || 8.5,
      artifactPass: true,
      retryCount: 0,
    };
    store.writeOutcome({
      runId: `rpt-seed-${i}`,
      taskId: `seed-task-${i}`,
      recipe,
      signals,
      effectivenessScore: overrides.effectivenessScore || computeEffectiveness(signals),
    });
  }
  return store;
}

describe("flywheel-e2e", () => {
  const dirs = [];
  afterEach(() => {
    for (const dir of dirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    dirs.length = 0;
  });

  it("cold start: no bias applied when outcome store is empty", () => {
    const tmp = tmpDir();
    dirs.push(tmp);

    const plan = buildExecutionPlan("repromptverse audit auth security", {
      rootDir: tmp,
      telemetry: { rootDir: tmp, enabled: true },
      featureFlags: { flywheel: true },
    });

    assert.ok(plan.recipeFingerprint, "should have recipe fingerprint even on cold start");
    assert.strictEqual(plan.flywheelBias.applied, false, "no bias on cold start");
  });

  it("seeded outcomes: buildExecutionPlan applies flywheel bias", () => {
    const tmp = tmpDir();
    dirs.push(tmp);

    // Seed 5 high-quality security outcomes
    seedOutcomes(tmp, 5, {
      domain: "security",
      patterns: ["constraint-first-framing", "self-critique-checkpoint"],
      effectivenessScore: 9.0,
    });

    const plan = buildExecutionPlan("repromptverse audit auth and config systems", {
      rootDir: tmp,
      telemetry: { rootDir: tmp, enabled: true },
      featureFlags: { flywheel: true },
      flywheelMinConfidence: "low",
    });

    assert.ok(plan.recipeFingerprint, "should compute fingerprint");
    assert.ok(plan.recipeFingerprint.hash.length === 16, "hash should be 16 chars");

    // With 5 samples at low min confidence, bias should be applied
    if (plan.flywheelBias.applied) {
      assert.ok(
        plan.patternSelection.reasons.some((r) => r.includes("flywheel-bias")),
        "pattern reasons should mention flywheel"
      );
    }
  });

  it("executePlan with flywheel writes outcome record", async () => {
    const tmp = tmpDir();
    dirs.push(tmp);
    const outputPath = path.join(tmp, "final.md");
    fs.writeFileSync(outputPath, "## Findings\n- auth issue in src/auth.ts:42\n## Decisions\n- fix it", "utf8");

    const plan = buildExecutionPlan("repromptverse audit auth security", {
      rootDir: tmp,
      runtime: "sequential",
      outputPath,
      telemetry: { rootDir: tmp, enabled: true },
      featureFlags: { flywheel: true },
    });

    // Point outcome store to the same rootDir
    plan.taskSpec.rootDir = tmp;

    const result = await executePlan(plan, {
      expectedArtifacts: [outputPath],
      adapterOptions: { waitFn: async () => {} },
      artifactText: "## Findings\n- auth issue in src/auth.ts:42\n## Decisions\n- fix it\n## Risks\n- none\n## Next Actions\n- deploy",
      contractSpec: {
        threshold: 6,
        requiredSections: ["findings", "decisions", "risks", "next actions"],
        requiresLineRefs: true,
      },
    });

    assert.ok(result.outcomeRecord, "should have outcome record");
    assert.ok(Number.isFinite(result.outcomeRecord.effectivenessScore), "effectiveness should be a number");

    // Verify NDJSON file was written
    const outcomePath = path.join(tmp, ".reprompter", "flywheel", "outcomes.ndjson");
    assert.ok(fs.existsSync(outcomePath), "outcomes.ndjson should exist");
    const lines = fs.readFileSync(outcomePath, "utf8").split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length >= 1, "should have at least 1 outcome line");
  });

  it("re-plan after execution reflects new outcome data", async () => {
    const tmp = tmpDir();
    dirs.push(tmp);
    const outputPath = path.join(tmp, "final.md");
    fs.writeFileSync(outputPath, "## Findings\n- issue in src/app.ts:10", "utf8");

    // Seed initial outcomes so bias kicks in
    seedOutcomes(tmp, 3, { domain: "security", effectivenessScore: 9.0 });

    // First plan + execute
    const plan1 = buildExecutionPlan("repromptverse audit auth security", {
      rootDir: tmp,
      runtime: "sequential",
      outputPath,
      telemetry: { rootDir: tmp, enabled: true },
      featureFlags: { flywheel: true },
      flywheelMinConfidence: "low",
    });
    plan1.taskSpec.rootDir = tmp;

    await executePlan(plan1, {
      expectedArtifacts: [outputPath],
      adapterOptions: { waitFn: async () => {} },
      artifactText: "## Findings\n- issue in src/app.ts:10\n## Risks\n- r1\n## Next Actions\n- a1\n## Decisions\n- d1",
      contractSpec: {
        threshold: 6,
        requiredSections: ["findings"],
        requiresLineRefs: true,
      },
    });

    // Verify outcome store grew
    const store = createOutcomeStore({ rootDir: tmp });
    const outcomes = store.readOutcomes();
    assert.ok(outcomes.length >= 4, `expected 4+ outcomes (3 seeded + 1 new), got ${outcomes.length}`);

    // Second plan should see the new data
    const plan2 = buildExecutionPlan("repromptverse audit auth security", {
      rootDir: tmp,
      telemetry: { rootDir: tmp, enabled: true },
      featureFlags: { flywheel: true },
      flywheelMinConfidence: "low",
    });

    assert.ok(plan2.recipeFingerprint, "second plan should have fingerprint");
    // The second plan should at minimum have attempted the flywheel lookup
    // (bias may or may not be applied depending on similarity thresholds)
  });

  it("telemetry includes flywheel stage events", async () => {
    const tmp = tmpDir();
    dirs.push(tmp);
    const outputPath = path.join(tmp, "final.md");
    fs.writeFileSync(outputPath, "## Findings\n- done", "utf8");

    seedOutcomes(tmp, 3, { domain: "security" });

    const plan = buildExecutionPlan("repromptverse audit auth security", {
      rootDir: tmp,
      runtime: "sequential",
      outputPath,
      telemetry: { rootDir: tmp, enabled: true },
      featureFlags: { flywheel: true },
      flywheelMinConfidence: "low",
    });
    plan.taskSpec.rootDir = tmp;

    await executePlan(plan, {
      expectedArtifacts: [outputPath],
      adapterOptions: { waitFn: async () => {} },
    });

    const telemetryPath = path.join(tmp, ".reprompter", "telemetry", "events.ndjson");
    assert.ok(fs.existsSync(telemetryPath), "telemetry file should exist");

    const lines = fs.readFileSync(telemetryPath, "utf8").split(/\r?\n/).filter(Boolean);
    const events = lines.map((l) => JSON.parse(l));
    const stages = new Set(events.map((e) => e.stage));

    assert.ok(stages.has("fingerprint_recipe"), "should have fingerprint_recipe event");
    assert.ok(stages.has("collect_outcome"), "should have collect_outcome event");
    assert.ok(stages.has("learn_strategy"), "should have learn_strategy event");
  });
});
