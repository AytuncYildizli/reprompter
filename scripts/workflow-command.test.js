"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildWorkflowCommand, buildWorkflowScript, parseBudget } = require("./workflow-command");

const FORBIDDEN_TOKENS = ["Date.now(", "Math.random(", "new Date("];

function assertDeterministic(script) {
  for (const token of FORBIDDEN_TOKENS) {
    assert.ok(!script.includes(token), `emitted script must not contain ${token}`);
  }
}

function assertPhasesMatch(script, titles) {
  for (const title of titles) {
    assert.ok(script.includes(`{ title: "${title}" }`), `meta.phases must declare ${title}`);
    assert.ok(script.includes(`phase("${title}")`), `body must call phase("${title}")`);
  }
}

function assertValidSyntax(script) {
  // Workflow scripts run inside an async wrapper the harness provides, so
  // top-level await/return are legal there but not in a bare module. Model
  // that wrapper: demote the meta export to a const and wrap the body so
  // `node --check` validates the syntax the way the runtime executes it.
  const wrapped =
    "async function __wf(args, budget, agent, parallel, pipeline, phase, log, workflow) {\n" +
    script.replace(/^export\s+const\s+meta\s*=/m, "const meta =") +
    "\n}\n";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-wf-syntax-"));
  const file = path.join(dir, "candidate.js");
  fs.writeFileSync(file, wrapped);
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  assert.equal(result.status, 0, `emitted script must parse inside the workflow async wrapper:\n${result.stderr}`);
}

test("buildWorkflowCommand emits a versioned packet with a runnable script", () => {
  const packet = buildWorkflowCommand("audit the billing and reporting modules across frontend and backend services", {
    repo: "/tmp/demo",
  });

  assert.equal(packet.schema_version, "reprompter.workflow_command.v1");
  assert.equal(packet.mode, "workflow_preflight");
  assert.equal(packet.blocked, false);
  assert.ok(packet.command.startsWith("Workflow({ scriptPath:"));
  assert.ok(packet.workflow_script.includes("export const meta"));
  assert.ok(packet.expanded_prompt.includes("<success_criteria schema_version=\"1\">"));
  assert.ok(packet.quality_score.after >= 7);
  assertPhasesMatch(packet.workflow_script, ["Plan", "Execute", "Evaluate"]);
  assertDeterministic(packet.workflow_script);
  assertValidSyntax(packet.workflow_script);
});

test("high-risk forbidden surfaces block the script", () => {
  const packet = buildWorkflowCommand("deploy prod auth cookie fix");

  assert.equal(packet.blocked, true);
  assert.equal(packet.command, null);
  assert.equal(packet.workflow_script, null);
  assert.deepEqual(packet.risk.forbiddenHits.sort(), ["auth", "cookie", "deploy", "prod"]);
});

test("boundary-only forbidden surfaces stay executable (shared inferRisk/hasBoundaryMarkerNear)", () => {
  const packet = buildWorkflowCommand(
    "compile to workflow a Whip compatibility check; no prod/merge/deploy; no secrets/session material; verify before green"
  );

  assert.equal(packet.blocked, false);
  assert.ok(packet.command.startsWith("Workflow({ scriptPath:"));
  assert.deepEqual(packet.risk.forbiddenHits, []);
  assert.equal(packet.workflow_command_card.risk_level, "medium");
});

test("ultracode mode emits adversarial-verify + completeness critic, still deterministic", () => {
  const packet = buildWorkflowCommand("research tradeoffs and compare options for the cache layer", {
    ultracode: true,
  });

  assert.equal(packet.ultracode, true);
  assert.ok(packet.workflow_script.includes("Default refuted=true if uncertain"));
  assert.ok(packet.workflow_script.includes("completeness-critic"));
  assert.ok(packet.workflow_script.includes("VERIFY_CAP"), "verifier fan-out is capped");
  assert.ok(packet.workflow_script.includes("maxItems: 20"), "findings array is bounded");
  assertPhasesMatch(packet.workflow_script, ["Plan", "Execute", "Evaluate"]);
  assertDeterministic(packet.workflow_script);
  assertValidSyntax(packet.workflow_script);
});

test("buildWorkflowScript meta phase titles never drift from phase() calls", () => {
  const script = buildWorkflowScript({
    taskname: "drift-check",
    description: "any task",
    agents: [{ role: "a", label: "a", prompt: "do a" }],
    ultracode: false,
  });
  assertPhasesMatch(script, ["Plan", "Execute", "Evaluate"]);
  assertDeterministic(script);
  assertValidSyntax(script);
});

test("parseBudget reads a directive and falls back cleanly", () => {
  assert.deepEqual(parseBudget("be thorough +500k please"), { total: 500000, mode: "directive" });
  assert.deepEqual(parseBudget("budget: 200000 tokens"), { total: 200000, mode: "directive" });
  assert.deepEqual(parseBudget("inherit the budget"), { total: null, mode: "inherit" });
  assert.deepEqual(parseBudget("just do the task"), { total: null, mode: "none" });
});

test("parseBudget ignores version-ish tokens and clamps absurd values", () => {
  // "+18" has no k/m unit -> not a budget directive (was a false match)
  assert.deepEqual(parseBudget("upgrade to react +18 features"), { total: null, mode: "none" });
  assert.deepEqual(parseBudget("+2m budget"), { total: 2000000, mode: "directive" });
  assert.equal(parseBudget("budget: 999999999999999999999").total, 100000000);
});

test("hostile input stays escape-safe and deterministic in the emitted script", () => {
  // backslashes (Windows path / regex), a stray quote, and literal forbidden-call
  // tokens must not break the emitted JS string literal or trip the determinism scan.
  const nasty = 'audit C:\\srv\\app\\ and refactor the new Date( wrapper plus the Math.random( seed "now"';
  const packet = buildWorkflowCommand(nasty);
  assert.equal(packet.blocked, false);
  assertValidSyntax(packet.workflow_script);
  assertDeterministic(packet.workflow_script);
});

test("operator-supplied script path with a quote yields a well-formed command", () => {
  const packet = buildWorkflowCommand("compile to workflow an audit", { scriptPath: '/tmp/a"b.workflow.js' });
  assert.ok(packet.command.includes('scriptPath: "/tmp/a\\"b.workflow.js"'));
});

test("CLI writes the four workflow artifacts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-workflow-"));
  const result = spawnSync(process.execPath, [
    path.join(__dirname, "workflow-command.js"),
    "--input", "compile to workflow an audit of the gateway health pipeline",
    "--out-dir", dir,
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const packet = JSON.parse(fs.readFileSync(path.join(dir, "workflow-command.json"), "utf8"));
  assert.equal(packet.schema_version, "reprompter.workflow_command.v1");
  assert.ok(fs.existsSync(path.join(dir, `rpt-${packet.taskname}.workflow.js`)));
  assert.ok(fs.existsSync(path.join(dir, "workflow-command-card.json")));
  assert.ok(fs.existsSync(path.join(dir, "reprompter-expanded-prompt.md")));
  // The embedded command must point at the script that was actually written into --out-dir
  // (not the default /tmp path). Otherwise the pasted Workflow({ scriptPath }) targets a missing file.
  const writtenScript = path.join(dir, `rpt-${packet.taskname}.workflow.js`);
  assert.equal(packet.script_path, writtenScript);
  assert.ok(packet.command.includes(writtenScript));
  assert.ok(fs.existsSync(packet.script_path));
  const emitted = fs.readFileSync(writtenScript, "utf8");
  assertDeterministic(emitted);
});

test("CLI with both --out-dir and --script-path writes the script where the command points", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-wf-od-"));
  const scriptDir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-wf-sp-"));
  const scriptPath = path.join(scriptDir, "custom.workflow.js");
  const result = spawnSync(process.execPath, [
    path.join(__dirname, "workflow-command.js"),
    "--input", "compile to workflow an audit of the gateway",
    "--out-dir", dir,
    "--script-path", scriptPath,
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const packet = JSON.parse(fs.readFileSync(path.join(dir, "workflow-command.json"), "utf8"));
  // The explicit --script-path must be both where the command points AND where the file lands.
  assert.equal(packet.script_path, scriptPath);
  assert.ok(packet.command.includes(scriptPath));
  assert.ok(fs.existsSync(scriptPath), "runnable script written to the explicit --script-path");
  assert.ok(fs.existsSync(path.join(dir, "workflow-command-card.json")), "other artifacts still in out-dir");
});

test("CLI without --out-dir still writes the runnable script the command points at", () => {
  const scriptDir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-wf-noout-"));
  const scriptPath = path.join(scriptDir, "x.workflow.js");
  const result = spawnSync(process.execPath, [
    path.join(__dirname, "workflow-command.js"),
    "--input", "compile to workflow an audit of the gateway",
    "--script-path", scriptPath,
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const packet = JSON.parse(result.stdout);
  assert.equal(packet.script_path, scriptPath);
  assert.ok(packet.command.includes(scriptPath));
  // The printed command must be runnable: the script exists even with no --out-dir.
  assert.ok(fs.existsSync(scriptPath), "script materialized without --out-dir");
});

test("workflow lane preserves the underlying team/profile routing", () => {
  // workflow trigger + swarm request must keep the swarm fan-out, not collapse to 2 agents.
  const swarm = buildWorkflowCommand("compile to workflow an engineering swarm audit of frontend and backend services");
  assert.equal(swarm.workflow_command_card.agents, 3);
  assert.ok(swarm.workflow_script.includes("synthesizer"));
  assert.ok(/engineering/.test(swarm.taskname));

  // A solo task behind a workflow trigger still gets the lean executor/verifier pair.
  const solo = buildWorkflowCommand("compile to workflow fix a typo in the header");
  assert.equal(solo.workflow_command_card.agents, 2);
});

test("distinct workflow inputs get distinct task names (no /tmp overwrite/resume clash)", () => {
  const a = buildWorkflowCommand("compile to workflow audit the billing module");
  const b = buildWorkflowCommand("compile to workflow audit the reporting module");
  assert.notEqual(a.taskname, b.taskname);
  assert.notEqual(a.script_path, b.script_path);
  // task terms survive (not just the trigger/profile)
  assert.ok(a.taskname.includes("billing") && b.taskname.includes("reporting"));
});

test("inputs sharing the first four words still get distinct task names", () => {
  const a = buildWorkflowCommand("compile to workflow audit the billing module for invoices");
  const b = buildWorkflowCommand("compile to workflow audit the billing module for refunds");
  assert.notEqual(a.taskname, b.taskname);
  assert.notEqual(a.script_path, b.script_path);
});

test("documented token-budget phrasing is not blocked as a secret surface", () => {
  const p = buildWorkflowCommand("compile to workflow audit the cache; budget: 200000 tokens");
  assert.equal(p.blocked, false, "token-budget phrasing must not trip the secret gate");
  assert.equal(p.budget.mode, "directive");
  assert.equal(p.budget.total, 200000);
  // sanity: a real token-exfiltration action with no budget context still blocks
  const danger = buildWorkflowCommand("compile to workflow extract tokens from the vault");
  assert.equal(danger.blocked, true);
  // numbered token-extraction stays gated — with OR without a unit (no budget cue)
  const numbered = buildWorkflowCommand("compile to workflow extract 200 tokens from the vault");
  assert.equal(numbered.blocked, true);
  const unitExfil = buildWorkflowCommand("compile to workflow extract 200k tokens from the vault");
  assert.equal(unitExfil.blocked, true);
  // budget needs an UNAMBIGUOUS cue (+Nk / budget:) — that path is recognized and not gated
  const budgeted = buildWorkflowCommand("compile to workflow audit the cache +200k");
  assert.equal(budgeted.blocked, false);
  assert.equal(budgeted.budget.total, 200000);
});

test("a budget directive flows into the command args and the emitted ultracode script", () => {
  const packet = buildWorkflowCommand("compile to workflow audit the cache layer +500k", { ultracode: true });
  assert.equal(packet.budget.mode, "directive");
  assert.equal(packet.budget.total, 500000);
  assert.ok(packet.command.includes("budget: 500000"), "command args carry the parsed budget");
  assert.ok(packet.workflow_script.includes("budgetTotal"), "script sources a budget");
  assert.ok(packet.workflow_script.includes("budget.remaining()"), "ultracode body is budget-scaled");
});

test("the trigger phrase does not leak into the emitted script (agents use the stripped task)", () => {
  const packet = buildWorkflowCommand("compile to workflow fix the pagination bug on the results page");
  assert.ok(!packet.workflow_script.includes("compile to workflow"), "trigger must not appear in the script");
  assert.ok(/pagination/.test(packet.workflow_script), "actual task terms must reach the agents");
});

test("writeScript refuses to follow a symlink at the script path (/tmp clobber guard)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-wf-sym-"));
  const victim = path.join(dir, "victim.txt");
  fs.writeFileSync(victim, "do not overwrite");
  const scriptPath = path.join(dir, "link.workflow.js");
  fs.symlinkSync(victim, scriptPath);
  const result = spawnSync(process.execPath, [
    path.join(__dirname, "workflow-command.js"),
    "--input", "compile to workflow an audit of the gateway",
    "--script-path", scriptPath,
  ], { encoding: "utf8" });

  assert.notEqual(result.status, 0, "should error rather than follow the symlink");
  assert.equal(fs.readFileSync(victim, "utf8"), "do not overwrite", "victim file must be untouched");
});
