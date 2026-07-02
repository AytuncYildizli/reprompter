#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");

function normalizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

function buildRecipeVector(recipe = {}) {
  return {
    templateId: normalizeString(recipe.templateId),
    patterns: normalizeArray(recipe.patterns),
    capabilityTier: normalizeString(recipe.capabilityTier),
    domain: normalizeString(recipe.domain),
    contextLayers: Number(recipe.contextLayers || 0),
    qualityBucket: quantizeBucket(Number(recipe.qualityScore || 0)),
  };
}

function quantizeBucket(score) {
  if (score >= 9) return "excellent";
  if (score >= 7) return "good";
  if (score >= 5) return "fair";
  if (score >= 3) return "weak";
  return "poor";
}

function hashVector(vector) {
  const canonical = JSON.stringify(vector);
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function fingerprint(recipe = {}) {
  const vector = buildRecipeVector(recipe);
  const hash = hashVector(vector);

  const patternSummary =
    vector.patterns.length > 0
      ? vector.patterns.join("+")
      : "none";

  const readable = [
    vector.templateId || "generic",
    vector.domain || "general",
    vector.capabilityTier || "default",
    `L${vector.contextLayers}`,
    vector.qualityBucket,
    patternSummary,
  ].join("/");

  return {
    hash,
    vector,
    readable,
  };
}

function isSameRecipe(fpA, fpB) {
  return fpA.hash === fpB.hash;
}

function recipeSimilarity(vectorA, vectorB) {
  let matches = 0;
  let total = 0;

  // Template match
  total++;
  if (vectorA.templateId === vectorB.templateId) matches++;

  // Domain match
  total++;
  if (vectorA.domain === vectorB.domain) matches++;

  // Capability tier match
  total++;
  if (vectorA.capabilityTier === vectorB.capabilityTier) matches++;

  // Quality bucket match
  total++;
  if (vectorA.qualityBucket === vectorB.qualityBucket) matches++;

  // Context layers proximity
  total++;
  if (Math.abs(vectorA.contextLayers - vectorB.contextLayers) <= 1) matches++;

  // Pattern overlap (Jaccard)
  const setA = new Set(vectorA.patterns);
  const setB = new Set(vectorB.patterns);
  const union = new Set([...setA, ...setB]);
  const intersection = [...setA].filter((p) => setB.has(p));
  if (union.size > 0) {
    total++;
    matches += intersection.length / union.size;
  }

  return total > 0 ? Number((matches / total).toFixed(4)) : 0;
}

module.exports = {
  fingerprint,
  isSameRecipe,
  recipeSimilarity,
  buildRecipeVector,
  quantizeBucket,
};

if (require.main === module) {
  const sample = {
    templateId: "security-template",
    patterns: ["constraint-first-framing", "uncertainty-labeling"],
    capabilityTier: "reasoning_high",
    domain: "security",
    contextLayers: 4,
    qualityScore: 8.5,
  };
  process.stdout.write(`${JSON.stringify(fingerprint(sample), null, 2)}\n`);
}
