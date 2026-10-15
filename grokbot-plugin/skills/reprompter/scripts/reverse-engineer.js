#!/usr/bin/env node
"use strict";

const { fingerprint } = require("./recipe-fingerprint");

// --- Task type classification ---

const TASK_TYPE_SIGNALS = [
  {
    type: "code-review",
    template: "bugfix-template",
    phrases: ["code review", "pull request review", "pr review", "review comment"],
    headings: ["critical issues", "suggestions", "what's good", "nitpicks", "summary"],
    patterns: [/\bfile:?\s*\d+/i, /\b[a-z_/]+\.[a-z]+:\d+/i, /\bfix\b/i],
  },
  {
    type: "security-audit",
    template: "security-template",
    phrases: ["security audit", "vulnerability", "threat model", "cve-", "owasp"],
    headings: ["vulnerabilities", "threat model", "risk", "severity", "remediation", "findings"],
    patterns: [/\b(critical|high|medium|low)\s+severity/i, /\bcve-\d+/i],
  },
  {
    type: "architecture-doc",
    template: "research-template",
    phrases: ["architecture", "design doc", "adr", "decision record", "system design"],
    headings: ["overview", "components", "data flow", "tradeoffs", "decision", "alternatives"],
    patterns: [/\b(component|service|layer|module)\b/i],
  },
  {
    type: "api-spec",
    template: "api-template",
    phrases: ["api spec", "endpoint", "api documentation", "swagger", "openapi"],
    headings: ["endpoints", "request", "response", "authentication", "rate limit"],
    patterns: [/\b(GET|POST|PUT|DELETE|PATCH)\s+\//i, /\bstatus\s+\d{3}\b/i],
  },
  {
    type: "test-plan",
    template: "testing-template",
    phrases: ["test plan", "test cases", "test coverage", "test strategy"],
    headings: ["test cases", "coverage", "setup", "teardown", "fixtures", "assertions"],
    patterns: [/\b(describe|it|test|expect|assert)\b/i, /\bshould\b/i],
  },
  {
    type: "bug-report",
    template: "bugfix-template",
    phrases: ["bug report", "issue report", "defect", "regression"],
    headings: ["steps to reproduce", "expected", "actual", "environment", "workaround"],
    patterns: [/\breproduc/i, /\bexpected\s+behavior/i],
  },
  {
    type: "pr-description",
    template: "feature-template",
    phrases: ["pull request", "pr description", "what changed", "changelog"],
    headings: ["what changed", "why", "how to test", "screenshots", "breaking changes"],
    patterns: [/\bfixes?\s+#\d+/i, /\bcloses?\s+#\d+/i],
  },
  {
    type: "documentation",
    template: "docs-template",
    phrases: ["documentation", "readme", "guide", "tutorial", "getting started"],
    headings: ["installation", "usage", "configuration", "api reference", "examples", "faq"],
    patterns: [/```\w+\n/i, /\bnpm\s+(install|run)/i],
  },
  {
    type: "content",
    template: "content-template",
    phrases: ["blog post", "article", "marketing", "announcement", "newsletter"],
    headings: ["introduction", "conclusion", "key takeaways", "tldr"],
    patterns: [/\bin this (article|post|guide)/i],
  },
  {
    type: "research",
    template: "research-template",
    phrases: ["research", "analysis", "comparison", "evaluation", "benchmark"],
    headings: ["methodology", "findings", "results", "recommendations", "conclusion"],
    patterns: [/\b(high|medium|low)\s+confidence/i, /\btradeoff/i],
  },
  {
    type: "ops-report",
    template: "refactor-template",
    phrases: ["incident report", "postmortem", "runbook", "health check"],
    headings: ["timeline", "root cause", "impact", "action items", "lessons learned"],
    patterns: [/\b\d{2}:\d{2}\b/, /\bSLO\b/i, /\blatency\b/i],
  },
];

// --- Structural analysis ---

function extractHeadings(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => /^#{1,6}\s+/.test(line.trim()))
    .map((line) => {
      const match = line.trim().match(/^(#{1,6})\s+(.*)/);
      return match ? { level: match[1].length, text: match[2].trim().toLowerCase() } : null;
    })
    .filter(Boolean);
}

function countBullets(text) {
  return (String(text || "").match(/^\s*[-*+]\s+/gm) || []).length;
}

function countCodeBlocks(text) {
  return (String(text || "").match(/^```/gm) || []).length / 2;
}

function countTables(text) {
  return (String(text || "").match(/^\|.+\|$/gm) || []).length > 0
    ? (String(text || "").match(/^\|[-:| ]+\|$/gm) || []).length
    : 0;
}

function countLineRefs(text) {
  const matches = String(text || "").match(/\b[^\s:]+\.[a-z]+:\d+(?::\d+)?\b/g);
  return matches ? matches.length : 0;
}

function avgSentenceLength(text) {
  const sentences = String(text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\|[^|]+\|/g, "")
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
  if (sentences.length === 0) return 0;
  const totalWords = sentences.reduce(
    (sum, s) => sum + s.split(/\s+/).length,
    0
  );
  return Math.round(totalWords / sentences.length);
}

function sectionCount(text) {
  return extractHeadings(text).filter((h) => h.level <= 3).length;
}

function analyzeStructure(text) {
  const headings = extractHeadings(text);
  const lines = String(text || "").split(/\r?\n/);
  return {
    headings,
    headingCount: headings.length,
    sectionNames: headings.map((h) => h.text),
    bulletCount: countBullets(text),
    bulletDensity: lines.length > 0
      ? Number((countBullets(text) / lines.length).toFixed(2))
      : 0,
    codeBlockCount: Math.floor(countCodeBlocks(text)),
    tableCount: countTables(text),
    lineRefCount: countLineRefs(text),
    avgSentenceLength: avgSentenceLength(text),
    totalLines: lines.length,
    totalChars: text.length,
  };
}

// --- Tone detection ---

const FORMAL_MARKERS = [
  "therefore", "consequently", "furthermore", "moreover", "however",
  "nevertheless", "accordingly", "pursuant", "herein", "shall",
];

const CASUAL_MARKERS = [
  "basically", "pretty much", "kinda", "gonna", "wanna", "stuff",
  "cool", "awesome", "btw", "fyi", "tbh", "imho", "lol",
];

const DIRECTIVE_MARKERS = [
  "must", "should", "do not", "ensure", "verify", "always", "never",
  "require", "mandate", "enforce",
];

function detectTone(text) {
  const lower = String(text || "").toLowerCase();
  const formalCount = FORMAL_MARKERS.filter((m) => lower.includes(m)).length;
  const casualCount = CASUAL_MARKERS.filter((m) => lower.includes(m)).length;
  const directiveCount = DIRECTIVE_MARKERS.filter((m) => lower.includes(m)).length;

  let formality = "neutral";
  if (formalCount > casualCount + 1) formality = "formal";
  else if (casualCount > formalCount + 1) formality = "casual";

  const isDirective = directiveCount >= 3;

  return { formality, isDirective, formalCount, casualCount, directiveCount };
}

// --- Domain detection ---

const DOMAIN_KEYWORDS = {
  frontend: ["react", "vue", "angular", "css", "html", "component", "ui", "dom", "browser", "nextjs", "next.js", "tailwind"],
  backend: ["server", "api", "endpoint", "middleware", "controller", "service", "route", "express", "fastify"],
  security: ["vulnerability", "auth", "session", "token", "csrf", "xss", "injection", "encryption", "certificate"],
  database: ["query", "schema", "migration", "index", "table", "orm", "prisma", "drizzle", "sql"],
  infrastructure: ["deploy", "docker", "kubernetes", "ci/cd", "pipeline", "terraform", "aws", "cloud"],
  ops: ["monitoring", "alerting", "latency", "slo", "incident", "uptime", "health check", "observability"],
  mobile: ["ios", "android", "react native", "flutter", "swift", "kotlin"],
  ml: ["model", "training", "inference", "dataset", "embedding", "fine-tune", "llm", "prompt"],
};

function detectDomain(text) {
  const lower = String(text || "").toLowerCase();
  const scores = {};

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    scores[domain] = keywords.filter((kw) => lower.includes(kw)).length;
  }

  const sorted = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  return {
    primary: sorted.length > 0 ? sorted[0][0] : "general",
    secondary: sorted.length > 1 ? sorted[1][0] : null,
    scores,
  };
}

// --- Task type classification ---

function classifyTaskType(text, structure) {
  const lower = String(text || "").toLowerCase();
  const sectionNames = structure.sectionNames || [];

  const scored = TASK_TYPE_SIGNALS.map((signal) => {
    let score = 0;

    for (const phrase of signal.phrases) {
      if (lower.includes(phrase)) score += 3;
    }

    for (const heading of signal.headings) {
      if (sectionNames.some((s) => s.includes(heading))) score += 2;
    }

    for (const pattern of signal.patterns) {
      if (pattern.test(text)) score += 1;
    }

    return { type: signal.type, template: signal.template, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (!best || best.score < 2) {
    return { type: "general", template: "feature-template", score: 0, confidence: "low" };
  }

  return {
    type: best.type,
    template: best.template,
    score: best.score,
    confidence: best.score >= 5 ? "high" : best.score >= 3 ? "medium" : "low",
  };
}

// --- Quality analysis ---

function analyzeQuality(text, structure) {
  const specificity = Math.min(10, Math.round(
    (structure.lineRefCount > 0 ? 3 : 0) +
    (structure.bulletCount >= 3 ? 2 : structure.bulletCount >= 1 ? 1 : 0) +
    (structure.codeBlockCount > 0 ? 2 : 0) +
    (structure.avgSentenceLength > 8 && structure.avgSentenceLength < 25 ? 2 : 0) +
    (structure.headingCount >= 2 ? 1 : 0)
  ));

  const coverage = Math.min(10, Math.round(
    (structure.headingCount >= 4 ? 3 : structure.headingCount >= 2 ? 2 : 0) +
    (structure.totalLines >= 20 ? 2 : structure.totalLines >= 10 ? 1 : 0) +
    (structure.bulletCount >= 5 ? 2 : structure.bulletCount >= 2 ? 1 : 0) +
    (structure.codeBlockCount > 0 ? 1 : 0) +
    (structure.tableCount > 0 ? 1 : 0) +
    1 // baseline
  ));

  const clarity = Math.min(10, Math.round(
    (structure.headingCount >= 2 ? 3 : structure.headingCount >= 1 ? 1 : 0) +
    (structure.bulletDensity > 0.05 && structure.bulletDensity < 0.6 ? 2 : 0) +
    (structure.avgSentenceLength >= 8 && structure.avgSentenceLength <= 20 ? 3 : 1) +
    (structure.totalChars > 200 ? 1 : 0) +
    1 // baseline
  ));

  return { specificity, coverage, clarity };
}

// --- Output format inference ---

function inferOutputFormat(structure) {
  const parts = [];

  if (structure.headingCount > 0) {
    const levels = [...new Set(structure.headings.map((h) => h.level))].sort();
    parts.push(`Markdown with ${levels.map((l) => `${"#".repeat(l)}`).join("/")} headers`);
  } else {
    parts.push("Plain text or minimal markdown");
  }

  if (structure.bulletCount > 0) {
    parts.push("bullet points for details");
  }
  if (structure.codeBlockCount > 0) {
    parts.push(`${structure.codeBlockCount} code block(s)`);
  }
  if (structure.tableCount > 0) {
    parts.push("table(s) for structured data");
  }
  if (structure.lineRefCount > 0) {
    parts.push("file:line references for traceability");
  }

  const lineRange = structure.totalLines > 50
    ? "50+ lines (detailed)"
    : structure.totalLines > 20
      ? "20-50 lines (moderate)"
      : "under 20 lines (concise)";
  parts.push(lineRange);

  return parts.join(", ");
}

// --- Section-based constraint extraction ---

function inferConstraints(text, structure, taskType) {
  const constraints = [];
  const lower = String(text || "").toLowerCase();

  // Scope constraints: infer from what the exemplar does NOT cover
  if (structure.headingCount > 0) {
    constraints.push(`Match the exemplar's ${structure.headingCount}-section structure`);
  }

  // Tone constraints
  const tone = detectTone(text);
  if (tone.formality === "formal") {
    constraints.push("Use formal, professional tone");
  } else if (tone.formality === "casual") {
    constraints.push("Keep tone casual and approachable");
  }

  if (tone.isDirective) {
    constraints.push("Use directive language (must, should, ensure)");
  }

  // Evidence constraints
  if (structure.lineRefCount > 0) {
    constraints.push("Include file:line references for every finding");
  }
  if (structure.codeBlockCount > 0) {
    constraints.push("Include code examples where relevant");
  }

  // Domain-specific constraints
  if (taskType.type === "code-review") {
    if (lower.includes("what's good") || lower.includes("positive") || lower.includes("praise")) {
      constraints.push("Balance critical findings with positive feedback");
    }
  }
  if (taskType.type === "security-audit") {
    constraints.push("Classify findings by severity (critical/high/medium/low)");
  }

  constraints.push("Do not reproduce the exemplar's specific content - extract the pattern, not the data");

  return constraints;
}

// --- Main reverse engineering function ---

function reverseEngineer(exemplarText, options = {}) {
  const text = String(exemplarText || "");
  if (!text.trim()) {
    return {
      error: "Empty exemplar text",
      analysis: null,
      prompt: null,
      recipe: null,
    };
  }

  const structure = analyzeStructure(text);
  const taskType = classifyTaskType(text, structure);
  const domain = detectDomain(text);
  const tone = detectTone(text);
  const quality = analyzeQuality(text, structure);
  const outputFormat = inferOutputFormat(structure);
  const constraints = inferConstraints(text, structure, taskType);

  const analysis = {
    structure,
    taskType,
    domain,
    tone,
    quality,
  };

  // Build the reverse-engineered prompt
  const prompt = {
    role: buildRole(taskType, domain, tone),
    context: buildContext(taskType, domain, structure, tone),
    task: buildTask(taskType, structure),
    motivation: options.motivation || "Reproduce this quality level consistently across similar tasks.",
    requirements: buildRequirements(structure, quality, taskType),
    constraints,
    outputFormat,
    successCriteria: buildSuccessCriteria(structure, quality, taskType),
  };

  // Score the reverse-engineered prompt
  const score = scoreReversePrompt(prompt);

  // Build flywheel recipe
  const recipe = fingerprint({
    templateId: taskType.template,
    patterns: ["reverse-extraction"],
    capabilityTier: "reasoning_high",
    domain: domain.primary,
    contextLayers: 1,
    qualityScore: score.overall,
  });

  return {
    analysis,
    prompt,
    score,
    recipe,
    templateId: taskType.template,
  };
}

function buildRole(taskType, domain, tone) {
  const domainExpertise = domain.primary !== "general"
    ? ` with expertise in ${domain.primary}`
    : "";
  const secondaryNote = domain.secondary
    ? ` and ${domain.secondary}`
    : "";

  const roleMap = {
    "code-review": `Senior code reviewer${domainExpertise}${secondaryNote}, focused on correctness, security, and actionable feedback`,
    "security-audit": `Security specialist${domainExpertise}${secondaryNote}, focused on vulnerability identification and remediation`,
    "architecture-doc": `Software architect${domainExpertise}${secondaryNote}, focused on system design and technical documentation`,
    "api-spec": `API designer${domainExpertise}${secondaryNote}, focused on clear endpoint specification and developer experience`,
    "test-plan": `QA engineer${domainExpertise}${secondaryNote}, focused on comprehensive test coverage and edge cases`,
    "bug-report": `Senior developer${domainExpertise}${secondaryNote}, focused on systematic debugging and clear issue reporting`,
    "pr-description": `Senior developer${domainExpertise}${secondaryNote}, focused on clear change documentation and review facilitation`,
    "documentation": `Technical writer${domainExpertise}${secondaryNote}, focused on clear, example-driven documentation`,
    "content": `Content creator${domainExpertise}${secondaryNote}, focused on engaging and informative writing`,
    "research": `Research analyst${domainExpertise}${secondaryNote}, focused on evidence-based analysis and actionable recommendations`,
    "ops-report": `SRE/DevOps engineer${domainExpertise}${secondaryNote}, focused on incident analysis and operational improvement`,
    "general": `Specialist${domainExpertise}${secondaryNote}`,
  };

  return roleMap[taskType.type] || roleMap.general;
}

function buildContext(taskType, domain, structure, tone) {
  const parts = [];
  parts.push(`Output type: ${taskType.type.replace(/-/g, " ")}`);
  parts.push(`Domain: ${domain.primary}${domain.secondary ? ` + ${domain.secondary}` : ""}`);

  const depth = structure.lineRefCount > 3 ? "deep"
    : structure.codeBlockCount > 2 ? "deep"
    : structure.totalLines > 30 ? "moderate"
    : "concise";
  parts.push(`Technical depth: ${depth}`);
  parts.push(`Tone: ${tone.formality}${tone.isDirective ? ", directive" : ""}`);

  if (structure.headingCount > 0) {
    parts.push(`Structure: ${structure.headingCount} sections (${structure.sectionNames.slice(0, 5).join(", ")})`);
  }

  return parts;
}

function buildTask(taskType, structure) {
  const taskMap = {
    "code-review": "Review code changes for correctness, security issues, and improvement opportunities, with actionable fix suggestions for every finding.",
    "security-audit": "Audit the target for security vulnerabilities, classify by severity, and provide remediation guidance for each finding.",
    "architecture-doc": "Document the system architecture with component descriptions, data flow, tradeoffs, and decision rationale.",
    "api-spec": "Specify API endpoints with request/response schemas, authentication requirements, and error handling.",
    "test-plan": "Design a comprehensive test plan covering happy paths, edge cases, and error scenarios with clear assertions.",
    "bug-report": "Document the bug with reproduction steps, expected vs actual behavior, and environment details.",
    "pr-description": "Describe the changes, motivation, testing approach, and any breaking changes.",
    "documentation": "Write clear, example-driven documentation covering installation, usage, configuration, and common patterns.",
    "content": "Create engaging content that informs the reader and drives the intended action.",
    "research": "Analyze the topic systematically, present evidence-based findings, and provide actionable recommendations.",
    "ops-report": "Document the operational event with timeline, root cause, impact, and action items.",
    "general": "Produce a well-structured output matching the exemplar's quality and organizational pattern.",
  };

  return taskMap[taskType.type] || taskMap.general;
}

function buildRequirements(structure, quality, taskType) {
  const requirements = [];

  // Structure requirements
  if (structure.headingCount > 0) {
    requirements.push(
      `Structure: Use ${structure.headingCount} sections (${structure.sectionNames.slice(0, 6).join(", ")})`
    );
  }

  // Depth requirements
  if (structure.lineRefCount > 0) {
    requirements.push(`Traceability: Include file:line references (exemplar has ${structure.lineRefCount})`);
  }
  if (structure.codeBlockCount > 0) {
    requirements.push(`Code examples: Include ${structure.codeBlockCount}+ code block(s)`);
  }

  // Coverage requirements
  requirements.push(
    `Coverage: Address ${structure.headingCount || "all relevant"} topic areas at ${
      quality.coverage >= 7 ? "comprehensive" : quality.coverage >= 4 ? "moderate" : "concise"
    } depth`
  );

  // Style requirements
  if (structure.bulletCount > 3) {
    requirements.push("Use bullet points for detailed items");
  }
  if (structure.tableCount > 0) {
    requirements.push("Use tables for structured comparisons or data");
  }

  // Ensure minimum 3 requirements
  if (requirements.length < 3) {
    requirements.push("Match the exemplar's level of specificity and actionability");
  }

  return requirements;
}

function buildSuccessCriteria(structure, quality, taskType) {
  const criteria = [];

  criteria.push("Output follows the same structural pattern as the exemplar");

  if (structure.lineRefCount > 0) {
    criteria.push("All findings include file:line references");
  }

  if (quality.specificity >= 7) {
    criteria.push("Specificity matches or exceeds the exemplar (concrete, not vague)");
  }

  criteria.push("Content is original but structurally equivalent to the exemplar");

  if (taskType.type === "code-review" || taskType.type === "security-audit") {
    criteria.push("Every finding has an actionable fix or recommendation");
  }

  if (taskType.type === "research") {
    criteria.push("Recommendations include confidence levels");
  }

  return criteria;
}

// --- Prompt scoring ---

function scoreReversePrompt(prompt) {
  let clarity = 5;
  if (prompt.role && prompt.role.length > 20) clarity += 2;
  if (prompt.task && prompt.task.length > 30) clarity += 2;
  if (prompt.context && prompt.context.length >= 3) clarity += 1;

  let specificity = 5;
  if (prompt.requirements && prompt.requirements.length >= 3) specificity += 2;
  if (prompt.constraints && prompt.constraints.length >= 2) specificity += 2;
  if (prompt.successCriteria && prompt.successCriteria.length >= 2) specificity += 1;

  let structure = 8; // template ensures structure

  let constraints = 5;
  if (prompt.constraints && prompt.constraints.length >= 3) constraints += 3;
  if (prompt.constraints && prompt.constraints.length >= 5) constraints += 2;

  let verifiability = 5;
  if (prompt.successCriteria && prompt.successCriteria.length >= 2) verifiability += 3;
  if (prompt.outputFormat && prompt.outputFormat.length > 20) verifiability += 2;

  clarity = Math.min(10, clarity);
  specificity = Math.min(10, specificity);
  structure = Math.min(10, structure);
  constraints = Math.min(10, constraints);
  verifiability = Math.min(10, verifiability);

  const overall = Number(
    (
      clarity * 0.2 +
      specificity * 0.2 +
      structure * 0.15 +
      constraints * 0.15 +
      verifiability * 0.15 +
      8 * 0.15 // decomposition: reverse prompts are inherently single-task
    ).toFixed(2)
  );

  return { clarity, specificity, structure, constraints, verifiability, decomposition: 8, overall };
}

// --- Flywheel exemplar injection ---

function buildExemplarOutcome(reverseResult, options = {}) {
  if (!reverseResult || !reverseResult.recipe) return null;

  return {
    runId: options.runId || `rpt-reverse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId: options.taskId || `reverse-${reverseResult.analysis.taskType.type}-${Date.now().toString(36)}`,
    recipe: reverseResult.recipe,
    signals: {
      artifactScore: reverseResult.score.overall,
      artifactPass: reverseResult.score.overall >= 8,
      retryCount: 0,
      userVerdict: options.userVerdict || "accept",
      source: "reverse-exemplar",
    },
    effectivenessScore: Math.min(10, reverseResult.score.overall + 0.5), // exemplar bonus
  };
}

module.exports = {
  analyzeStructure,
  detectTone,
  detectDomain,
  classifyTaskType,
  analyzeQuality,
  inferOutputFormat,
  inferConstraints,
  reverseEngineer,
  scoreReversePrompt,
  buildExemplarOutcome,
};

if (require.main === module) {
  const fs = require("node:fs");
  const filePath = process.argv[2];
  if (!filePath) {
    process.stderr.write("Usage: node scripts/reverse-engineer.js <exemplar-file>\n");
    process.exit(1);
  }
  const text = fs.readFileSync(filePath, "utf8");
  const result = reverseEngineer(text);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
