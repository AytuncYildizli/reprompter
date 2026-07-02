#!/usr/bin/env node
"use strict";

const PATTERN_CATALOG = [
  {
    id: "constraint-first-framing",
    title: "Constraint-First Framing",
    guidance: "State hard constraints before implementation details to prevent scope drift.",
    domains: ["all"],
    outcomes: ["all"],
  },
  {
    id: "uncertainty-labeling",
    title: "Uncertainty Labeling",
    guidance: "Require confidence labels (high/medium/low) and explicit assumptions.",
    domains: ["research", "security", "ops"],
    outcomes: ["quality_reliability", "balanced"],
    keywords: ["analysis", "benchmark", "tradeoff", "audit"],
  },
  {
    id: "self-critique-checkpoint",
    title: "Self-Critique Checkpoint",
    guidance: "Add a pre-submit self-review against success criteria.",
    domains: ["all"],
    outcomes: ["quality_reliability", "balanced"],
  },
  {
    id: "delta-retry-scaffold",
    title: "Delta Retry Scaffold",
    guidance: "Retries must target explicit gaps instead of re-running full prompts.",
    domains: ["all"],
    outcomes: ["all"],
  },
  {
    id: "evidence-strength-labeling",
    title: "Evidence Strength Labeling",
    guidance: "Tag findings with evidence strength and cite concrete references.",
    domains: ["research", "security", "ops"],
    outcomes: ["quality_reliability", "balanced"],
    keywords: ["evidence", "finding", "incident", "threat"],
  },
  {
    id: "context-manifest-transparency",
    title: "Context Manifest Transparency",
    guidance: "Emit context manifest with layer/token usage to improve reproducibility.",
    domains: ["all"],
    outcomes: ["all"],
  },
];

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

function matchesDomain(pattern, domain) {
  if (pattern.domains.includes("all")) return true;
  return pattern.domains.includes(domain);
}

function matchesOutcome(pattern, outcome) {
  if (pattern.outcomes.includes("all")) return true;
  return pattern.outcomes.includes(outcome);
}

function matchesKeywords(pattern, text) {
  if (!pattern.keywords || pattern.keywords.length === 0) return true;
  return pattern.keywords.some((keyword) => text.includes(keyword));
}

function selectPatterns(taskSpec = {}, domainInput = "", policy = {}) {
  const domain = normalizeText(domainInput || taskSpec.domain || "all") || "all";
  const outcome = normalizeOutcome(taskSpec.preferredOutcome || taskSpec.outcomePriority);
  const text = normalizeText(`${taskSpec.task || ""} ${taskSpec.motivation || ""}`);
  const maxPatterns = Number(policy.maxPatterns || 6);

  const disabled = new Set((policy.disabledPatterns || []).map((id) => normalizeText(id)));
  const enabled = policy.enabledPatterns
    ? new Set((policy.enabledPatterns || []).map((id) => normalizeText(id)))
    : null;

  const selected = [];
  const reasons = [];

  for (const pattern of PATTERN_CATALOG) {
    const id = normalizeText(pattern.id);

    if (enabled && !enabled.has(id)) continue;
    if (disabled.has(id)) continue;
    if (!matchesDomain(pattern, domain)) continue;
    if (!matchesOutcome(pattern, outcome)) continue;
    if (!matchesKeywords(pattern, text)) continue;

    selected.push(pattern);
    reasons.push(`${pattern.id}: matched domain=${domain}, outcome=${outcome}`);
    if (selected.length >= maxPatterns) break;
  }

  return {
    domain,
    outcome,
    patternIds: selected.map((pattern) => pattern.id),
    patterns: selected,
    reasons,
  };
}

function renderPatternGuidance(selectionResult) {
  if (!selectionResult || !selectionResult.patterns || selectionResult.patterns.length === 0) {
    return "- No optional patterns selected.";
  }

  return selectionResult.patterns
    .map((pattern) => `- ${pattern.title}: ${pattern.guidance}`)
    .join("\n");
}

function getPatternById(id) {
  const normalized = normalizeText(id);
  return PATTERN_CATALOG.find((p) => normalizeText(p.id) === normalized) || null;
}

module.exports = {
  PATTERN_CATALOG,
  selectPatterns,
  renderPatternGuidance,
  getPatternById,
};

if (require.main === module) {
  const task = process.argv.slice(2).join(" ") || "audit auth module and benchmark alternatives";
  const selection = selectPatterns({ task, preferredOutcome: "quality_reliability" }, "security");
  process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`);
  process.stdout.write(`${renderPatternGuidance(selection)}\n`);
}
