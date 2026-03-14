#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  fingerprint,
  isSameRecipe,
  recipeSimilarity,
  buildRecipeVector,
  quantizeBucket,
} = require("./recipe-fingerprint");

describe("recipe-fingerprint", () => {
  const sampleRecipe = {
    templateId: "security-template",
    patterns: ["constraint-first-framing", "uncertainty-labeling"],
    capabilityTier: "reasoning_high",
    domain: "security",
    contextLayers: 4,
    qualityScore: 8.5,
  };

  describe("fingerprint()", () => {
    it("returns hash, vector, and readable summary", () => {
      const fp = fingerprint(sampleRecipe);
      assert.ok(fp.hash, "hash should exist");
      assert.strictEqual(typeof fp.hash, "string");
      assert.strictEqual(fp.hash.length, 16, "hash should be 16 hex chars");
      assert.ok(fp.vector, "vector should exist");
      assert.ok(fp.readable, "readable should exist");
    });

    it("produces deterministic hashes for same input", () => {
      const fp1 = fingerprint(sampleRecipe);
      const fp2 = fingerprint({ ...sampleRecipe });
      assert.strictEqual(fp1.hash, fp2.hash);
    });

    it("produces different hashes for different inputs", () => {
      const fp1 = fingerprint(sampleRecipe);
      const fp2 = fingerprint({ ...sampleRecipe, templateId: "bugfix-template" });
      assert.notStrictEqual(fp1.hash, fp2.hash);
    });

    it("normalizes pattern order", () => {
      const fp1 = fingerprint({
        ...sampleRecipe,
        patterns: ["uncertainty-labeling", "constraint-first-framing"],
      });
      const fp2 = fingerprint(sampleRecipe);
      assert.strictEqual(fp1.hash, fp2.hash, "order should not matter");
    });

    it("normalizes case in all string fields", () => {
      const fp1 = fingerprint(sampleRecipe);
      const fp2 = fingerprint({
        ...sampleRecipe,
        templateId: "SECURITY-TEMPLATE",
        domain: "SECURITY",
        capabilityTier: "REASONING_HIGH",
      });
      assert.strictEqual(fp1.hash, fp2.hash);
    });

    it("handles empty recipe gracefully", () => {
      const fp = fingerprint({});
      assert.ok(fp.hash);
      assert.strictEqual(fp.vector.templateId, "");
      assert.deepStrictEqual(fp.vector.patterns, []);
    });
  });

  describe("quantizeBucket()", () => {
    it("maps scores to correct buckets", () => {
      assert.strictEqual(quantizeBucket(9.5), "excellent");
      assert.strictEqual(quantizeBucket(9.0), "excellent");
      assert.strictEqual(quantizeBucket(8.0), "good");
      assert.strictEqual(quantizeBucket(7.0), "good");
      assert.strictEqual(quantizeBucket(6.0), "fair");
      assert.strictEqual(quantizeBucket(5.0), "fair");
      assert.strictEqual(quantizeBucket(4.0), "weak");
      assert.strictEqual(quantizeBucket(3.0), "weak");
      assert.strictEqual(quantizeBucket(2.0), "poor");
      assert.strictEqual(quantizeBucket(0), "poor");
    });
  });

  describe("isSameRecipe()", () => {
    it("returns true for identical fingerprints", () => {
      const fp1 = fingerprint(sampleRecipe);
      const fp2 = fingerprint(sampleRecipe);
      assert.strictEqual(isSameRecipe(fp1, fp2), true);
    });

    it("returns false for different fingerprints", () => {
      const fp1 = fingerprint(sampleRecipe);
      const fp2 = fingerprint({ ...sampleRecipe, domain: "ops" });
      assert.strictEqual(isSameRecipe(fp1, fp2), false);
    });
  });

  describe("recipeSimilarity()", () => {
    it("returns 1.0 for identical vectors", () => {
      const v = buildRecipeVector(sampleRecipe);
      assert.strictEqual(recipeSimilarity(v, v), 1);
    });

    it("returns high similarity for similar vectors", () => {
      const v1 = buildRecipeVector(sampleRecipe);
      const v2 = buildRecipeVector({ ...sampleRecipe, qualityScore: 8.0 });
      const sim = recipeSimilarity(v1, v2);
      assert.ok(sim > 0.8, `Expected >0.8, got ${sim}`);
    });

    it("returns low similarity for different domains", () => {
      const v1 = buildRecipeVector(sampleRecipe);
      const v2 = buildRecipeVector({
        ...sampleRecipe,
        domain: "marketing",
        templateId: "marketing-swarm-template",
        capabilityTier: "cost_optimized",
        patterns: [],
      });
      const sim = recipeSimilarity(v1, v2);
      assert.ok(sim < 0.5, `Expected <0.5, got ${sim}`);
    });

    it("handles empty patterns correctly", () => {
      const v1 = buildRecipeVector({ ...sampleRecipe, patterns: [] });
      const v2 = buildRecipeVector({ ...sampleRecipe, patterns: [] });
      const sim = recipeSimilarity(v1, v2);
      assert.strictEqual(sim, 1);
    });
  });

  describe("buildRecipeVector()", () => {
    it("normalizes all fields", () => {
      const v = buildRecipeVector({
        templateId: "  Feature-Template  ",
        patterns: ["B", "A", "", null],
        capabilityTier: "Reasoning_High",
        domain: "SECURITY",
        contextLayers: 3,
        qualityScore: 7.5,
      });

      assert.strictEqual(v.templateId, "feature-template");
      assert.deepStrictEqual(v.patterns, ["a", "b"]);
      assert.strictEqual(v.capabilityTier, "reasoning_high");
      assert.strictEqual(v.domain, "security");
      assert.strictEqual(v.contextLayers, 3);
      assert.strictEqual(v.qualityBucket, "good");
    });
  });
});
