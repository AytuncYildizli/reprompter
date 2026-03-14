#!/usr/bin/env node
"use strict";

const { recipeSimilarity } = require("./recipe-fingerprint");
const { createOutcomeStore } = require("./outcome-collector");

const MIN_SAMPLES = 2;
const SIMILARITY_THRESHOLD = 0.5;
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function timeDecay(outcomeTimestamp, now = Date.now()) {
  const age = now - new Date(outcomeTimestamp).getTime();
  if (age <= 0) return 1.0;
  return Math.pow(0.5, age / DECAY_HALF_LIFE_MS);
}

function groupByRecipeHash(outcomes) {
  const groups = {};
  for (const outcome of outcomes) {
    const hash = outcome.recipe && outcome.recipe.hash;
    if (!hash) continue;
    if (!groups[hash]) {
      groups[hash] = {
        hash,
        recipe: outcome.recipe,
        outcomes: [],
      };
    }
    groups[hash].outcomes.push(outcome);
  }
  return groups;
}

function scoreRecipeGroup(group, now = Date.now()) {
  if (!group.outcomes || group.outcomes.length === 0) {
    return { score: 0, sampleCount: 0, confidence: "none" };
  }

  let weightedSum = 0;
  let weightTotal = 0;

  for (const outcome of group.outcomes) {
    const decay = timeDecay(outcome.timestamp, now);
    const effectiveness = Number(outcome.effectivenessScore || 5);
    weightedSum += effectiveness * decay;
    weightTotal += decay;
  }

  const score = weightTotal > 0
    ? Number((weightedSum / weightTotal).toFixed(2))
    : 0;

  const sampleCount = group.outcomes.length;
  const confidence =
    sampleCount >= 10 ? "high" :
    sampleCount >= 5 ? "medium" :
    sampleCount >= MIN_SAMPLES ? "low" :
    "insufficient";

  return { score, sampleCount, confidence };
}

function findSimilarRecipes(targetVector, outcomes, threshold = SIMILARITY_THRESHOLD) {
  const matched = [];

  for (const outcome of outcomes) {
    if (!outcome.recipe || !outcome.recipe.vector) continue;
    const sim = recipeSimilarity(targetVector, outcome.recipe.vector);
    if (sim >= threshold) {
      matched.push({ ...outcome, _similarity: sim });
    }
  }

  return matched.sort((a, b) => b._similarity - a._similarity);
}

function recommendStrategy(targetVector, options = {}) {
  const store = options.store || createOutcomeStore({ rootDir: options.rootDir });
  const outcomes = store.readOutcomes({
    domain: options.domain || targetVector.domain,
    limit: options.limit || 200,
  });

  if (outcomes.length === 0) {
    return {
      hasData: false,
      recommendation: null,
      alternatives: [],
      message: "No historical outcome data yet. The flywheel will start learning after your first completed run.",
    };
  }

  // Find outcomes with similar recipes
  const similar = findSimilarRecipes(
    targetVector,
    outcomes,
    options.similarityThreshold || SIMILARITY_THRESHOLD
  );

  if (similar.length < MIN_SAMPLES) {
    return {
      hasData: true,
      recommendation: null,
      alternatives: [],
      totalOutcomes: outcomes.length,
      similarCount: similar.length,
      message: `Found ${similar.length} similar outcomes but need at least ${MIN_SAMPLES} for a recommendation.`,
    };
  }

  // Group by recipe hash and score each group
  const groups = groupByRecipeHash(similar);
  const now = Date.now();
  const scored = Object.values(groups)
    .map((group) => ({
      ...group,
      ...scoreRecipeGroup(group, now),
    }))
    .filter((g) => g.sampleCount >= MIN_SAMPLES)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      hasData: true,
      recommendation: null,
      alternatives: [],
      totalOutcomes: outcomes.length,
      similarCount: similar.length,
      message: "Not enough repeated recipe patterns to make a recommendation yet.",
    };
  }

  const best = scored[0];
  const alternatives = scored.slice(1, 4);

  return {
    hasData: true,
    recommendation: {
      recipeHash: best.hash,
      recipe: best.recipe,
      score: best.score,
      sampleCount: best.sampleCount,
      confidence: best.confidence,
      summary: formatRecommendation(best),
    },
    alternatives: alternatives.map((alt) => ({
      recipeHash: alt.hash,
      recipe: alt.recipe,
      score: alt.score,
      sampleCount: alt.sampleCount,
      confidence: alt.confidence,
    })),
    totalOutcomes: outcomes.length,
    similarCount: similar.length,
  };
}

function formatRecommendation(group) {
  const readable = group.recipe && group.recipe.readable
    ? group.recipe.readable
    : group.hash;
  return `Recipe "${readable}" scored ${group.score}/10 across ${group.sampleCount} similar runs (confidence: ${group.confidence}).`;
}

function buildFlywheelReport(options = {}) {
  const store = options.store || createOutcomeStore({ rootDir: options.rootDir });
  const outcomes = store.readOutcomes({ limit: options.limit || 500 });

  if (outcomes.length === 0) {
    return {
      totalOutcomes: 0,
      recipeGroups: 0,
      topRecipes: [],
      averageEffectiveness: 0,
      message: "No outcome data collected yet.",
    };
  }

  const groups = groupByRecipeHash(outcomes);
  const now = Date.now();
  const scored = Object.values(groups)
    .map((group) => ({
      hash: group.hash,
      readable: group.recipe && group.recipe.readable,
      ...scoreRecipeGroup(group, now),
    }))
    .sort((a, b) => b.score - a.score);

  const totalEffectiveness = outcomes.reduce(
    (sum, o) => sum + Number(o.effectivenessScore || 0),
    0
  );

  return {
    totalOutcomes: outcomes.length,
    recipeGroups: scored.length,
    topRecipes: scored.slice(0, 10),
    averageEffectiveness: Number((totalEffectiveness / outcomes.length).toFixed(2)),
  };
}

function bestRecipeForDomain(domain, options = {}) {
  const store = options.store || createOutcomeStore({ rootDir: options.rootDir });
  const outcomes = store.readOutcomes({
    domain: domain || undefined,
    limit: options.limit || 200,
  });

  if (outcomes.length < MIN_SAMPLES) {
    return { found: false, bias: null };
  }

  const groups = groupByRecipeHash(outcomes);
  const now = Date.now();
  const scored = Object.values(groups)
    .map((group) => ({
      ...group,
      ...scoreRecipeGroup(group, now),
    }))
    .filter((g) => g.sampleCount >= MIN_SAMPLES && g.confidence !== "insufficient")
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { found: false, bias: null };
  }

  const best = scored[0];
  const vector = best.recipe && best.recipe.vector;
  if (!vector) {
    return { found: false, bias: null };
  }

  return {
    found: true,
    bias: {
      preferPatterns: vector.patterns || [],
      preferTier: vector.capabilityTier || null,
      preferTemplate: vector.templateId || null,
      score: best.score,
      confidence: best.confidence,
      sampleCount: best.sampleCount,
      recipeHash: best.hash,
    },
  };
}

function applyFlywheelBias(bias, currentPatternIds = [], options = {}) {
  if (!bias || !bias.found || !bias.bias) {
    return { applied: false, patterns: currentPatternIds, tier: null, changes: [] };
  }

  const rec = bias.bias;
  const minConfidence = options.minConfidence || "medium";
  const confidenceRank = { insufficient: 0, none: 0, low: 1, medium: 2, high: 3 };

  if ((confidenceRank[rec.confidence] || 0) < (confidenceRank[minConfidence] || 2)) {
    return {
      applied: false,
      patterns: currentPatternIds,
      tier: null,
      changes: [],
      reason: `confidence ${rec.confidence} below threshold ${minConfidence}`,
    };
  }

  const changes = [];
  const currentSet = new Set(currentPatternIds.map((p) => p.toLowerCase()));
  const mergedPatterns = [...currentPatternIds];

  // Add recommended patterns that aren't already selected
  for (const pattern of rec.preferPatterns) {
    if (!currentSet.has(pattern.toLowerCase())) {
      mergedPatterns.push(pattern);
      changes.push(`+pattern:${pattern}`);
    }
  }

  // Tier preference (only at high confidence)
  let preferTier = null;
  if (rec.confidence === "high" && rec.preferTier) {
    preferTier = rec.preferTier;
    changes.push(`prefer-tier:${rec.preferTier}`);
  }

  return {
    applied: changes.length > 0,
    patterns: mergedPatterns,
    tier: preferTier,
    changes,
    score: rec.score,
    confidence: rec.confidence,
  };
}

module.exports = {
  recommendStrategy,
  bestRecipeForDomain,
  applyFlywheelBias,
  buildFlywheelReport,
  findSimilarRecipes,
  groupByRecipeHash,
  scoreRecipeGroup,
  timeDecay,
};

if (require.main === module) {
  const report = buildFlywheelReport();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
