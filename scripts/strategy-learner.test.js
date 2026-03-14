#!/usr/bin/env node
"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createOutcomeStore } = require("./outcome-collector");
const { fingerprint } = require("./recipe-fingerprint");
const {
  recommendStrategy,
  bestRecipeForDomain,
  applyFlywheelBias,
  buildFlywheelReport,
  findSimilarRecipes,
  groupByRecipeHash,
  scoreRecipeGroup,
  timeDecay,
} = require("./strategy-learner");

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-strategy-test-"));
  return createOutcomeStore({ rootDir: dir, dirPath: dir });
}

function makeOutcome(recipeOverrides = {}, signalOverrides = {}, extra = {}) {
  const recipe = fingerprint({
    templateId: "security-template",
    patterns: ["constraint-first-framing"],
    capabilityTier: "reasoning_high",
    domain: "security",
    contextLayers: 4,
    qualityScore: 8.5,
    ...recipeOverrides,
  });
  return {
    timestamp: extra.timestamp || new Date().toISOString(),
    runId: extra.runId || `rpt-test-${Math.random().toString(36).slice(2, 8)}`,
    taskId: extra.taskId || "test-task",
    recipe,
    signals: {
      artifactScore: 8.5,
      artifactPass: true,
      retryCount: 0,
      ...signalOverrides,
    },
    effectivenessScore: extra.effectivenessScore || 8.5,
  };
}

describe("strategy-learner", () => {
  const stores = [];
  afterEach(() => {
    for (const store of stores) {
      try { fs.rmSync(store.dirPath, { recursive: true, force: true }); } catch {}
    }
    stores.length = 0;
  });

  describe("timeDecay()", () => {
    it("returns 1.0 for current timestamp", () => {
      const decay = timeDecay(new Date().toISOString());
      assert.ok(decay > 0.99 && decay <= 1.0);
    });

    it("returns ~0.5 after one half-life (7 days)", () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const decay = timeDecay(sevenDaysAgo);
      assert.ok(Math.abs(decay - 0.5) < 0.01, `Expected ~0.5, got ${decay}`);
    });

    it("returns small value for old timestamps", () => {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const decay = timeDecay(monthAgo);
      assert.ok(decay < 0.1, `Expected <0.1, got ${decay}`);
    });
  });

  describe("groupByRecipeHash()", () => {
    it("groups outcomes by recipe hash", () => {
      const o1 = makeOutcome();
      const o2 = makeOutcome();
      const o3 = makeOutcome({ domain: "ops" });
      const groups = groupByRecipeHash([o1, o2, o3]);
      const keys = Object.keys(groups);
      assert.strictEqual(keys.length, 2, "should have 2 distinct groups");
    });

    it("handles outcomes without recipe hash", () => {
      const groups = groupByRecipeHash([{ recipe: {} }, { recipe: null }]);
      assert.strictEqual(Object.keys(groups).length, 0);
    });
  });

  describe("scoreRecipeGroup()", () => {
    it("returns weighted average score", () => {
      const group = {
        outcomes: [
          makeOutcome({}, {}, { effectivenessScore: 8.0 }),
          makeOutcome({}, {}, { effectivenessScore: 9.0 }),
        ],
      };
      const result = scoreRecipeGroup(group);
      assert.ok(result.score >= 8.0 && result.score <= 9.0);
      assert.strictEqual(result.sampleCount, 2);
      assert.strictEqual(result.confidence, "low");
    });

    it("returns high confidence for 10+ samples", () => {
      const outcomes = [];
      for (let i = 0; i < 10; i++) {
        outcomes.push(makeOutcome({}, {}, { effectivenessScore: 8.0 }));
      }
      const result = scoreRecipeGroup({ outcomes });
      assert.strictEqual(result.confidence, "high");
    });

    it("handles empty group", () => {
      const result = scoreRecipeGroup({ outcomes: [] });
      assert.strictEqual(result.score, 0);
      assert.strictEqual(result.confidence, "none");
    });
  });

  describe("findSimilarRecipes()", () => {
    it("finds outcomes with similar recipe vectors", () => {
      const target = fingerprint({
        templateId: "security-template",
        domain: "security",
        capabilityTier: "reasoning_high",
        patterns: ["constraint-first-framing"],
        contextLayers: 4,
        qualityScore: 8.0,
      }).vector;

      const outcomes = [
        makeOutcome({ qualityScore: 8.5 }),
        makeOutcome({ domain: "marketing", templateId: "marketing-swarm-template" }),
      ];

      const similar = findSimilarRecipes(target, outcomes, 0.5);
      assert.ok(similar.length >= 1, "should find at least 1 similar");
      assert.ok(similar[0]._similarity > 0.5);
    });

    it("returns empty for no matches", () => {
      const target = fingerprint({
        templateId: "marketing-swarm-template",
        domain: "marketing",
        capabilityTier: "cost_optimized",
        patterns: [],
        contextLayers: 1,
        qualityScore: 5.0,
      }).vector;

      const outcomes = [makeOutcome()];
      const similar = findSimilarRecipes(target, outcomes, 0.9);
      assert.strictEqual(similar.length, 0);
    });
  });

  describe("recommendStrategy()", () => {
    it("returns no-data message for empty store", () => {
      const store = tmpStore();
      stores.push(store);
      const target = fingerprint({ domain: "security" }).vector;
      const result = recommendStrategy(target, { store });
      assert.strictEqual(result.hasData, false);
      assert.strictEqual(result.recommendation, null);
    });

    it("returns recommendation when enough similar outcomes exist", () => {
      const store = tmpStore();
      stores.push(store);

      // Write 3 outcomes with same recipe
      for (let i = 0; i < 3; i++) {
        store.writeOutcome(makeOutcome({}, {}, { effectivenessScore: 8.5 }));
      }

      const target = fingerprint({
        templateId: "security-template",
        domain: "security",
        capabilityTier: "reasoning_high",
        patterns: ["constraint-first-framing"],
        contextLayers: 4,
        qualityScore: 8.5,
      }).vector;

      const result = recommendStrategy(target, { store, domain: "security" });
      assert.strictEqual(result.hasData, true);
      assert.ok(result.recommendation, "should have a recommendation");
      assert.ok(result.recommendation.score > 0);
      assert.ok(result.recommendation.summary.length > 0);
    });

    it("returns alternatives when multiple recipe groups exist", () => {
      const store = tmpStore();
      stores.push(store);

      // Group 1: security with high quality
      for (let i = 0; i < 3; i++) {
        store.writeOutcome(
          makeOutcome(
            { qualityScore: 9.0 },
            { artifactScore: 9.0 },
            { effectivenessScore: 9.0 }
          )
        );
      }

      // Group 2: security with different patterns
      for (let i = 0; i < 3; i++) {
        store.writeOutcome(
          makeOutcome(
            { patterns: ["self-critique-checkpoint", "delta-retry-scaffold"], qualityScore: 7.0 },
            { artifactScore: 7.0 },
            { effectivenessScore: 7.0 }
          )
        );
      }

      const target = fingerprint({
        templateId: "security-template",
        domain: "security",
        capabilityTier: "reasoning_high",
        contextLayers: 4,
        qualityScore: 8.0,
      }).vector;

      const result = recommendStrategy(target, { store, domain: "security", similarityThreshold: 0.3 });
      assert.strictEqual(result.hasData, true);
      assert.ok(result.recommendation);
      assert.ok(result.recommendation.score >= 7.0);
    });
  });

  describe("bestRecipeForDomain()", () => {
    it("returns not found for empty store", () => {
      const store = tmpStore();
      stores.push(store);
      const result = bestRecipeForDomain("security", { store });
      assert.strictEqual(result.found, false);
      assert.strictEqual(result.bias, null);
    });

    it("returns bias with patterns and tier for domain with enough data", () => {
      const store = tmpStore();
      stores.push(store);
      for (let i = 0; i < 3; i++) {
        store.writeOutcome(makeOutcome({}, {}, { effectivenessScore: 9.0 }));
      }
      const result = bestRecipeForDomain("security", { store });
      assert.strictEqual(result.found, true);
      assert.ok(result.bias);
      assert.ok(Array.isArray(result.bias.preferPatterns));
      assert.ok(result.bias.preferTier);
      assert.ok(result.bias.score > 0);
      assert.ok(result.bias.confidence);
    });

    it("returns not found when fewer than MIN_SAMPLES outcomes", () => {
      const store = tmpStore();
      stores.push(store);
      store.writeOutcome(makeOutcome({}, {}, { effectivenessScore: 9.0 }));
      const result = bestRecipeForDomain("security", { store });
      assert.strictEqual(result.found, false);
    });
  });

  describe("applyFlywheelBias()", () => {
    it("returns not applied when no bias found", () => {
      const result = applyFlywheelBias(null, ["pattern-a"]);
      assert.strictEqual(result.applied, false);
      assert.deepStrictEqual(result.patterns, ["pattern-a"]);
    });

    it("returns not applied when confidence below threshold", () => {
      const bias = {
        found: true,
        bias: {
          preferPatterns: ["new-pattern"],
          preferTier: "reasoning_high",
          confidence: "low",
          score: 8.0,
          sampleCount: 2,
        },
      };
      const result = applyFlywheelBias(bias, ["existing"], { minConfidence: "medium" });
      assert.strictEqual(result.applied, false);
    });

    it("merges new patterns at medium confidence", () => {
      const bias = {
        found: true,
        bias: {
          preferPatterns: ["new-pattern", "existing"],
          preferTier: "reasoning_high",
          confidence: "medium",
          score: 8.5,
          sampleCount: 5,
        },
      };
      const result = applyFlywheelBias(bias, ["existing"], { minConfidence: "medium" });
      assert.strictEqual(result.applied, true);
      assert.ok(result.patterns.includes("new-pattern"));
      assert.ok(result.patterns.includes("existing"));
      assert.strictEqual(result.tier, null, "tier not set at medium confidence");
    });

    it("sets tier preference at high confidence", () => {
      const bias = {
        found: true,
        bias: {
          preferPatterns: ["extra"],
          preferTier: "cost_optimized",
          confidence: "high",
          score: 9.0,
          sampleCount: 12,
        },
      };
      const result = applyFlywheelBias(bias, [], { minConfidence: "medium" });
      assert.strictEqual(result.applied, true);
      assert.strictEqual(result.tier, "cost_optimized");
    });

    it("does not duplicate existing patterns", () => {
      const bias = {
        found: true,
        bias: {
          preferPatterns: ["constraint-first-framing"],
          preferTier: null,
          confidence: "medium",
          score: 7.0,
          sampleCount: 6,
        },
      };
      const result = applyFlywheelBias(bias, ["constraint-first-framing"]);
      assert.strictEqual(result.applied, false, "no new patterns to add");
    });
  });

  describe("buildFlywheelReport()", () => {
    it("returns empty report for no data", () => {
      const store = tmpStore();
      stores.push(store);
      const report = buildFlywheelReport({ store });
      assert.strictEqual(report.totalOutcomes, 0);
      assert.strictEqual(report.recipeGroups, 0);
    });

    it("returns summary report with outcomes", () => {
      const store = tmpStore();
      stores.push(store);

      for (let i = 0; i < 5; i++) {
        store.writeOutcome(makeOutcome({}, {}, { effectivenessScore: 8.0 }));
      }

      const report = buildFlywheelReport({ store });
      assert.strictEqual(report.totalOutcomes, 5);
      assert.ok(report.recipeGroups >= 1);
      assert.ok(report.topRecipes.length >= 1);
      assert.ok(report.averageEffectiveness > 0);
    });
  });
});
