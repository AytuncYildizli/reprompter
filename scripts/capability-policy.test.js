"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_MODEL_CATALOG,
  inferCapabilityRequirements,
  resolveModelForAgent,
} = require("./capability-policy");

test("infers long context tier for high context token requirement", () => {
  const requirements = inferCapabilityRequirements(
    { domain: "research", contextTokens: 180000 },
    { preferredOutcome: "quality_reliability", task: "Analyze very large codebase" }
  );

  assert.equal(requirements.primaryTier, "long_context");
  assert.equal(requirements.needsLongContext, true);
});

test("selects cost optimized tier for low complexity cost_speed outcome", () => {
  const requirements = inferCapabilityRequirements(
    { domain: "ops", outputType: "triage", complexity: 3 },
    { preferredOutcome: "cost_speed", task: "Quickly summarize logs" }
  );

  assert.equal(requirements.primaryTier, "cost_optimized");
});

test("resolveModelForAgent returns deterministic selection and fallback chain", () => {
  const plan = resolveModelForAgent(
    { domain: "security", role: "auditor", outputType: "evaluation", complexity: 9 },
    { preferredOutcome: "quality_reliability", task: "Audit authentication flows" }
  );

  assert.ok(plan.selected.model);
  assert.equal(plan.selected.capabilityTier, "reasoning_high");
  assert.ok(plan.fallbackChain.length >= 1);
  assert.ok(plan.fallbackChain.some((item) => item.provider !== plan.selected.provider));
});

test("provider preference nudges selection when models are near", () => {
  const tinyCatalog = [
    {
      id: "provider-a/high",
      provider: "provider-a",
      maxContextK: 200,
      metrics: {
        reasoning: 8,
        reliability: 8,
        latency: 8,
        costEfficiency: 8,
        longContext: 8,
        toolReliability: 8,
      },
    },
    {
      id: "provider-b/high",
      provider: "provider-b",
      maxContextK: 200,
      metrics: {
        reasoning: 8,
        reliability: 8,
        latency: 8,
        costEfficiency: 8,
        longContext: 8,
        toolReliability: 8,
      },
    },
  ];

  const withoutPreference = resolveModelForAgent(
    { domain: "engineering", outputType: "analysis" },
    { preferredOutcome: "balanced", task: "Plan migration" },
    { modelCatalog: tinyCatalog }
  );

  const withPreference = resolveModelForAgent(
    { domain: "engineering", outputType: "analysis" },
    { preferredOutcome: "balanced", task: "Plan migration" },
    { modelCatalog: tinyCatalog, preferProvider: "provider-b" }
  );

  assert.ok(withoutPreference.selected.model);
  assert.equal(withPreference.selected.provider, "provider-b");
});

test("flywheelPreferredTier boosts models matching the preferred tier", () => {
  const plan = resolveModelForAgent(
    { domain: "ops", outputType: "triage", complexity: 3, flywheelPreferredTier: "latency_optimized" },
    { preferredOutcome: "quality_reliability", task: "Quick triage" }
  );

  // With latency_optimized preferred tier, latency-heavy models should get a +2 boost
  // gemini-2.5-flash has latency:10 which scores well under latency_optimized weights
  const flashCandidate = plan.rankedCandidates.find((c) => c.model === "google/gemini-2.5-flash");
  assert.ok(flashCandidate, "flash model should be in candidates");

  // Run again without the flywheel tier to compare
  const planWithout = resolveModelForAgent(
    { domain: "ops", outputType: "triage", complexity: 3 },
    { preferredOutcome: "quality_reliability", task: "Quick triage" }
  );
  const flashWithout = planWithout.rankedCandidates.find((c) => c.model === "google/gemini-2.5-flash");
  assert.ok(flashCandidate.score > flashWithout.score, "flywheel tier should boost the score");
});

test("flywheelPreferredTier with invalid tier name has no effect", () => {
  const plan = resolveModelForAgent(
    { domain: "engineering", outputType: "analysis", flywheelPreferredTier: "nonexistent_tier" },
    { preferredOutcome: "balanced", task: "Plan migration" }
  );

  const planWithout = resolveModelForAgent(
    { domain: "engineering", outputType: "analysis" },
    { preferredOutcome: "balanced", task: "Plan migration" }
  );

  // Scores should be identical since the tier doesn't exist
  assert.deepEqual(
    plan.rankedCandidates.map((c) => c.score),
    planWithout.rankedCandidates.map((c) => c.score)
  );
});

test("default model catalog stays populated", () => {
  assert.ok(Array.isArray(DEFAULT_MODEL_CATALOG));
  assert.ok(DEFAULT_MODEL_CATALOG.length >= 5);
});
