#!/usr/bin/env node
"use strict";

const { routeIntent } = require("./intent-router");
const { selectPatterns } = require("./pattern-selector");
const { resolveModelForAgent } = require("./capability-policy");
const { buildAgentContext, approxTokens } = require("./context-builder");
const { createRuntimeAdapter } = require("./runtime-adapter");
const { evaluateArtifact } = require("./artifact-evaluator");

const FEATURE_ENV = {
  policyEngine: "REPROMPTER_POLICY_ENGINE",
  layeredContext: "REPROMPTER_LAYERED_CONTEXT",
  strictEval: "REPROMPTER_STRICT_EVAL",
  patternLibrary: "REPROMPTER_PATTERN_LIBRARY",
};

function parseBooleanEnv(raw, defaultValue) {
  if (raw === undefined || raw === null || raw === "") {
    return defaultValue;
  }

  const normalized = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function resolveFeatureFlags(overrides = {}) {
  const flagOverrides = overrides || {};
  return {
    policyEngine:
      flagOverrides.policyEngine ??
      parseBooleanEnv(process.env[FEATURE_ENV.policyEngine], true),
    layeredContext:
      flagOverrides.layeredContext ??
      parseBooleanEnv(process.env[FEATURE_ENV.layeredContext], true),
    strictEval:
      flagOverrides.strictEval ??
      parseBooleanEnv(process.env[FEATURE_ENV.strictEval], true),
    patternLibrary:
      flagOverrides.patternLibrary ??
      parseBooleanEnv(process.env[FEATURE_ENV.patternLibrary], true),
  };
}

function deriveDomainFromProfile(profile) {
  if (profile === "marketing-swarm") return "marketing";
  if (profile === "engineering-swarm") return "engineering";
  if (profile === "ops-swarm") return "ops";
  if (profile === "research-swarm") return "research";
  return "general";
}

function buildStaticModelPlan(options = {}) {
  const staticModel = options.staticModel || {
    provider: "anthropic",
    model: "anthropic/claude-sonnet-4",
    maxContextK: 200,
    capabilityTier: "static",
  };

  const fallbackChain = Array.isArray(options.staticFallbackChain)
    ? options.staticFallbackChain
    : [
        { provider: "openai", model: "openai/gpt-5-mini", maxContextK: 200 },
        { provider: "google", model: "google/gemini-2.5-flash", maxContextK: 1000 },
      ];

  return {
    selected: staticModel,
    fallbackChain,
    reason: "policy-engine-disabled",
    requirements: {
      primaryTier: staticModel.capabilityTier || "static",
      outcome: options.preferredOutcome || "quality_reliability",
    },
    rankedCandidates: [{ provider: staticModel.provider, model: staticModel.model, score: 1 }],
  };
}

function buildMinimalContext(agentSpec = {}, taskSpec = {}) {
  const lines = [
    "## Layer 1: Task Contract",
    `- Agent: ${agentSpec.id || "agent"}`,
    `- Role: ${agentSpec.role || "specialist"}`,
    `- Domain: ${agentSpec.domain || "general"}`,
    `- Task: ${taskSpec.task || "N/A"}`,
    "- Requirements:",
    ...(taskSpec.requirements || []).map((item) => `- ${item}`),
    "- Constraints:",
    ...(taskSpec.constraints || []).map((item) => `- ${item}`),
    "- Success Criteria:",
    ...(taskSpec.successCriteria || []).map((item) => `- ${item}`),
  ];

  const promptContext = `${lines.join("\n")}\n`;
  const usedTokens = approxTokens(promptContext);

  return {
    promptContext,
    tokenEstimate: usedTokens,
    manifest: {
      totalBudgetTokens: usedTokens,
      totalUsedTokens: usedTokens,
      layers: [
        {
          name: "contract",
          budgetTokens: usedTokens,
          usedTokens,
          truncated: false,
          entriesUsed: lines.length,
          entriesTotal: lines.length,
        },
      ],
    },
  };
}

function buildExecutionPlan(rawTask, options = {}) {
  const featureFlags = resolveFeatureFlags(options.featureFlags);
  const intent = routeIntent(rawTask, {
    forceMultiAgent: options.forceMultiAgent,
    forceSingle: options.forceSingle,
  });

  const domain = options.domain || deriveDomainFromProfile(intent.profile);
  const preferredOutcome = options.preferredOutcome || "quality_reliability";

  const patternSelection = featureFlags.patternLibrary
    ? selectPatterns(
        {
          task: rawTask,
          preferredOutcome,
          domain,
          motivation: options.motivation || "",
        },
        domain,
        { maxPatterns: options.maxPatterns || 6 }
      )
    : {
        domain,
        outcome: preferredOutcome,
        patternIds: [],
        patterns: [],
        reasons: ["pattern-library-disabled"],
      };

  const agentSpec = {
    id: options.agentId || "lead-agent",
    role: options.role || "Repromptverse Orchestrator",
    domain,
    outputType: options.outputType || "analysis",
    complexity: options.complexity || (intent.mode === "multi-agent" ? 8 : 5),
    contextTokens: options.contextTokens || 60000,
    reliabilityTarget: options.reliabilityTarget || "strict",
  };

  const taskSpec = {
    task: rawTask,
    preferredOutcome,
    requirements: options.requirements || [
      "Produce deterministic agent scope",
      "Emit artifact paths and acceptance checks",
      "Use delta retries only on failures",
    ],
    constraints: options.constraints || [
      "Do not assign overlapping file ownership",
      "Do not run unbounded polling",
      "Do not synthesize before all required artifacts pass",
    ],
    successCriteria: options.successCriteria || [
      "All artifacts pass evaluator gate",
      "Routing and fallback chain are explicit",
    ],
    outputPath: options.outputPath || `/tmp/rpt-${Date.now()}-final.md`,
    patternHints: patternSelection.patternIds,
    contextTokens: agentSpec.contextTokens,
    reliabilityTarget: agentSpec.reliabilityTarget,
  };

  const modelPlan = featureFlags.policyEngine
    ? resolveModelForAgent(agentSpec, taskSpec, {
        preferProvider: options.preferProvider,
        avoidProvider: options.avoidProvider,
      })
    : buildStaticModelPlan({
        staticModel: options.staticModel,
        staticFallbackChain: options.staticFallbackChain,
        preferredOutcome,
      });

  const contextPlan = featureFlags.layeredContext
    ? buildAgentContext(agentSpec, taskSpec, options.repoFacts || {}, {
        totalTokens: options.totalContextTokens || 1400,
        layerBudgets: options.layerBudgets,
      })
    : buildMinimalContext(agentSpec, taskSpec);

  return {
    runtime: options.runtime || "openclaw",
    featureFlags,
    intent,
    domain,
    patternSelection,
    agentSpec,
    taskSpec,
    modelPlan,
    contextPlan,
  };
}

async function executePlan(plan, options = {}) {
  const featureFlags = resolveFeatureFlags({
    ...plan.featureFlags,
    ...(options.featureFlags || {}),
  });
  const adapter = createRuntimeAdapter(plan.runtime, options.adapterOptions || {});
  const label = options.label || `${plan.domain}-agent`;

  const spawnResult = await adapter.spawnAgent(plan.contextPlan.promptContext, {
    model: plan.modelPlan.selected.model,
    provider: plan.modelPlan.selected.provider,
  }, label);

  const expectedArtifacts = options.expectedArtifacts || [plan.taskSpec.outputPath];
  const pollResult = await adapter.pollArtifacts(plan.taskSpec.task, expectedArtifacts, {
    maxPolls: options.maxPolls || 20,
    stableThreshold: options.stableThreshold || 3,
    intervalMs: options.intervalMs || 0,
  });

  const evaluation = options.artifactText
    ? evaluateArtifact(
        options.artifactText,
        featureFlags.strictEval
          ? (options.contractSpec || {})
          : {
              threshold: 6,
              requiresLineRefs: false,
              strictBoundaries: false,
              ...(options.contractSpec || {}),
            }
      )
    : null;

  return {
    adapter: {
      runtime: adapter.name,
      supportsParallel: adapter.supportsParallel(),
    },
    featureFlags,
    spawnResult,
    pollResult,
    evaluation,
  };
}

module.exports = {
  FEATURE_ENV,
  resolveFeatureFlags,
  buildExecutionPlan,
  executePlan,
};

if (require.main === module) {
  const task = process.argv.slice(2).join(" ") || "repromptverse audit auth and infra reliability";
  const plan = buildExecutionPlan(task, {
    runtime: "openclaw",
    preferredOutcome: "quality_reliability",
  });

  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}
