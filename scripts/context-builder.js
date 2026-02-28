#!/usr/bin/env node
"use strict";

function approxTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((x) => String(x));
  return [String(value)];
}

function formatBulletList(items) {
  return normalizeList(items)
    .map((item) => `- ${item}`)
    .join("\n");
}

function resolveBudgets(totalTokens, layerBudgets = {}) {
  const defaults = {
    contract: 0.4,
    repoFacts: 0.3,
    references: 0.2,
    priorArtifacts: 0.1,
  };

  const raw = {
    contract: layerBudgets.contract ?? defaults.contract,
    repoFacts: layerBudgets.repoFacts ?? defaults.repoFacts,
    references: layerBudgets.references ?? defaults.references,
    priorArtifacts: layerBudgets.priorArtifacts ?? defaults.priorArtifacts,
  };

  const values = Object.values(raw);
  const ratioMode = values.every((x) => x <= 1);

  if (!ratioMode) {
    return {
      contract: Math.max(0, Math.floor(raw.contract)),
      repoFacts: Math.max(0, Math.floor(raw.repoFacts)),
      references: Math.max(0, Math.floor(raw.references)),
      priorArtifacts: Math.max(0, Math.floor(raw.priorArtifacts)),
    };
  }

  return {
    contract: Math.floor(totalTokens * raw.contract),
    repoFacts: Math.floor(totalTokens * raw.repoFacts),
    references: Math.floor(totalTokens * raw.references),
    priorArtifacts: Math.floor(totalTokens * raw.priorArtifacts),
  };
}

function fitEntriesToBudget(entries, budgetTokens) {
  const safeEntries = normalizeList(entries);
  if (budgetTokens <= 0 || safeEntries.length === 0) {
    return {
      usedEntries: [],
      usedTokens: 0,
      truncated: safeEntries.length > 0,
      totalEntries: safeEntries.length,
    };
  }

  const usedEntries = [];
  let usedTokens = 0;

  for (const entry of safeEntries) {
    const line = `- ${entry}`;
    const lineTokens = approxTokens(`${line}\n`);
    if (usedTokens + lineTokens > budgetTokens) {
      break;
    }
    usedEntries.push(entry);
    usedTokens += lineTokens;
  }

  return {
    usedEntries,
    usedTokens,
    truncated: usedEntries.length < safeEntries.length,
    totalEntries: safeEntries.length,
  };
}

function buildContractLayer(agentSpec = {}, taskSpec = {}) {
  const lines = [
    "## Layer 1: Task Contract",
    `- Agent: ${agentSpec.id || "agent"}`,
    `- Role: ${agentSpec.role || "specialist"}`,
    `- Domain: ${agentSpec.domain || "general"}`,
    `- Task: ${taskSpec.task || "N/A"}`,
  ];

  const requirements = formatBulletList(taskSpec.requirements || []);
  const constraints = formatBulletList(taskSpec.constraints || []);
  const success = formatBulletList(taskSpec.successCriteria || []);

  if (requirements) {
    lines.push("- Requirements:");
    lines.push(requirements);
  }

  if (constraints) {
    lines.push("- Constraints:");
    lines.push(constraints);
  }

  if (success) {
    lines.push("- Success Criteria:");
    lines.push(success);
  }

  if (taskSpec.outputPath) {
    lines.push(`- Required Output Path: ${taskSpec.outputPath}`);
  }

  if (taskSpec.patternHints && taskSpec.patternHints.length > 0) {
    lines.push("- Pattern Hints:");
    lines.push(formatBulletList(taskSpec.patternHints));
  }

  const text = `${lines.join("\n")}\n`;
  return {
    text,
    usedTokens: approxTokens(text),
    entriesUsed: lines.length,
    entriesTotal: lines.length,
    truncated: false,
  };
}

function buildAgentContext(agentSpec = {}, taskSpec = {}, repoFacts = {}, budgets = {}) {
  const totalBudgetTokens = Number(budgets.totalTokens || 1400);
  const split = resolveBudgets(totalBudgetTokens, budgets.layerBudgets || {});

  const contract = buildContractLayer(agentSpec, taskSpec);
  const remainingBudget = Math.max(0, totalBudgetTokens - contract.usedTokens);

  const secondaryBudgetTotal = split.repoFacts + split.references + split.priorArtifacts;
  const scale = secondaryBudgetTotal > 0 ? remainingBudget / secondaryBudgetTotal : 0;

  const repoFactBudget = Math.floor(split.repoFacts * scale);
  const referencesBudget = Math.floor(split.references * scale);
  const artifactsBudget = Math.floor(split.priorArtifacts * scale);

  const repoFactFit = fitEntriesToBudget(repoFacts.codeFacts || repoFacts.projectFacts || [], repoFactBudget);
  const referenceFit = fitEntriesToBudget(repoFacts.references || [], referencesBudget);
  const artifactFit = fitEntriesToBudget(repoFacts.priorArtifacts || [], artifactsBudget);

  const sections = [contract.text];

  if (repoFactFit.usedEntries.length > 0) {
    sections.push(["## Layer 2: Local Code Facts", formatBulletList(repoFactFit.usedEntries)].join("\n"));
  }

  if (referenceFit.usedEntries.length > 0) {
    sections.push(["## Layer 3: Selected References", formatBulletList(referenceFit.usedEntries)].join("\n"));
  }

  if (artifactFit.usedEntries.length > 0) {
    sections.push(["## Layer 4: Prior Artifacts", formatBulletList(artifactFit.usedEntries)].join("\n"));
  }

  const promptContext = sections.join("\n\n");
  const totalUsedTokens = approxTokens(promptContext);

  const manifest = {
    totalBudgetTokens,
    totalUsedTokens,
    layers: [
      {
        name: "contract",
        budgetTokens: split.contract,
        usedTokens: contract.usedTokens,
        truncated: false,
        entriesUsed: contract.entriesUsed,
        entriesTotal: contract.entriesTotal,
      },
      {
        name: "repo_facts",
        budgetTokens: repoFactBudget,
        usedTokens: repoFactFit.usedTokens,
        truncated: repoFactFit.truncated,
        entriesUsed: repoFactFit.usedEntries.length,
        entriesTotal: repoFactFit.totalEntries,
      },
      {
        name: "references",
        budgetTokens: referencesBudget,
        usedTokens: referenceFit.usedTokens,
        truncated: referenceFit.truncated,
        entriesUsed: referenceFit.usedEntries.length,
        entriesTotal: referenceFit.totalEntries,
      },
      {
        name: "prior_artifacts",
        budgetTokens: artifactsBudget,
        usedTokens: artifactFit.usedTokens,
        truncated: artifactFit.truncated,
        entriesUsed: artifactFit.usedEntries.length,
        entriesTotal: artifactFit.totalEntries,
      },
    ],
  };

  return {
    promptContext,
    manifest,
    tokenEstimate: totalUsedTokens,
  };
}

module.exports = {
  approxTokens,
  buildAgentContext,
};

if (require.main === module) {
  const demo = buildAgentContext(
    { id: "agent-1", role: "Security Analyst", domain: "security" },
    {
      task: "Audit auth flows and produce findings",
      requirements: ["At least 8 findings", "Cite file:line references"],
      constraints: ["Do not modify files"],
      outputPath: "/tmp/rpt-demo-security.md",
    },
    {
      codeFacts: ["src/auth/index.ts handles token verification", "src/api routes are in routes.ts"],
      references: ["references/security-template.md"],
      priorArtifacts: ["/tmp/rpt-demo-triage.md"],
    }
  );

  process.stdout.write(`${JSON.stringify(demo, null, 2)}\n`);
}
