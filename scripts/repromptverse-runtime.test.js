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
  const plan = buildExecutionPlan("repromptverse audit auth and config systems", {
    preferredOutcome: "quality_reliability",
    runtime: "openclaw",
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
  const plan = buildExecutionPlan("repromptverse audit auth and config systems", {
    featureFlags: {
      policyEngine: false,
      layeredContext: false,
      patternLibrary: false,
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
  const plan = buildExecutionPlan("repromptverse research benchmark options", {
    runtime: "sequential",
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
  const plan = buildExecutionPlan("repromptverse research benchmark options", {
    runtime: "sequential",
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
