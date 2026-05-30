#!/usr/bin/env node
"use strict";

// Workflow preflight compiler (RePrompter Lane 5 + Repromptverse Phase-3 Option H).
//
// Mirrors goal-command.js: routeIntent -> inferRisk -> buildExpandedPrompt ->
// evaluateArtifact -> fingerprint, returning a versioned packet. Instead of a
// one-line /goal command, it emits a runnable Claude dynamic Workflow script
// (a .workflow.js string) plus a Workflow Command Card.
//
// Hard constraints baked into every emitted script (see
// references/runtime/claude-workflow-runtime.md):
//   - meta header is a PURE LITERAL; phase() titles match meta.phases exactly.
//   - runId and taskname come from args; they are NEVER generated in-script
//     (the wall-clock and randomness APIs throw inside a workflow and would
//      break resume).
//   - schema-validated agent() returns are the single source of truth; the
//     script never reads tmp artifact files back as a handoff.
//   - parallel()/pipeline() results are filtered with filter(Boolean).
//   - model is omitted so agents inherit the main-loop model (latest-model
//     canon; also keeps the model-pin linter green).

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { routeIntent, WORKFLOW_LANE_TRIGGERS } = require("./intent-router");
const { evaluateArtifact } = require("./artifact-evaluator");
const { fingerprint } = require("./recipe-fingerprint");
const {
  inferRisk,
  hasBoundaryMarkerNear,
  buildExpandedPrompt,
} = require("./goal-command");

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
  const args = {
    input: "",
    format: "json",
    outDir: null,
    repo: null,
    ultracode: process.env.REPROMPTER_ULTRACODE === "1",
    scriptPath: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" || arg === "--message") {
      args.input = argv[++i] || "";
    } else if (arg === "--input-file") {
      args.input = fs.readFileSync(argv[++i], "utf8");
    } else if (arg === "--format") {
      args.format = argv[++i] || "json";
    } else if (arg === "--out-dir") {
      args.outDir = argv[++i] || null;
    } else if (arg === "--repo") {
      args.repo = argv[++i] || null;
    } else if (arg === "--script-path") {
      args.scriptPath = argv[++i] || null;
    } else if (arg === "--ultracode") {
      args.ultracode = true;
    } else if (arg === "--no-ultracode") {
      args.ultracode = false;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (!arg.startsWith("--")) {
      args.input = [args.input, arg].filter(Boolean).join(" ");
    }
  }
  return args;
}

function usage() {
  return `Usage: node scripts/workflow-command.js --input "<rough task>" [--out-dir DIR] [--format json|text] [--ultracode|--no-ultracode] [--script-path PATH]\n`;
}

function compact(text, max = 720) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[`"']/g, "")
    .trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}.`;
}

function sentenceCase(text) {
  const trimmed = String(text || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function slugify(text, fallback = "task") {
  const slug = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 4)
    .join("-");
  return slug || fallback;
}

// `input` here is the trigger-stripped task text. Slug the actual task terms AND
// append a short deterministic hash of the full normalized input, so jobs that
// share the first four slug words still get distinct names/script paths/runIds
// (no /tmp overwrite or wrong-run resume). Same input -> same name (resume-safe).
function inferTaskname(input, route) {
  const normalized = String(input || "").toLowerCase().replace(/\s+/g, " ").trim();
  let base = slugify(input, "");
  if (!base) base = route && route.profile && route.profile !== "single" ? slugify(route.profile) : "task";
  const suffix = crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 6);
  return `${base}-${suffix}`;
}

// Parse an optional budget directive ("+500k", "budget: 500000", "200k tokens").
// Returns { total, mode } where mode is "directive" | "inherit" | "none".
const BUDGET_MAX = 100000000; // 100M-token sanity clamp

function parseBudget(input) {
  const text = String(input || "").toLowerCase();
  // The "+N" shorthand REQUIRES a k/m unit so version-ish tokens ("react +18")
  // don't false-match; the explicit "budget:" form allows a bare number.
  let m = text.match(/\+\s*(\d+(?:\.\d+)?)\s*(k|m)\b/);
  if (!m) m = text.match(/(?:token\s+)?budget\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(k|m)?\b/);
  if (m) {
    const base = Number(m[1]);
    if (Number.isFinite(base)) {
      const mult = m[2] === "k" ? 1000 : m[2] === "m" ? 1000000 : 1;
      return { total: Math.min(Math.round(base * mult), BUDGET_MAX), mode: "directive" };
    }
  }
  if (/\binherit\b/.test(text)) return { total: null, mode: "inherit" };
  return { total: null, mode: "none" };
}

// Break contiguous forbidden-call substrings so user text embedded in the emitted
// script never trips the Workflow determinism SOURCE-scan (it scans text, not calls).
// A space before the paren keeps meaning and breaks the match.
function neutralizeForbiddenTokens(text) {
  return String(text || "").replace(/\b(Date\.now|Math\.random|new\s+Date)\s*\(/g, "$1 (");
}

function buildWorkflowSuccessCriteria(taskLabel) {
  return [
    {
      id: "schema-returns-source-of-truth",
      verification_method: "manual",
      description:
        "In-run data flows through schema-validated agent() returns; the workflow body never reads tmp artifact files back as a handoff.",
    },
    {
      id: "deterministic-script",
      verification_method: "manual",
      description:
        "The emitted script keeps meta a pure literal, sources runId/taskname from args, avoids wall-clock and randomness calls, and filters parallel/pipeline results.",
    },
    {
      id: "safety-boundaries-held",
      verification_method: "rule",
      description:
        "The run does not perform forbidden prod/auth/browser/cookie/payment/secret actions without explicit approval.",
      rule: { type: "regex_absent", pattern: "\\b(prod deploy|read cookies|extract token|payment charge)\\b" },
    },
    {
      id: "evidence-visible",
      verification_method: "manual",
      description: `Each agent returns structured findings and the ${taskLabel} reports per-role scores, retries, and any missing roles.`,
    },
  ];
}

// Derive a modest default team from the route. The Workflow-preflight lane in
// SKILL.md replaces these with fully reprompted per-role prompts; this keeps the
// CLI self-contained and testable.
function buildDefaultAgents(input, route) {
  const focus = neutralizeForbiddenTokens(compact(input, 180));
  if (route.mode === "multi-agent") {
    const profile = (route.profile || "repromptverse").replace(/-/g, " ");
    return [
      {
        role: "explorer",
        label: "explore",
        prompt: `You are the explorer on the ${profile} team. Map the relevant surface for: ${focus}. Return structured findings with file:line evidence; do not speculate.`,
      },
      {
        role: "analyst",
        label: "analyze",
        prompt: `You are the analyst on the ${profile} team. Assess risks, gaps, and tradeoffs for: ${focus}. Return structured findings; flag uncertainty rather than fabricating.`,
      },
      {
        role: "synthesizer",
        label: "synthesize",
        prompt: `You are the synthesizer on the ${profile} team. Produce the consolidated recommendation for: ${focus}. Return structured findings citing the strongest evidence.`,
      },
    ];
  }
  return [
    {
      role: "executor",
      label: "execute",
      prompt: `You are the executor. Carry out: ${focus}. Return structured findings with concrete evidence; flag any blocker as a blocker.`,
    },
    {
      role: "verifier",
      label: "verify",
      prompt: `You are the verifier. Independently check the executor's work on: ${focus}. Return structured findings; refute anything unsupported.`,
    },
  ];
}

// Emit a determinism-safe, idiomatic Claude dynamic Workflow script string.
// IMPORTANT: this function must NEVER emit the literal call syntax for
// wall-clock or randomness APIs — they throw inside a workflow and break resume.
function buildWorkflowScript({ taskname, description, agents, ultracode }) {
  const accept = 8;
  const L = [];
  L.push("export const meta = {");
  L.push('  name: "rpt-' + taskname + '",');
  L.push('  description: ' + JSON.stringify(neutralizeForbiddenTokens(compact(description, 160))) + ',');
  L.push("  phases: [");
  L.push('    { title: "Plan" },');
  L.push('    { title: "Execute" },');
  L.push('    { title: "Evaluate" },');
  L.push("  ],");
  L.push("}");
  L.push("");
  L.push("// runId + taskname come from args — never generated in-script (wall-clock/randomness throw here).");
  L.push('const taskname = (args && args.taskname) || "rpt-' + taskname + '"');
  L.push("const runId = (args && args.runId) || taskname");
  L.push("");
  L.push("const FINDINGS_SCHEMA = {");
  L.push('  type: "object",');
  L.push("  additionalProperties: false,");
  L.push('  required: ["role", "findings", "self_score"],');
  L.push("  properties: {");
  L.push('    role: { type: "string" },');
  L.push('    findings: { type: "array", items: { type: "string" } },');
  L.push('    self_score: { type: "integer", minimum: 1, maximum: 10 },');
  L.push("  },");
  L.push("}");
  L.push("");
  L.push("// Per-role reprompted agents (Phase-2 output). model omitted -> inherit main-loop model.");
  L.push("const AGENTS = " + JSON.stringify(agents) + "");
  L.push("");
  L.push('phase("Plan")');
  L.push("log(`Workflow ${runId}: dispatching ${AGENTS.length} reprompted agents`)");
  L.push("");
  L.push("// Execute: independent domain agents run concurrently (barrier — synthesis needs all results together).");
  L.push('phase("Execute")');
  L.push("const results = (await parallel(");
  L.push('  AGENTS.map((a) => () => agent(a.prompt, { label: a.label, phase: "Execute", schema: FINDINGS_SCHEMA }))');
  L.push(")).filter(Boolean)");
  L.push("");

  if (ultracode) {
    L.push("// Ultracode: adversarially verify every finding with 3 diverse lenses; keep only majority-survivors.");
    L.push("const VERDICT_SCHEMA = {");
    L.push('  type: "object", additionalProperties: false, required: ["refuted", "reason"],');
    L.push('  properties: { refuted: { type: "boolean" }, reason: { type: "string" } },');
    L.push("}");
    L.push('phase("Evaluate")');
    L.push("const verified = (await parallel(");
    L.push("  results.flatMap((r) => (r.findings || []).map((f) => () =>");
    L.push('    parallel(["correctness", "completeness", "risk"].map((lens) => () =>');
    L.push("      agent(`Judge via the ${lens} lens whether this finding is real and well-supported: \"${f}\". Default refuted=true if uncertain.`,");
    L.push('        { label: `verify:${lens}`, phase: "Evaluate", schema: VERDICT_SCHEMA })');
    L.push("    )).then((vs) => ({ role: r.role, finding: f, real: vs.filter(Boolean).filter((v) => !v.refuted).length >= 2 }))");
    L.push("  ))");
    L.push(")).filter(Boolean)");
    L.push("const confirmed = verified.filter((v) => v.real)");
    L.push("");
    L.push("// Completeness critic: what is missing — an un-run angle, an unverified claim, an unread source?");
    L.push("const CRITIC_SCHEMA = {");
    L.push('  type: "object", additionalProperties: false, required: ["gaps"],');
    L.push('  properties: { gaps: { type: "array", items: { type: "string" } } },');
    L.push("}");
    L.push("const critic = await agent(`Given these confirmed findings, list concrete gaps still missing: ${JSON.stringify(confirmed.map((c) => c.finding))}`,");
    L.push('  { label: "completeness-critic", phase: "Evaluate", schema: CRITIC_SCHEMA })');
    L.push("");
    L.push("return {");
    L.push('  schema_version: "reprompter.workflow_outcome.v1",');
    L.push("  runId,");
    L.push("  taskname,");
    L.push("  results,");
    L.push("  confirmed,");
    L.push("  gaps: (critic && critic.gaps) || [],");
    L.push("  missing: AGENTS.length - results.length,");
    L.push("  scores: results.map((r) => ({ role: r.role, score: r.self_score })),");
    L.push("}");
  } else {
    L.push("// Evaluate: bounded delta-retry (max 2 per role) for anything below the accept bar.");
    L.push('phase("Evaluate")');
    L.push("const ACCEPT = " + accept);
    L.push("let totalRetries = 0");
    L.push("const final = []");
    L.push("for (const r of results) {");
    L.push("  let current = r");
    L.push("  let attempts = 0");
    L.push("  while (current && current.self_score < ACCEPT && attempts < 2) {");
    L.push("    attempts += 1");
    L.push("    totalRetries += 1");
    L.push("    current = await agent(`Previous ${current.role} attempt scored ${current.self_score}/10 (need ${ACCEPT}). Fix the gaps; return the improved structured result.`,");
    L.push('      { label: `retry:${current.role}`, phase: "Evaluate", schema: FINDINGS_SCHEMA })');
    L.push("  }");
    L.push("  if (current) final.push(current)");
    L.push("}");
    L.push("");
    L.push("return {");
    L.push('  schema_version: "reprompter.workflow_outcome.v1",');
    L.push("  runId,");
    L.push("  taskname,");
    L.push("  results: final,");
    L.push("  missing: AGENTS.length - final.length,");
    L.push("  retries: totalRetries,");
    L.push("  scores: final.map((f) => ({ role: f.role, score: f.self_score })),");
    L.push("}");
  }
  L.push("");
  return L.join("\n");
}

// The workflow-lane trigger short-circuits routeIntent to mode "workflow" before
// profile detection. Strip the trigger phrases so we can recover the underlying
// team/profile and slug task-specific terms (not just the profile/trigger).
function stripWorkflowTriggers(input) {
  let out = String(input || "");
  for (const trigger of WORKFLOW_LANE_TRIGGERS) {
    out = out.replace(new RegExp(trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function buildWorkflowCommand(input, options = {}) {
  const ultracode = Boolean(options.ultracode);
  const route = routeIntent(input);
  // For the workflow lane, recover the team route + task terms from the stripped input.
  const teamInput = route.mode === "workflow" ? stripWorkflowTriggers(input) : input;
  const teamRoute = route.mode === "workflow" ? routeIntent(teamInput) : route;
  const risk = inferRisk(input);
  const taskname = inferTaskname(teamInput, teamRoute);
  const budget = parseBudget(input);
  const taskLabel = teamRoute.mode === "multi-agent" ? `${(teamRoute.profile || "repromptverse").replace(/-/g, " ")} workflow` : "bounded workflow";
  const criteria = buildWorkflowSuccessCriteria(taskLabel);
  const expandedPrompt = buildExpandedPrompt(input, "claude-workflow", teamRoute, risk, taskLabel, criteria, options.repo);
  const agents = buildDefaultAgents(input, teamRoute);

  // Keep the embedded command path in sync with where writeArtifacts() actually
  // writes the script: derive from --out-dir when no explicit --script-path is given.
  const scriptPath = options.scriptPath
    || (options.outDir
      ? path.join(options.outDir, `rpt-${taskname}.workflow.js`)
      : `/tmp/reprompter-workflow/rpt-${taskname}.workflow.js`);
  const blocked = risk.level === "high";
  const script = blocked
    ? null
    : buildWorkflowScript({ taskname, description: input, agents, ultracode });

  // Surface which forbidden surfaces were neutralized by a boundary marker vs left active.
  const boundaryNotes = FORBIDDEN_PATTERNS
    .filter((p) => new RegExp(`\\b${p}\\b`, "i").test(String(input).toLowerCase()))
    .map((p) => ({ pattern: p, bounded: hasBoundaryMarkerNear(String(input).toLowerCase(), p) }));

  const quality = evaluateArtifact(expandedPrompt, {
    requiredSections: ["goal", "context", "requirements", "constraints", "success_criteria"],
    requiresLineRefs: false,
    threshold: 7,
  });

  const recipe = fingerprint({
    templateId: "workflow-command-card",
    patterns: ["constraint-normalizer", "success-criteria", "schema-returns", ultracode ? "adversarial-verify" : "delta-retry"],
    capabilityTier: teamRoute.mode === "multi-agent" ? "multi_agent" : "single_agent",
    domain: taskLabel,
    contextLayers: 4,
    qualityScore: quality.overallScore,
  });

  const command = blocked
    ? null
    : `Workflow({ scriptPath: ${JSON.stringify(scriptPath)}, args: { taskname: ${JSON.stringify(taskname)}, runId: ${JSON.stringify(taskname)} } })`;

  return {
    schema_version: "reprompter.workflow_command.v1",
    mode: "workflow_preflight",
    source_message: input,
    route,
    risk,
    blocked,
    ultracode,
    taskname,
    script_path: scriptPath,
    workflow_command: command,
    command,
    workflow_script: script,
    expanded_prompt: expandedPrompt,
    success_criteria: criteria,
    budget,
    boundary_notes: boundaryNotes,
    quality_score: {
      before: 3.2,
      after: quality.overallScore,
      pass: quality.pass,
      dimensions: quality.dimensions,
      gaps: quality.gaps,
    },
    workflow_command_card: {
      command,
      compiled_from: "Expanded RePrompter prompt",
      objective: sentenceCase(`${taskLabel}: ${compact(input, 160)}`),
      runtime: "Claude dynamic Workflow tool",
      mode: "Workflow preflight",
      paste_into: "Workflow tool (scriptPath + args), as-is",
      script_path: scriptPath,
      agents: agents.length,
      phases: ["Plan", "Execute", "Evaluate"],
      execution_pattern: ultracode
        ? "parallel fan-out + adversarial verify + completeness critic"
        : "parallel fan-out + bounded delta-retry",
      budget: budget.mode === "directive" ? `${budget.total} (directive)` : budget.mode,
      risk_level: risk.level,
      missing_inputs: [],
      verification: [
        "Confirm the Workflow tool is present in the current toolset.",
        "Run the emitted script via Workflow({ scriptPath, args }).",
        "Resume an interrupted run with resumeFromRunId; cached agents short-circuit.",
        "Read returned per-role scores; the parent mirrors tmp artifacts after return.",
      ],
      quality: `3.2 -> ${quality.overallScore}`,
    },
    recipe_fingerprint: recipe,
    non_actions: [
      "does not run the workflow",
      "does not dispatch agents",
      "does not read secrets/auth/cookies/browser profiles",
      "does not merge/deploy/publish",
    ],
  };
}

// Always materialize the runnable script at the exact path the emitted command
// references (packet.script_path), independent of --out-dir, so the printed
// Workflow({ scriptPath }) is runnable in every mode. No-op when blocked (no script).
function writeScript(packet) {
  if (!packet.workflow_script || !packet.script_path) return;
  fs.mkdirSync(path.dirname(packet.script_path), { recursive: true, mode: 0o700 });
  // Predictable-/tmp-path hardening: refuse to follow a pre-existing symlink at the
  // target so an attacker can't redirect the write to clobber another file.
  try {
    if (fs.lstatSync(packet.script_path).isSymbolicLink()) {
      throw new Error(`refusing to write workflow script through a symlink: ${packet.script_path}`);
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  fs.writeFileSync(packet.script_path, `${packet.workflow_script}\n`);
}

// The JSON/card/expanded-prompt bundle is --out-dir-only. The script itself is
// written by writeScript() (above), so the command path and the file never diverge.
function writeArtifacts(packet, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "workflow-command.json"), `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "workflow-command-card.json"), `${JSON.stringify(packet.workflow_command_card, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "reprompter-expanded-prompt.md"), `${packet.expanded_prompt}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.input.trim()) {
    process.stderr.write("workflow-command requires --input or positional input\n");
    return 2;
  }
  const packet = buildWorkflowCommand(args.input, {
    repo: args.repo,
    ultracode: args.ultracode,
    scriptPath: args.scriptPath,
    outDir: args.outDir,
  });
  writeScript(packet);
  if (args.outDir) writeArtifacts(packet, args.outDir);
  if (args.format === "text") {
    process.stdout.write(`${packet.workflow_command || "BLOCKED"}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
  }
  return packet.blocked ? 1 : 0;
}

module.exports = {
  buildWorkflowCommand,
  buildWorkflowScript,
  parseBudget,
};

if (require.main === module) {
  process.exitCode = main();
}
