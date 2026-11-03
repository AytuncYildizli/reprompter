#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { recipeSimilarity, quantizeBucket } = require("./recipe-fingerprint");
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

function normalizeTaskType(taskType) {
  return String(taskType || "").trim().toLowerCase();
}

// Build a prompt-shape "target" for similarity comparison. Returns the
// vector plus a `specified` Set listing which fields the caller
// actually provided, so the partial-similarity function can treat
// unspecified fields as wildcards instead of hardcoded defaults
// (codex PR #39 P2).
function buildPromptShapeVector(taskType, promptShape = {}) {
  const specified = new Set(["templateId"]); // always set by taskType
  if (promptShape.patterns !== undefined && promptShape.patterns !== null) specified.add("patterns");
  if (promptShape.capabilityTier !== undefined && promptShape.capabilityTier !== null) specified.add("capabilityTier");
  if (promptShape.domain !== undefined && promptShape.domain !== null) specified.add("domain");
  if (Number.isFinite(promptShape.contextLayers)) specified.add("contextLayers");
  if (Number.isFinite(promptShape.qualityScore)) specified.add("qualityBucket");

  const vector = {
    templateId: normalizeTaskType(taskType),
    patterns: Array.isArray(promptShape.patterns)
      ? promptShape.patterns.map((pattern) => String(pattern || "").trim().toLowerCase()).filter(Boolean)
      : [],
    capabilityTier: String(promptShape.capabilityTier || "default").trim().toLowerCase(),
    domain: String(promptShape.domain || "").trim().toLowerCase(),
    contextLayers: Number.isFinite(promptShape.contextLayers) ? Number(promptShape.contextLayers) : 1,
    qualityBucket: quantizeBucket(
      Number.isFinite(promptShape.qualityScore) ? promptShape.qualityScore : 7
    ),
  };

  return { vector, specified };
}

// Similarity over only the explicitly-specified fields of the target
// vector. Unspecified fields are treated as wildcards (contribute
// nothing to the denominator). If the caller specified only taskType,
// every outcome matching that taskType gets similarity 1.0 — refinement
// becomes a no-op, matching the natural meaning of "no shape hint".
function promptShapeSimilarity(target, other, specified) {
  let matches = 0;
  let total = 0;
  if (specified.has("templateId")) {
    total++;
    if (target.templateId === other.templateId) matches++;
  }
  if (specified.has("domain")) {
    total++;
    if (target.domain === other.domain) matches++;
  }
  if (specified.has("capabilityTier")) {
    total++;
    if (target.capabilityTier === other.capabilityTier) matches++;
  }
  if (specified.has("qualityBucket")) {
    total++;
    if (target.qualityBucket === other.qualityBucket) matches++;
  }
  if (specified.has("contextLayers")) {
    total++;
    if (Math.abs(target.contextLayers - other.contextLayers) <= 1) matches++;
  }
  if (specified.has("patterns")) {
    const setA = new Set(target.patterns);
    const setB = new Set(other.patterns);
    const union = new Set([...setA, ...setB]);
    if (union.size > 0) {
      total++;
      const intersection = [...setA].filter((p) => setB.has(p));
      matches += intersection.length / union.size;
    }
  }
  return total > 0 ? Number((matches / total).toFixed(4)) : 1;
}

// Upper bound on how many task-matching outcomes we'll consider for a
// single recommendation. Set well above any realistic per-taskType
// volume so we don't have to worry about windowing edge cases.
const GET_RECOMMENDATION_DEFAULT_LIMIT = 1000;

function getRecommendation(options = {}) {
  const taskType = normalizeTaskType(options.taskType);
  if (!taskType) {
    throw new Error("getRecommendation: taskType is required");
  }

  // Codex PR #39 P1: read the whole store, then filter by taskType.
  // The previous implementation applied the read-limit BEFORE the
  // taskType filter, so a store dominated by other task types could
  // drop all matching outcomes and return null despite historical
  // data. Filtering first keeps recommendations stable as the store
  // grows.
  const store = options.store || createOutcomeStore({ rootDir: options.rootDir });
  const outcomes = store.readOutcomes({ limit: Number.MAX_SAFE_INTEGER });
  const allTaskMatches = outcomes.filter(
    (outcome) => outcome.recipe && outcome.recipe.vector && outcome.recipe.vector.templateId === taskType
  );

  // Apply the caller's limit to the task-matching slice specifically,
  // defaulting to GET_RECOMMENDATION_DEFAULT_LIMIT. Most recent first
  // (existing readOutcomes semantics).
  const taskLimit = Number.isFinite(options.limit) && options.limit > 0
    ? options.limit
    : GET_RECOMMENDATION_DEFAULT_LIMIT;
  const taskMatches = allTaskMatches.slice(-taskLimit);

  if (taskMatches.length < MIN_SAMPLES) {
    return null;
  }

  let candidateOutcomes = taskMatches;
  const hasPromptShape = options.promptShape && Object.keys(options.promptShape).length > 0;
  if (hasPromptShape) {
    const { vector: targetVector, specified } = buildPromptShapeVector(taskType, options.promptShape);
    const threshold = options.similarityThreshold || SIMILARITY_THRESHOLD;
    candidateOutcomes = taskMatches.filter((outcome) => {
      if (!outcome.recipe || !outcome.recipe.vector) return false;
      return promptShapeSimilarity(targetVector, outcome.recipe.vector, specified) >= threshold;
    });
  }

  if (candidateOutcomes.length < MIN_SAMPLES) {
    return null;
  }

  const now = Date.now();
  const best = Object.values(groupByRecipeHash(candidateOutcomes))
    .map((group) => ({
      ...group,
      ...scoreRecipeGroup(group, now),
    }))
    .filter((group) => group.sampleCount >= MIN_SAMPLES)
    .sort((a, b) => b.score - a.score)[0];

  if (!best) {
    return null;
  }

  return {
    recipe: best.recipe,
    confidence: best.confidence,
    sampleCount: best.sampleCount,
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

// v3 part 3: A/B report. Splits outcomes into bias-on (records that
// carry applied_recommendation) vs bias-off (records without it) and
// compares mean / median effectiveness. Lets maintainers decide
// whether to flip REPROMPTER_FLYWHEEL_BIAS on by default.
//
// Absence of applied_recommendation is the control-group signal —
// never interpret a record without that field as "bias was disabled";
// interpret it as "bias was not applied", which includes flag-off runs
// AND flag-on runs where the query returned null or low confidence.
const MIN_AB_SAMPLES_PER_GROUP = 5;

function basicStats(values) {
  if (values.length === 0) {
    return { count: 0, mean: null, median: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  return {
    count: sorted.length,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
  };
}

function buildAbReport(options = {}) {
  const store = options.store || createOutcomeStore({ rootDir: options.rootDir });
  const outcomes = store.readOutcomes({ limit: options.limit || Number.MAX_SAFE_INTEGER });
  const taskType = options.taskType ? normalizeTaskType(options.taskType) : null;

  const scoped = taskType
    ? outcomes.filter((o) => o.recipe && o.recipe.vector && o.recipe.vector.templateId === taskType)
    : outcomes;

  const withBias = [];
  const withoutBias = [];
  for (const o of scoped) {
    const score = Number(o.effectivenessScore);
    if (!Number.isFinite(score)) continue;
    if (o.applied_recommendation && typeof o.applied_recommendation === "object") {
      withBias.push(score);
    } else {
      withoutBias.push(score);
    }
  }

  const withStats = basicStats(withBias);
  const withoutStats = basicStats(withoutBias);
  const delta = withStats.mean !== null && withoutStats.mean !== null
    ? Number((withStats.mean - withoutStats.mean).toFixed(2))
    : null;

  const notes = [];
  if (withStats.count < MIN_AB_SAMPLES_PER_GROUP) {
    notes.push(`with_bias group has only ${withStats.count} samples — below the ${MIN_AB_SAMPLES_PER_GROUP}-sample bar for a trustworthy read.`);
  }
  if (withoutStats.count < MIN_AB_SAMPLES_PER_GROUP) {
    notes.push(`without_bias group has only ${withoutStats.count} samples — below the ${MIN_AB_SAMPLES_PER_GROUP}-sample bar for a trustworthy read.`);
  }
  if (delta === null) {
    notes.push("delta is null — one or both groups are empty.");
  }

  return {
    task_type: taskType,
    total_outcomes: scoped.length,
    with_bias: withStats,
    without_bias: withoutStats,
    delta_mean_effectiveness: delta,
    min_samples_for_confidence: MIN_AB_SAMPLES_PER_GROUP,
    notes,
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

  // Template preference (at medium+ confidence)
  let preferTemplate = null;
  if (rec.preferTemplate) {
    preferTemplate = rec.preferTemplate;
    changes.push(`prefer-template:${rec.preferTemplate}`);
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
    template: preferTemplate,
    changes,
    score: rec.score,
    confidence: rec.confidence,
  };
}

module.exports = {
  getRecommendation,
  recommendStrategy,
  bestRecipeForDomain,
  applyFlywheelBias,
  buildFlywheelReport,
  buildAbReport,
  findSimilarRecipes,
  groupByRecipeHash,
  scoreRecipeGroup,
  timeDecay,
};

function parseCliArgs(argv) {
  const args = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--query") { args.query = true; continue; }
    if (token === "--ab") { args.ab = true; continue; }
    if (token === "--task-type") { args.taskType = argv[i + 1]; i++; continue; }
    if (token === "--root-dir") { args.rootDir = argv[i + 1]; i++; continue; }
    if (token === "--prompt-shape") { args.promptShape = argv[i + 1]; i++; continue; }
    args.positional.push(token);
  }
  return args;
}

function readPromptShape(raw) {
  if (!raw) return undefined;
  if (raw.trim().startsWith("{")) {
    return JSON.parse(raw);
  }
  return JSON.parse(fs.readFileSync(raw, "utf8"));
}

if (require.main === module) {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.query) {
    const taskType = args.taskType || args.positional[0];
    if (!taskType) {
      process.stderr.write("strategy-learner: --query requires a task type (use --task-type <slug> or pass it positionally)\n");
      process.exit(1);
    }
    try {
      const recommendation = getRecommendation({
        taskType,
        rootDir: args.rootDir,
        promptShape: readPromptShape(args.promptShape),
      });
      process.stdout.write(`${JSON.stringify(recommendation, null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`strategy-learner: ${error.message}\n`);
      process.exit(1);
    }
  } else if (args.ab) {
    try {
      const report = buildAbReport({
        rootDir: args.rootDir,
        taskType: args.taskType,
      });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`strategy-learner: ${error.message}\n`);
      process.exit(1);
    }
  } else {
    const report = buildFlywheelReport({ rootDir: args.rootDir });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}
