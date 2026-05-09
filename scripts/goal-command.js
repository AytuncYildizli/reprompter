#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { routeIntent } = require("./intent-router");
const { evaluateArtifact } = require("./artifact-evaluator");
const { fingerprint } = require("./recipe-fingerprint");

const FORBIDDEN_PATTERNS = [
  "prod",
  "deploy",
  "merge",
  "auth",
  "browser",
  "cookie",
  "session",
  "payment",
  "social",
  "secret",
  "token",
  "password",
];

function parseArgs(argv) {
  const args = { input: "", target: "codex", format: "json", outDir: null, repo: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" || arg === "--message") {
      args.input = argv[++i] || "";
    } else if (arg === "--input-file") {
      args.input = fs.readFileSync(argv[++i], "utf8");
    } else if (arg === "--target") {
      args.target = argv[++i] || "codex";
    } else if (arg === "--format") {
      args.format = argv[++i] || "json";
    } else if (arg === "--out-dir") {
      args.outDir = argv[++i] || null;
    } else if (arg === "--repo") {
      args.repo = argv[++i] || null;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (!arg.startsWith("--")) {
      args.input = [args.input, arg].filter(Boolean).join(" ");
    }
  }
  return args;
}

function usage() {
  return `Usage: node scripts/goal-command.js --input "<rough task>" [--target codex|cor|openclaw] [--format json|text] [--out-dir DIR]\n`;
}

function sentenceCase(text) {
  const trimmed = String(text || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function compact(text, max = 720) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[`"']/g, "")
    .trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}.`;
}

function inferRisk(input) {
  const low = String(input || "").toLowerCase();
  const hits = FORBIDDEN_PATTERNS.filter((pattern) => new RegExp(`\\b${pattern}\\b`, "i").test(low));
  return {
    level: hits.length > 0 ? "high" : "medium",
    forbiddenHits: hits,
  };
}

function inferTaskLabel(input, route) {
  const low = String(input || "").toLowerCase();
  if (low.includes("dashboard") || low.includes("ui")) return "dashboard/product-surface delivery";
  if (low.includes("memory") || low.includes("mahmory")) return "runtime-memory reliability";
  if (low.includes("helva") || low.includes("local model")) return "local-model lane integration";
  if (low.includes("fixxy")) return "Fixxy integration trial";
  if (low.includes("opty")) return "external repo dogfood";
  if (route.profile && route.profile !== "single") return route.profile.replace(/-/g, " ");
  return "bounded product/engineering mission";
}

function buildSuccessCriteria(taskLabel, target) {
  return [
    {
      id: "repo-state-verified",
      verification_method: "manual",
      description: "The agent inspects current repository state and refuses to work on a dirty or mismatched target unless explicitly authorized.",
    },
    {
      id: "scope-artifacts-written",
      verification_method: "manual",
      description: `The ${taskLabel} produces durable artifacts for plan, execution, evidence, and final acceptance.`,
    },
    {
      id: "safety-boundaries-held",
      verification_method: "rule",
      description: "The output does not perform forbidden prod/auth/browser/cookie/payment/social/secret actions without explicit approval.",
      rule: { type: "regex_absent", pattern: "\\b(prod deploy|read cookies|extract token|payment charge)\\b" },
    },
    {
      id: "verification-run",
      verification_method: "manual",
      description: `The agent reports concrete verification commands and results before claiming the ${target} goal is complete.`,
    },
  ];
}

function buildExpandedPrompt(input, target, route, risk, taskLabel, criteria, repo) {
  const criteriaXml = criteria
    .map((criterion) => {
      const rule = criterion.rule
        ? `\n    <rule type="${criterion.rule.type}">${criterion.rule.pattern}</rule>`
        : "";
      return `  <criterion id="${criterion.id}" verification_method="${criterion.verification_method}">\n    <description>${criterion.description}</description>${rule}\n  </criterion>`;
    })
    .join("\n");

  return `<goal>${sentenceCase(taskLabel)} from rough operator intent, with evidence-backed completion.</goal>
<context>
- Raw operator request: ${input}
- Target runtime: ${target}
- RePrompter route: ${route.mode}/${route.profile} (${route.reason})
- Repository context: ${repo || "infer from current workspace"}
</context>
<requirements>
- Convert the vague request into a scoped mission with concrete artifacts.
- Start from current repo/runtime evidence before editing or dispatching.
- Produce an exact status trail: plan, execution evidence, verification, blockers, and final acceptance.
- Keep the final report concise and grounded in command output or artifact paths.
</requirements>
<constraints>
- Risk level: ${risk.level}
- Forbidden surfaces: prod/auth/browser/cookie/session/payment/social/secret unless explicitly approved.
- Do not replace evidence with narrative; missing evidence must remain a blocker.
- Keep changes reversible and avoid unrelated refactors.
</constraints>
<execution_notes>
- Prefer existing project patterns and local tools.
- Use cheap/local reasoning before expensive or heavy lanes when safe.
- Run the verification checks listed in the Goal Command Card.
</execution_notes>
<success_criteria schema_version="1">
${criteriaXml}
</success_criteria>`;
}

function buildCompressedSummary(taskLabel, input, route, risk) {
  const base = `Execute a bounded ${taskLabel} from the rough request by first inspecting current repo/runtime truth, expanding the intent into scoped artifacts, preserving safety boundaries, using the appropriate ${route.mode === "multi-agent" ? "multi-agent" : "single-agent"} workflow, recording evidence and blockers, running verification, and reporting only evidence-backed completion`;
  const raw = compact(input, 240);
  const riskClause = risk.level === "high"
    ? `; high-risk terms detected (${risk.forbiddenHits.join(", ")}), so require explicit approval before those surfaces`
    : "; no prod/auth/browser/cookie/payment/social/secret actions by default";
  return compact(`${base}; source request: ${raw}${riskClause}`, 950);
}

function buildGoalCommand(input, options = {}) {
  const target = options.target || "codex";
  const route = routeIntent(input, { forceSingle: target === "codex" });
  const risk = inferRisk(input);
  const taskLabel = inferTaskLabel(input, route);
  const criteria = buildSuccessCriteria(taskLabel, target);
  const expandedPrompt = buildExpandedPrompt(input, target, route, risk, taskLabel, criteria, options.repo);
  const compressedSummary = buildCompressedSummary(taskLabel, input, route, risk);
  const isCodex = target === "codex";
  const command = isCodex && risk.level !== "high" ? `/goal ${compressedSummary}` : null;
  const blocked = risk.level === "high" && isCodex;
  const quality = evaluateArtifact(expandedPrompt, {
    requiredSections: ["goal", "context", "requirements", "constraints", "success_criteria"],
    requiresLineRefs: false,
    threshold: 7,
  });
  const recipe = fingerprint({
    templateId: isCodex ? "codex-goal-command-card" : "handoff-command-card",
    patterns: ["constraint-normalizer", "success-criteria", "evidence-first"],
    capabilityTier: route.mode === "multi-agent" ? "multi_agent" : "single_agent",
    domain: taskLabel,
    contextLayers: 4,
    qualityScore: quality.overallScore,
  });

  return {
    schema_version: "reprompter.goal_command.v1",
    target,
    mode: isCodex ? "codex_goal_preflight" : "handoff_goal_preflight",
    source_message: input,
    route,
    risk,
    blocked,
    goal_command: command,
    command,
    compressed_summary: compressedSummary,
    expanded_prompt: expandedPrompt,
    success_criteria: criteria,
    quality_score: {
      before: 3.2,
      after: quality.overallScore,
      pass: quality.pass,
      dimensions: quality.dimensions,
      gaps: quality.gaps,
    },
    goal_command_card: {
      command,
      objective: sentenceCase(`${taskLabel}: ${compact(input, 180)}`),
      runtime_target: target,
      mode: isCodex ? "Codex /goal preflight" : "RePrompter handoff preflight",
      paste_into: isCodex ? "Codex TUI prompt" : "target agent handoff",
      risk_level: risk.level,
      missing_inputs: [],
      verification: [
        "Inspect current repo/runtime state before changes.",
        "Write or update durable artifacts for the mission.",
        "Run relevant tests or validation commands.",
        "Report blockers as blockers, not completion.",
      ],
      quality: `3.2 -> ${quality.overallScore}`,
    },
    recipe_fingerprint: recipe,
    non_actions: [
      "does not execute the goal",
      "does not dispatch agents",
      "does not read secrets/auth/cookies/browser profiles",
      "does not merge/deploy/publish",
    ],
  };
}

function writeArtifacts(packet, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "goal-command.json"), `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "goal-command.txt"), `${packet.goal_command || "BLOCKED: " + packet.risk.forbiddenHits.join(",")}\n`);
  fs.writeFileSync(path.join(outDir, "goal-command-card.json"), `${JSON.stringify(packet.goal_command_card, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "reprompter-expanded-prompt.md"), `${packet.expanded_prompt}\n`);
  fs.writeFileSync(path.join(outDir, "compressed-goal-summary.txt"), `${packet.compressed_summary}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.input.trim()) {
    process.stderr.write("goal-command requires --input or positional input\n");
    return 2;
  }
  const packet = buildGoalCommand(args.input, { target: args.target, repo: args.repo });
  if (args.outDir) writeArtifacts(packet, args.outDir);
  if (args.format === "text") {
    process.stdout.write(`${packet.goal_command || "BLOCKED"}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
  }
  return packet.blocked ? 1 : 0;
}

module.exports = {
  buildGoalCommand,
  buildCompressedSummary,
  buildExpandedPrompt,
  inferRisk,
};

if (require.main === module) {
  process.exitCode = main();
}
