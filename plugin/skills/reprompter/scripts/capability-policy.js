#!/usr/bin/env node
"use strict";

const DEFAULT_MODEL_CATALOG = [
  {
    id: "anthropic/claude-opus-4",
    provider: "anthropic",
    maxContextK: 200,
    metrics: {
      reasoning: 10,
      reliability: 10,
      latency: 4,
      costEfficiency: 3,
      longContext: 8,
      toolReliability: 9,
    },
  },
  {
    id: "anthropic/claude-sonnet-4",
    provider: "anthropic",
    maxContextK: 200,
    metrics: {
      reasoning: 8,
      reliability: 8,
      latency: 7,
      costEfficiency: 6,
      longContext: 8,
      toolReliability: 8,
    },
  },
  {
    id: "openai/gpt-5",
    provider: "openai",
    maxContextK: 200,
    metrics: {
      reasoning: 9,
      reliability: 9,
      latency: 5,
      costEfficiency: 4,
      longContext: 8,
      toolReliability: 8,
    },
  },
  {
    id: "openai/gpt-5-mini",
    provider: "openai",
    maxContextK: 200,
    metrics: {
      reasoning: 7,
      reliability: 7,
      latency: 9,
      costEfficiency: 8,
      longContext: 8,
      toolReliability: 7,
    },
  },
  {
    id: "google/gemini-2.5-pro",
    provider: "google",
    maxContextK: 1000,
    metrics: {
      reasoning: 9,
      reliability: 8,
      latency: 6,
      costEfficiency: 6,
      longContext: 10,
      toolReliability: 7,
    },
  },
  {
    id: "google/gemini-2.5-flash",
    provider: "google",
    maxContextK: 1000,
    metrics: {
      reasoning: 7,
      reliability: 7,
      latency: 10,
      costEfficiency: 9,
      longContext: 10,
      toolReliability: 6,
    },
  },
];

const PRIMARY_TIER_WEIGHTS = {
  reasoning_high: {
    reasoning: 0.4,
    reliability: 0.3,
    toolReliability: 0.2,
    longContext: 0.05,
    costEfficiency: 0.05,
    latency: 0,
  },
  reasoning_medium: {
    reasoning: 0.3,
    reliability: 0.25,
    toolReliability: 0.15,
    longContext: 0.1,
    costEfficiency: 0.1,
    latency: 0.1,
  },
  latency_optimized: {
    latency: 0.45,
    costEfficiency: 0.2,
    reasoning: 0.15,
    reliability: 0.1,
    longContext: 0.05,
    toolReliability: 0.05,
  },
  cost_optimized: {
    costEfficiency: 0.45,
    latency: 0.2,
    reasoning: 0.15,
    reliability: 0.1,
    longContext: 0.05,
    toolReliability: 0.05,
  },
  long_context: {
    longContext: 0.45,
    reasoning: 0.2,
    reliability: 0.2,
    toolReliability: 0.1,
    latency: 0.025,
    costEfficiency: 0.025,
  },
  tool_reliability: {
    toolReliability: 0.4,
    reliability: 0.25,
    reasoning: 0.2,
    longContext: 0.05,
    costEfficiency: 0.05,
    latency: 0.05,
  },
};

const HIGH_REASONING_DOMAINS = new Set([
  "security",
  "research",
  "architecture",
  "compliance",
  "synthesis",
]);

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeOutcome(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "quality_reliability";
  if (normalized === "cost + speed") return "cost_speed";
  if (normalized === "balanced triad") return "balanced";
  return normalized;
}

function inferCapabilityRequirements(agentSpec = {}, taskSpec = {}) {
  const domain = normalizeText(agentSpec.domain);
  const role = normalizeText(agentSpec.role);
  const outputType = normalizeText(agentSpec.outputType);
  const complexity = Number(agentSpec.complexity || taskSpec.complexity || 0);
  const requestedContextTokens = Number(
    agentSpec.contextTokens || taskSpec.contextTokens || 0
  );
  const reliability = normalizeText(
    agentSpec.reliabilityTarget || taskSpec.reliabilityTarget || "strict"
  );
  const outcome = normalizeOutcome(taskSpec.preferredOutcome || taskSpec.outcomePriority);

  const text = `${domain} ${role} ${outputType} ${normalizeText(taskSpec.task)}`;
  const needsHighReasoning =
    HIGH_REASONING_DOMAINS.has(domain) ||
    outputType === "synthesis" ||
    outputType === "evaluation" ||
    complexity >= 7 ||
    /audit|tradeoff|root cause|threat/.test(text);

  const needsLongContext = requestedContextTokens >= 100000 || /long context|large codebase/.test(text);
  const needsToolReliability = /tool|integration|execution|runtime/.test(text);
  const strictReliability = reliability !== "relaxed";

  let primaryTier = "reasoning_medium";
  if (needsLongContext) {
    primaryTier = "long_context";
  } else if (outcome === "cost_speed") {
    primaryTier = needsHighReasoning ? "reasoning_medium" : "cost_optimized";
  } else if (outcome === "balanced") {
    primaryTier = needsHighReasoning ? "reasoning_high" : "reasoning_medium";
  } else if (needsToolReliability) {
    primaryTier = "tool_reliability";
  } else if (needsHighReasoning || strictReliability) {
    primaryTier = "reasoning_high";
  }

  return {
    primaryTier,
    requestedContextTokens,
    strictReliability,
    needsHighReasoning,
    needsLongContext,
    needsToolReliability,
    outcome,
    domain,
  };
}

function applyHardPenalties(model, requirements) {
  let penalty = 0;
  const contextCapacity = model.maxContextK * 1000;

  if (requirements.requestedContextTokens > contextCapacity) {
    penalty -= 100;
  }

  if (requirements.primaryTier === "reasoning_high" && model.metrics.reasoning < 8) {
    penalty -= 40;
  }

  if (requirements.primaryTier === "long_context" && model.metrics.longContext < 8) {
    penalty -= 50;
  }

  if (requirements.strictReliability && model.metrics.reliability < 7) {
    penalty -= 20;
  }

  if (requirements.needsToolReliability && model.metrics.toolReliability < 7) {
    penalty -= 15;
  }

  return penalty;
}

function scoreModel(model, requirements, policyConfig = {}) {
  const weights = PRIMARY_TIER_WEIGHTS[requirements.primaryTier] || PRIMARY_TIER_WEIGHTS.reasoning_medium;
  let score = 0;

  for (const [metric, weight] of Object.entries(weights)) {
    score += (model.metrics[metric] || 0) * weight;
  }

  if (policyConfig.preferProvider && model.provider === policyConfig.preferProvider) {
    score += 0.5;
  }

  if (policyConfig.avoidProvider && model.provider === policyConfig.avoidProvider) {
    score -= 1;
  }

  if (policyConfig.flywheelPreferredTier) {
    const preferredWeights = PRIMARY_TIER_WEIGHTS[policyConfig.flywheelPreferredTier];
    if (preferredWeights) {
      let tierScore = 0;
      for (const [metric, weight] of Object.entries(preferredWeights)) {
        tierScore += (model.metrics[metric] || 0) * weight;
      }
      if (tierScore >= 7) {
        score += 2;
      }
    }
  }

  score += applyHardPenalties(model, requirements);
  return score;
}

function buildFallbackChain(rankedModels, primary, options = {}) {
  const maxFallbacks = Number(options.maxFallbacks || 3);
  const diversifyProviders = options.diversifyProviders !== false;

  const chain = [];
  const usedProviders = new Set([primary.provider]);

  for (const model of rankedModels) {
    if (model.id === primary.id) continue;
    if (chain.length >= maxFallbacks) break;

    if (diversifyProviders && usedProviders.size === 1 && usedProviders.has(model.provider)) {
      continue;
    }

    chain.push(model);
    usedProviders.add(model.provider);
  }

  if (chain.length < maxFallbacks) {
    for (const model of rankedModels) {
      if (model.id === primary.id) continue;
      if (chain.length >= maxFallbacks) break;
      if (chain.some((item) => item.id === model.id)) continue;
      chain.push(model);
    }
  }

  return chain;
}

function resolveModelForAgent(agentSpec = {}, taskSpec = {}, policyConfig = {}) {
  const modelCatalog = policyConfig.modelCatalog || DEFAULT_MODEL_CATALOG;
  if (!Array.isArray(modelCatalog) || modelCatalog.length === 0) {
    throw new Error("Model catalog is empty.");
  }

  const requirements = inferCapabilityRequirements(agentSpec, taskSpec);
  const effectiveConfig = agentSpec.flywheelPreferredTier
    ? { ...policyConfig, flywheelPreferredTier: agentSpec.flywheelPreferredTier }
    : policyConfig;
  const ranked = modelCatalog
    .map((model) => ({ model, score: scoreModel(model, requirements, effectiveConfig) }))
    .sort((a, b) => b.score - a.score);

  const primary = ranked[0].model;
  const fallback = buildFallbackChain(
    ranked.map((entry) => entry.model),
    primary,
    { maxFallbacks: policyConfig.maxFallbacks || 3, diversifyProviders: true }
  );

  const reason = [
    `tier=${requirements.primaryTier}`,
    `domain=${requirements.domain || "generic"}`,
    `outcome=${requirements.outcome}`,
    `context=${requirements.requestedContextTokens || 0}`,
  ].join("; ");

  return {
    selected: {
      provider: primary.provider,
      model: primary.id,
      maxContextK: primary.maxContextK,
      capabilityTier: requirements.primaryTier,
    },
    fallbackChain: fallback.map((model) => ({
      provider: model.provider,
      model: model.id,
      maxContextK: model.maxContextK,
    })),
    reason,
    requirements,
    rankedCandidates: ranked.map((entry) => ({
      provider: entry.model.provider,
      model: entry.model.id,
      score: Number(entry.score.toFixed(3)),
    })),
  };
}

module.exports = {
  DEFAULT_MODEL_CATALOG,
  inferCapabilityRequirements,
  resolveModelForAgent,
};

if (require.main === module) {
  const input = process.argv.slice(2).join(" ");
  const plan = resolveModelForAgent(
    { role: "general", domain: "engineering", outputType: "analysis" },
    { task: input || "Analyze and plan", preferredOutcome: "quality_reliability" }
  );
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}
