#!/usr/bin/env node
"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {
  createOutcomeStore,
  validateOutcome,
  sanitizeSignals,
  computeEffectiveness,
} = require("./outcome-collector");
const { fingerprint } = require("./recipe-fingerprint");

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt-outcome-test-"));
  return createOutcomeStore({ rootDir: dir, dirPath: dir });
}

function sampleOutcome(overrides = {}) {
  const recipe = fingerprint({
    templateId: "security-template",
    patterns: ["constraint-first-framing"],
    capabilityTier: "reasoning_high",
    domain: "security",
    contextLayers: 4,
    qualityScore: 8.5,
  });
  return {
    runId: "rpt-test-1",
    taskId: "audit-auth",
    recipe,
    signals: {
      artifactScore: 8.5,
      artifactPass: true,
      retryCount: 0,
      filesChanged: 3,
      insertions: 120,
      deletions: 15,
    },
    ...overrides,
  };
}

describe("outcome-collector", () => {
  const stores = [];
  afterEach(() => {
    for (const store of stores) {
      try { fs.rmSync(store.dirPath, { recursive: true, force: true }); } catch {}
    }
    stores.length = 0;
  });

  describe("createOutcomeStore()", () => {
    it("creates store with correct file path", () => {
      const store = tmpStore();
      stores.push(store);
      assert.ok(store.filePath.endsWith("outcomes.ndjson"));
    });

    it("writes and reads outcomes", () => {
      const store = tmpStore();
      stores.push(store);
      store.writeOutcome(sampleOutcome());
      store.writeOutcome(sampleOutcome({ runId: "rpt-test-2" }));
      const outcomes = store.readOutcomes();
      assert.strictEqual(outcomes.length, 2);
    });

    it("filters by domain", () => {
      const store = tmpStore();
      stores.push(store);
      store.writeOutcome(sampleOutcome());
      const securityOutcomes = store.readOutcomes({ domain: "security" });
      const marketingOutcomes = store.readOutcomes({ domain: "marketing" });
      assert.strictEqual(securityOutcomes.length, 1);
      assert.strictEqual(marketingOutcomes.length, 0);
    });

    it("respects limit", () => {
      const store = tmpStore();
      stores.push(store);
      for (let i = 0; i < 5; i++) {
        store.writeOutcome(sampleOutcome({ runId: `rpt-test-${i}` }));
      }
      const outcomes = store.readOutcomes({ limit: 3 });
      assert.strictEqual(outcomes.length, 3);
    });

    it("clears all outcomes", () => {
      const store = tmpStore();
      stores.push(store);
      store.writeOutcome(sampleOutcome());
      assert.strictEqual(store.readOutcomes().length, 1);
      store.clear();
      assert.strictEqual(store.readOutcomes().length, 0);
    });

    it("returns empty array for missing file", () => {
      const store = tmpStore();
      stores.push(store);
      assert.deepStrictEqual(store.readOutcomes(), []);
    });
  });

  describe("validateOutcome()", () => {
    it("accepts valid outcome", () => {
      const result = validateOutcome(sampleOutcome());
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("rejects missing runId", () => {
      const result = validateOutcome(sampleOutcome({ runId: "" }));
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("runId")));
    });

    it("rejects missing recipe", () => {
      const result = validateOutcome({ runId: "x", taskId: "y", signals: {} });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("recipe")));
    });

    it("auto-computes effectiveness when not provided", () => {
      const result = validateOutcome(sampleOutcome());
      assert.ok(Number.isFinite(result.outcome.effectivenessScore));
    });
  });

  describe("sanitizeSignals()", () => {
    it("keeps valid signals", () => {
      const signals = sanitizeSignals({
        artifactScore: 9.0,
        artifactPass: true,
        retryCount: 1,
        filesChanged: 5,
        userVerdict: "accept",
      });
      assert.strictEqual(signals.artifactScore, 9.0);
      assert.strictEqual(signals.artifactPass, true);
      assert.strictEqual(signals.retryCount, 1);
      assert.strictEqual(signals.filesChanged, 5);
      assert.strictEqual(signals.userVerdict, "accept");
    });

    it("strips invalid signals", () => {
      const signals = sanitizeSignals({
        artifactScore: "not-a-number",
        userVerdict: "maybe",
        extraField: "ignored",
      });
      assert.strictEqual(signals.artifactScore, undefined);
      assert.strictEqual(signals.userVerdict, undefined);
      assert.strictEqual(signals.extraField, undefined);
    });

    it("clamps negative values to zero", () => {
      const signals = sanitizeSignals({
        retryCount: -2,
        filesChanged: -1,
        executionMs: -100,
      });
      assert.strictEqual(signals.retryCount, 0);
      assert.strictEqual(signals.filesChanged, 0);
      assert.strictEqual(signals.executionMs, 0);
    });
  });

  describe("computeEffectiveness()", () => {
    it("uses artifact score as base", () => {
      const score = computeEffectiveness({ artifactScore: 9.0 });
      assert.ok(score >= 9.0, `Expected >= 9.0, got ${score}`);
    });

    it("penalizes retries", () => {
      const noRetry = computeEffectiveness({ artifactScore: 8.0, retryCount: 0 });
      const withRetry = computeEffectiveness({ artifactScore: 8.0, retryCount: 2 });
      assert.ok(noRetry > withRetry, "retries should lower score");
    });

    it("bonus for first-attempt pass", () => {
      const firstAttempt = computeEffectiveness({
        artifactScore: 8.0,
        artifactPass: true,
        retryCount: 0,
      });
      const secondAttempt = computeEffectiveness({
        artifactScore: 8.0,
        artifactPass: true,
        retryCount: 1,
      });
      assert.ok(firstAttempt > secondAttempt);
    });

    it("reject verdict caps score", () => {
      const score = computeEffectiveness({
        artifactScore: 9.0,
        userVerdict: "reject",
      });
      assert.ok(score <= 3.0, `Expected <= 3.0, got ${score}`);
    });

    it("accept verdict floors score", () => {
      const score = computeEffectiveness({
        artifactScore: 4.0,
        userVerdict: "accept",
      });
      assert.ok(score >= 7.0, `Expected >= 7.0, got ${score}`);
    });

    it("clamps to 0-10 range", () => {
      const low = computeEffectiveness({ artifactScore: 0, retryCount: 5, postCorrectionEdits: 10 });
      const high = computeEffectiveness({ artifactScore: 10, artifactPass: true, retryCount: 0 });
      assert.ok(low >= 0);
      assert.ok(high <= 10);
    });
  });
});
