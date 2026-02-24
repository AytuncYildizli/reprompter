#!/usr/bin/env node
"use strict";

const PROFILE_PRIORITY = [
  "marketing-swarm",
  "engineering-swarm",
  "ops-swarm",
  "research-swarm",
];

const EXPLICIT_PROFILE_TRIGGERS = [
  { profile: "marketing-swarm", phrases: ["campaign swarm", "marketing swarm"] },
  { profile: "engineering-swarm", phrases: ["engineering swarm"] },
  { profile: "ops-swarm", phrases: ["ops swarm", "operations swarm"] },
  { profile: "research-swarm", phrases: ["research swarm"] },
];

const MULTI_AGENT_TRIGGERS = [
  "repromptverse",
  "reprompter teams",
  "smart run",
  "smart agents",
  "run with quality",
  "multi-agent",
  "parallel agents",
];

const ROUTING_RULES = [
  {
    profile: "marketing-swarm",
    weightedPhrases: [
      "campaign",
      "go to market",
      "go-to-market",
      "growth",
      "seo",
      "content calendar",
      "funnel",
      "conversion",
      "brand",
      "positioning",
      "distribution",
    ],
    keywords: ["launch", "cta", "hook", "audience", "copy"],
  },
  {
    profile: "engineering-swarm",
    weightedPhrases: [
      "feature delivery",
      "test coverage",
      "api contract",
      "code review",
      "integration tests",
      "schema migration",
      "refactor",
      "migration",
      "architecture",
    ],
    keywords: [
      "backend",
      "frontend",
      "database",
      "module",
      "implementation",
      "regression",
      "types",
      "build",
      "compile",
    ],
  },
  {
    profile: "ops-swarm",
    weightedPhrases: [
      "incident response",
      "root cause",
      "postmortem",
      "gateway timeout",
      "service health",
      "error budget",
      "slo",
      "sla",
      "rollback",
      "on-call",
    ],
    keywords: [
      "uptime",
      "latency",
      "cron",
      "alert",
      "infra",
      "reliability",
      "outage",
      "timeout",
      "health",
      "deployment",
    ],
  },
  {
    profile: "research-swarm",
    weightedPhrases: [
      "tradeoff analysis",
      "option analysis",
      "compare options",
      "benchmark",
      "decision memo",
      "evidence quality",
      "competitive analysis",
      "market scan",
      "literature review",
    ],
    keywords: [
      "research",
      "analysis",
      "compare",
      "hypothesis",
      "confidence",
      "findings",
      "evaluate",
      "matrix",
      "insight",
    ],
  },
];

function normalize(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(text, phrase) {
  return text.includes(phrase);
}

function hasKeyword(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(text);
}

function scoreRule(text, rule) {
  let score = 0;
  const hits = [];

  for (const phrase of rule.weightedPhrases) {
    if (hasPhrase(text, phrase)) {
      score += 3;
      hits.push(phrase);
    }
  }

  for (const keyword of rule.keywords) {
    if (hasKeyword(text, keyword)) {
      score += 1;
      hits.push(keyword);
    }
  }

  return { profile: rule.profile, score, hits };
}

function detectExplicitProfile(text) {
  for (const trigger of EXPLICIT_PROFILE_TRIGGERS) {
    if (trigger.phrases.some((p) => hasPhrase(text, p))) {
      return trigger.profile;
    }
  }
  return null;
}

function isMultiAgentIntent(text, options = {}) {
  if (options.forceMultiAgent === true) return true;
  if (options.forceSingle === true) return false;
  return MULTI_AGENT_TRIGGERS.some((p) => hasPhrase(text, p));
}

function rankCandidates(candidates) {
  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return PROFILE_PRIORITY.indexOf(a.profile) - PROFILE_PRIORITY.indexOf(b.profile);
  });
}

function routeIntent(input, options = {}) {
  const text = normalize(input);
  if (!text) {
    return {
      mode: "single",
      profile: "single",
      score: 0,
      hits: [],
      reason: "empty-input",
    };
  }

  const explicitProfile = detectExplicitProfile(text);
  if (explicitProfile) {
    return {
      mode: "multi-agent",
      profile: explicitProfile,
      score: 100,
      hits: [explicitProfile],
      reason: "explicit-profile-trigger",
    };
  }

  const multiAgent = isMultiAgentIntent(text, options);
  if (!multiAgent) {
    return {
      mode: "single",
      profile: "single",
      score: 0,
      hits: [],
      reason: "single-mode-intent",
    };
  }

  const ranked = rankCandidates(ROUTING_RULES.map((rule) => scoreRule(text, rule)));
  const best = ranked[0];
  if (!best || best.score === 0) {
    return {
      mode: "multi-agent",
      profile: "repromptverse",
      score: 0,
      hits: [],
      reason: "generic-multi-agent-fallback",
    };
  }

  return {
    mode: "multi-agent",
    profile: best.profile,
    score: best.score,
    hits: best.hits,
    reason: "rule-match",
  };
}

module.exports = {
  PROFILE_PRIORITY,
  ROUTING_RULES,
  routeIntent,
};

if (require.main === module) {
  const prompt = process.argv.slice(2).join(" ");
  const result = routeIntent(prompt);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
