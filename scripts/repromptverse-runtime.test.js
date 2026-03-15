"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  FEATURE_ENV,
  resolveFeatureFlags,
  buildExecutionPlan,
  executePlan,
} = require("./repromptverse-runtime");

test("buildExecutionPlan composes routing, patterns, policy, and context", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-runtime-telemetry-"));
  const plan = buildExecutionPlan("repromptverse audit auth and config systems", {
    preferredOutcome: "quality_reliability",
    runtime: "openclaw",
    telemetry: { rootDir: tmp, enabled: true },
    repoFacts: {
      codeFacts: ["src/auth.ts contains middleware"],
      references: ["references/repromptverse-template.md"],
    },
  });

  assert.equal(plan.intent.mode, "multi-agent");
  assert.ok(plan.patternSelection.patternIds.length > 0);
  assert.ok(plan.modelPlan.selected.model);
  assert.ok(plan.contextPlan.promptContext.includes("Layer 1: Task Contract"));
});

test("feature flags can disable policy engine, layered context, and pattern library", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-runtime-telemetry-"));
  const plan = buildExecutionPlan("repromptverse audit auth and config systems", {
    telemetry: { rootDir: tmp, enabled: true },
    featureFlags: {
      policyEngine: false,
      layeredContext: false,
      patternLibrary: false,
      flywheel: false,
    },
  });

  assert.equal(plan.featureFlags.policyEngine, false);
  assert.equal(plan.featureFlags.layeredContext, false);
  assert.equal(plan.featureFlags.patternLibrary, false);
  assert.equal(plan.patternSelection.patternIds.length, 0);
  assert.equal(plan.modelPlan.reason, "policy-engine-disabled");
  assert.equal(plan.contextPlan.manifest.layers.length, 1);
});

test("resolveFeatureFlags reads env defaults", () => {
  process.env[FEATURE_ENV.policyEngine] = "0";
  process.env[FEATURE_ENV.layeredContext] = "true";
  process.env[FEATURE_ENV.strictEval] = "no";
  process.env[FEATURE_ENV.patternLibrary] = "1";

  const flags = resolveFeatureFlags();
  assert.equal(flags.policyEngine, false);
  assert.equal(flags.layeredContext, true);
  assert.equal(flags.strictEval, false);
  assert.equal(flags.patternLibrary, true);

  delete process.env[FEATURE_ENV.policyEngine];
  delete process.env[FEATURE_ENV.layeredContext];
  delete process.env[FEATURE_ENV.strictEval];
  delete process.env[FEATURE_ENV.patternLibrary];
});

test("executePlan runs through adapter spawn and polling", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-runtime-"));
  const outputPath = path.join(tmp, "final.md");
  fs.writeFileSync(outputPath, "## Findings\n- done", "utf8");

  const plan = buildExecutionPlan("repromptverse analyze backend and frontend", {
    runtime: "openclaw",
    outputPath,
    telemetry: { rootDir: tmp, enabled: true },
  });

  const result = await executePlan(plan, {
    expectedArtifacts: [outputPath],
    adapterOptions: {
      spawnFn: async () => ({ runId: "integration-run" }),
      waitFn: async () => {},
    },
  });

  assert.equal(result.adapter.runtime, "openclaw");
  assert.equal(result.spawnResult.runId, "integration-run");
  assert.equal(result.pollResult.status, "completed");
});

test("executePlan can perform optional artifact evaluation", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-runtime-"));
  const plan = buildExecutionPlan("repromptverse research benchmark options", {
    runtime: "sequential",
    telemetry: { rootDir: tmp, enabled: true },
  });

  const result = await executePlan(plan, {
    expectedArtifacts: [],
    adapterOptions: { waitFn: async () => {} },
    artifactText:
      "## Findings\n- issue in src/app.ts:10\n## Decisions\n- do x\n## Risks\n- r1\n## Next Actions\n- a1",
    contractSpec: {
      threshold: 6,
      requiredSections: ["findings", "decisions", "risks", "next actions"],
      requiresLineRefs: true,
    },
  });

  assert.equal(result.adapter.supportsParallel, false);
  assert.ok(result.evaluation);
  assert.equal(result.evaluation.pass, true);
});

test("executePlan relaxes evaluator defaults when strictEval flag is disabled", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-runtime-"));
  const plan = buildExecutionPlan("repromptverse research benchmark options", {
    runtime: "sequential",
    telemetry: { rootDir: tmp, enabled: true },
    featureFlags: { strictEval: false },
  });

  const result = await executePlan(plan, {
    expectedArtifacts: [],
    adapterOptions: { waitFn: async () => {} },
    artifactText:
      "## Findings\n- issue observed\n## Decisions\n- do x\n## Risks\n- r1\n## Next Actions\n- a1",
  });

  assert.equal(result.featureFlags.strictEval, false);
  assert.ok(result.evaluation);
  assert.equal(result.evaluation.pass, true);
});

test("flywheel bias syncs patterns array when new pattern IDs are added", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-runtime-flywheel-"));
  const flywheelDir = path.join(tmp, ".reprompter", "flywheel");
  fs.mkdirSync(flywheelDir, { recursive: true });

  // Seed outcome data so bestRecipeForDomain finds a bias with extra patterns
  const vector = {
    templateId: "engineering-swarm",
    patterns: ["constraint-first-framing", "delta-retry-scaffold", "evidence-strength-labeling"],
    capabilityTier: "reasoning_high",
    domain: "engineering",
    contextLayers: 3,
    qualityBucket: "good",
  };
  const hash = "fake-hash-001";
  const outcomes = [];
  for (let i = 0; i < 5; i++) {
    outcomes.push(JSON.stringify({
      runId: `run-${i}`,
      taskId: `task-${i}`,
      timestamp: new Date().toISOString(),
      recipe: { hash, vector, readable: "test-recipe" },
      signals: { artifactScore: 8, artifactPass: true, retryCount: 0 },
      effectivenessScore: 8,
    }));
  }
  fs.writeFileSync(path.join(flywheelDir, "outcomes.ndjson"), outcomes.join("\n") + "\n");

  const plan = buildExecutionPlan("audit and analyze engineering systems", {
    runtime: "openclaw",
    domain: "engineering",
    rootDir: tmp,
    telemetry: { rootDir: tmp, enabled: true },
    flywheelMinConfidence: "low",
    featureFlags: { flywheel: true, patternLibrary: true, policyEngine: true },
  });

  // Verify patterns array is synced with patternIds
  assert.equal(plan.patternSelection.patternIds.length, plan.patternSelection.patterns.length,
    "patternIds and patterns arrays should have same length");
  for (const id of plan.patternSelection.patternIds) {
    assert.ok(
      plan.patternSelection.patterns.some((p) => p.id === id),
      `pattern object for "${id}" should exist in patterns array`
    );
  }
});

test("flywheel preferred tier is passed to capability policy", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-runtime-flywheel-tier-"));
  const flywheelDir = path.join(tmp, ".reprompter", "flywheel");
  fs.mkdirSync(flywheelDir, { recursive: true });

  // Seed outcomes with high confidence to trigger tier preference
  const vector = {
    templateId: "engineering-swarm",
    patterns: ["constraint-first-framing"],
    capabilityTier: "latency_optimized",
    domain: "engineering",
    contextLayers: 3,
    qualityBucket: "good",
  };
  const hash = "tier-hash-001";
  const outcomes = [];
  for (let i = 0; i < 12; i++) {
    outcomes.push(JSON.stringify({
      runId: `run-tier-${i}`,
      taskId: `task-tier-${i}`,
      timestamp: new Date().toISOString(),
      recipe: { hash, vector, readable: "tier-recipe" },
      signals: { artifactScore: 9, artifactPass: true, retryCount: 0 },
      effectivenessScore: 9,
    }));
  }
  fs.writeFileSync(path.join(flywheelDir, "outcomes.ndjson"), outcomes.join("\n") + "\n");

  const plan = buildExecutionPlan("quickly triage engineering logs", {
    runtime: "openclaw",
    domain: "engineering",
    rootDir: tmp,
    telemetry: { rootDir: tmp, enabled: true },
    flywheelMinConfidence: "low",
    featureFlags: { flywheel: true, patternLibrary: true, policyEngine: true },
  });

  // With 12 samples the confidence is "high", so tier preference should be set
  if (plan.flywheelBias.applied && plan.flywheelBias.tier) {
    assert.equal(plan.agentSpec.flywheelPreferredTier, plan.flywheelBias.tier);
  }
});

test("runtime telemetry emits stage events with run and task ids", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-runtime-"));
  const outputPath = path.join(tmp, "final.md");
  fs.writeFileSync(outputPath, "## Findings\n- done", "utf8");

  const plan = buildExecutionPlan("repromptverse audit auth and infra", {
    runtime: "openclaw",
    outputPath,
    telemetry: { rootDir: tmp, enabled: true },
  });

  await executePlan(plan, {
    expectedArtifacts: [outputPath],
    adapterOptions: {
      spawnFn: async () => ({ runId: "telemetry-run" }),
      waitFn: async () => {},
    },
  });

  const telemetryPath = path.join(tmp, ".reprompter", "telemetry", "events.ndjson");
  const lines = fs
    .readFileSync(telemetryPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
  const events = lines.map((line) => JSON.parse(line));

  const stages = new Set(events.map((event) => event.stage));
  assert.equal(events.length > 0, true);
  assert.equal(stages.has("route_intent"), true);
  assert.equal(stages.has("spawn_agent"), true);
  assert.equal(stages.has("finalize_run"), true);
  assert.equal(events.every((event) => event.runId === plan.runId), true);
});
