#!/usr/bin/env node
"use strict";

const { routeIntent } = require("./intent-router");
const { selectPatterns, getPatternById } = require("./pattern-selector");
const { resolveModelForAgent } = require("./capability-policy");
const { buildAgentContext, approxTokens } = require("./context-builder");
const { createRuntimeAdapter } = require("./runtime-adapter");
const { evaluateArtifact } = require("./artifact-evaluator");
const { createTelemetryStore } = require("./telemetry-store");
const { fingerprint: fingerprintRecipe } = require("./recipe-fingerprint");
const { createOutcomeStore, computeEffectiveness } = require("./outcome-collector");
const { recommendStrategy, bestRecipeForDomain, applyFlywheelBias } = require("./strategy-learner");

const FEATURE_ENV = {
  policyEngine: "REPROMPTER_POLICY_ENGINE",
  layeredContext: "REPROMPTER_LAYERED_CONTEXT",
  strictEval: "REPROMPTER_STRICT_EVAL",
  patternLibrary: "REPROMPTER_PATTERN_LIBRARY",
  flywheel: "REPROMPTER_FLYWHEEL",
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
    flywheel:
      flagOverrides.flywheel ??
      parseBooleanEnv(process.env[FEATURE_ENV.flywheel], true),
  };
}

function createRunId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `rpt-${Date.now()}-${rand}`;
}

function createTaskId(rawTask = "") {
  const seed = String(rawTask || "task").trim().toLowerCase().replace(/\s+/g, "-");
  const compact = seed.replace(/[^a-z0-9-]/g, "").slice(0, 32) || "task";
  return `${compact}-${Date.now().toString(36)}`;
}

function resolveTelemetry(options = {}) {
  const telemetry = options.telemetry || {};
  const enabled =
    telemetry.enabled ??
    parseBooleanEnv(process.env.REPROMPTER_TELEMETRY, true);

  if (!enabled) {
    return {
      enabled: false,
      writeEvent() {
        return null;
      },
    };
  }

  const store = createTelemetryStore({
    rootDir: telemetry.rootDir || options.rootDir || process.cwd(),
    dirPath: telemetry.dirPath,
    filePath: telemetry.filePath,
  });

  return {
    enabled: true,
    store,
    writeEvent(event) {
      return store.writeEvent(event);
    },
  };
}

function emitStageEvent(telemetry, baseEvent, event = {}) {
  if (!telemetry || !telemetry.enabled) return null;
  return telemetry.writeEvent({
    ...baseEvent,
    timestamp: new Date().toISOString(),
    ...event,
  });
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
  const runId = options.runId || createRunId();
  const taskId = options.taskId || createTaskId(rawTask);
  const runtime = options.runtime || "openclaw";
  const telemetry = resolveTelemetry(options);
  const featureFlags = resolveFeatureFlags(options.featureFlags);
  const baseEvent = { runId, taskId, runtime };

  const routeStart = Date.now();
  const intent = routeIntent(rawTask, {
    forceMultiAgent: options.forceMultiAgent,
    forceSingle: options.forceSingle,
  });
  emitStageEvent(telemetry, baseEvent, {
    stage: "route_intent",
    status: "ok",
    latencyMs: Date.now() - routeStart,
    reason: intent.reason,
    metadata: { profile: intent.profile, mode: intent.mode },
  });

  const domain = options.domain || deriveDomainFromProfile(intent.profile);
  const preferredOutcome = options.preferredOutcome || "quality_reliability";

  // Flywheel: pre-decision lookup — query historical best recipe for this domain
  let flywheelBias = null;
  let biasResult = { applied: false, patterns: [], tier: null, changes: [] };
  if (featureFlags.flywheel) {
    const biasStart = Date.now();
    try {
      flywheelBias = bestRecipeForDomain(domain, {
        rootDir: options.rootDir || process.cwd(),
      });
      emitStageEvent(telemetry, baseEvent, {
        stage: "learn_strategy",
        status: "ok",
        latencyMs: Date.now() - biasStart,
        metadata: {
          found: flywheelBias.found,
          score: flywheelBias.bias ? flywheelBias.bias.score : null,
          confidence: flywheelBias.bias ? flywheelBias.bias.confidence : null,
        },
      });
    } catch {
      emitStageEvent(telemetry, baseEvent, {
        stage: "learn_strategy",
        status: "error",
        latencyMs: Date.now() - biasStart,
      });
    }
  }

  const patternStart = Date.now();
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

  // Flywheel: apply bias — merge recommended patterns into selection
  if (featureFlags.flywheel && flywheelBias) {
    biasResult = applyFlywheelBias(flywheelBias, patternSelection.patternIds, {
      minConfidence: options.flywheelMinConfidence || "medium",
    });
    if (biasResult.applied) {
      patternSelection.patternIds = biasResult.patterns;
      // Sync patterns array: add full pattern objects for newly added IDs
      const existingIds = new Set(patternSelection.patterns.map((p) => p.id));
      for (const id of biasResult.patterns) {
        if (!existingIds.has(id)) {
          const fullPattern = getPatternById(id);
          if (fullPattern) {
            patternSelection.patterns.push(fullPattern);
          }
        }
      }
      patternSelection.reasons.push(
        `flywheel-bias: ${biasResult.changes.join(", ")} (score=${biasResult.score}, confidence=${biasResult.confidence})`
      );
    }
  }

  emitStageEvent(telemetry, baseEvent, {
    stage: "select_patterns",
    status: "ok",
    latencyMs: Date.now() - patternStart,
    metadata: {
      enabled: featureFlags.patternLibrary,
      count: patternSelection.patternIds.length,
      flywheelBiasApplied: biasResult.applied,
      flywheelChanges: biasResult.changes,
    },
  });

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

  // Flywheel: if bias recommends a capability tier, set it as preferred outcome hint
  if (biasResult.tier && featureFlags.policyEngine) {
    agentSpec.flywheelPreferredTier = biasResult.tier;
  }

  const modelStart = Date.now();
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
  emitStageEvent(telemetry, baseEvent, {
    stage: "resolve_model",
    status: "ok",
    latencyMs: Date.now() - modelStart,
    provider: modelPlan.selected.provider,
    model: modelPlan.selected.model,
    metadata: {
      enabled: featureFlags.policyEngine,
      tier: modelPlan.selected.capabilityTier,
      fallbackCount: modelPlan.fallbackChain.length,
    },
  });

  const contextStart = Date.now();
  const contextPlan = featureFlags.layeredContext
    ? buildAgentContext(agentSpec, taskSpec, options.repoFacts || {}, {
        totalTokens: options.totalContextTokens || 1400,
        layerBudgets: options.layerBudgets,
      })
    : buildMinimalContext(agentSpec, taskSpec);
  emitStageEvent(telemetry, baseEvent, {
    stage: "build_context",
    status: "ok",
    latencyMs: Date.now() - contextStart,
    tokenEstimate: contextPlan.tokenEstimate,
    metadata: {
      enabled: featureFlags.layeredContext,
      layers: Array.isArray(contextPlan.manifest?.layers)
        ? contextPlan.manifest.layers.length
        : 0,
    },
  });

  // Flywheel: fingerprint the ACTUAL recipe (after bias was applied)
  let recipeFingerprint = null;
  if (featureFlags.flywheel) {
    const fpStart = Date.now();
    recipeFingerprint = fingerprintRecipe({
      templateId: intent.profile,
      patterns: patternSelection.patternIds,
      capabilityTier: modelPlan.selected.capabilityTier || "default",
      domain,
      contextLayers: Array.isArray(contextPlan.manifest?.layers)
        ? contextPlan.manifest.layers.length
        : 0,
      qualityScore: options.qualityScore || 0,
    });
    emitStageEvent(telemetry, baseEvent, {
      stage: "fingerprint_recipe",
      status: "ok",
      latencyMs: Date.now() - fpStart,
      metadata: {
        hash: recipeFingerprint.hash,
        readable: recipeFingerprint.readable,
        biasApplied: biasResult.applied,
      },
    });
  }

  emitStageEvent(telemetry, baseEvent, {
    stage: "plan_ready",
    status: "ok",
    tokenEstimate: contextPlan.tokenEstimate,
    metadata: {
      domain,
      preferredOutcome,
      profile: intent.profile,
      flywheelHash: recipeFingerprint ? recipeFingerprint.hash : null,
      flywheelBiasApplied: biasResult.applied,
      flywheelBiasChanges: biasResult.changes,
    },
  });

  return {
    runId,
    taskId,
    runtime,
    telemetry,
    featureFlags,
    intent,
    domain,
    patternSelection,
    agentSpec,
    taskSpec,
    modelPlan,
    contextPlan,
    recipeFingerprint,
    flywheelBias: biasResult,
  };
}

async function executePlan(plan, options = {}) {
  const telemetry = plan.telemetry || resolveTelemetry(options);
  const baseEvent = {
    runId: plan.runId || options.runId || createRunId(),
    taskId: plan.taskId || options.taskId || createTaskId(plan.taskSpec?.task),
    runtime: plan.runtime || "openclaw",
  };
  const featureFlags = resolveFeatureFlags({
    ...plan.featureFlags,
    ...(options.featureFlags || {}),
  });
  const adapter = createRuntimeAdapter(plan.runtime, options.adapterOptions || {});
  const label = options.label || `${plan.domain}-agent`;

  const spawnStart = Date.now();
  const spawnResult = await adapter.spawnAgent(plan.contextPlan.promptContext, {
    model: plan.modelPlan.selected.model,
    provider: plan.modelPlan.selected.provider,
  }, label);
  emitStageEvent(telemetry, baseEvent, {
    stage: "spawn_agent",
    status: "ok",
    latencyMs: Date.now() - spawnStart,
    provider: plan.modelPlan.selected.provider,
    model: plan.modelPlan.selected.model,
    metadata: {
      runRef: spawnResult.runId,
      label,
    },
  });

  const expectedArtifacts = options.expectedArtifacts || [plan.taskSpec.outputPath];
  const pollStart = Date.now();
  const pollResult = await adapter.pollArtifacts(plan.taskSpec.task, expectedArtifacts, {
    maxPolls: options.maxPolls || 20,
    stableThreshold: options.stableThreshold || 3,
    intervalMs: options.intervalMs || 0,
  });
  emitStageEvent(telemetry, baseEvent, {
    stage: "poll_artifacts",
    status: pollResult.status === "completed" ? "ok" : pollResult.status,
    latencyMs: Date.now() - pollStart,
    metadata: {
      polls: pollResult.polls,
      expectedArtifacts: expectedArtifacts.length,
      missingArtifacts: pollResult.missingArtifacts.length,
    },
  });

  const evalStart = Date.now();
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
  if (evaluation) {
    emitStageEvent(telemetry, baseEvent, {
      stage: "evaluate_artifact",
      status: evaluation.pass ? "ok" : "error",
      latencyMs: Date.now() - evalStart,
      pass: evaluation.pass,
      metadata: {
        score: evaluation.overallScore,
        threshold: evaluation.threshold,
        gapCount: evaluation.gaps.length,
      },
    });
  } else {
    emitStageEvent(telemetry, baseEvent, {
      stage: "evaluate_artifact",
      status: "skipped",
      latencyMs: Date.now() - evalStart,
    });
  }

  const finalizedPass =
    pollResult.status === "completed" &&
    (!evaluation || evaluation.pass === true);
  emitStageEvent(telemetry, baseEvent, {
    stage: "finalize_run",
    status: finalizedPass ? "ok" : "error",
    pass: finalizedPass,
    metadata: {
      pollStatus: pollResult.status,
      hasEvaluation: Boolean(evaluation),
    },
  });

  // Flywheel: collect outcome signals and persist
  let outcomeRecord = null;
  if (featureFlags.flywheel && plan.recipeFingerprint) {
    const collectStart = Date.now();
    try {
      const outcomeStore = createOutcomeStore({
        rootDir: plan.taskSpec?.rootDir || options.rootDir || process.cwd(),
      });
      const signals = {
        artifactScore: evaluation ? evaluation.overallScore : null,
        artifactPass: evaluation ? evaluation.pass : null,
        retryCount: Number(options.retryCount || 0),
        executionMs: Date.now() - (options._executionStartMs || Date.now()),
      };
      outcomeRecord = outcomeStore.writeOutcome({
        runId: baseEvent.runId,
        taskId: baseEvent.taskId,
        recipe: plan.recipeFingerprint,
        signals,
        effectivenessScore: computeEffectiveness(signals),
      });
      emitStageEvent(telemetry, baseEvent, {
        stage: "collect_outcome",
        status: "ok",
        latencyMs: Date.now() - collectStart,
        metadata: {
          effectivenessScore: outcomeRecord.effectivenessScore,
          recipeHash: plan.recipeFingerprint.hash,
        },
      });
    } catch {
      emitStageEvent(telemetry, baseEvent, {
        stage: "collect_outcome",
        status: "error",
        latencyMs: Date.now() - collectStart,
      });
    }
  }

  return {
    adapter: {
      runtime: adapter.name,
      supportsParallel: adapter.supportsParallel(),
    },
    featureFlags,
    runId: baseEvent.runId,
    taskId: baseEvent.taskId,
    spawnResult,
    pollResult,
    evaluation,
    outcomeRecord,
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
