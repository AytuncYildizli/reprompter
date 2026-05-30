"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildGoalCommand } = require("./goal-command");

test("buildGoalCommand emits exact Codex /goal command and card", () => {
  const packet = buildGoalCommand("Helva'yı Whip resident modele bağla, duplicate runtime olmasın", {
    target: "codex",
    repo: "/tmp/whip",
  });

  assert.equal(packet.schema_version, "reprompter.goal_command.v1");
  assert.equal(packet.mode, "codex_goal_preflight");
  assert.ok(packet.goal_command.startsWith("/goal "));
  assert.notEqual(packet.compressed_summary, packet.source_message);
  assert.equal(packet.goal_command_card.command, packet.goal_command);
  assert.equal(packet.goal_command_card.runtime_target, "codex");
  assert.equal(packet.goal_command_card.mode, "/goal preflight");
  assert.ok(packet.expanded_prompt.includes("<success_criteria schema_version=\"1\">"));
  assert.ok(packet.quality_score.after >= 7);
});

test("high-risk Codex goal emits blocked card without executable command", () => {
  const packet = buildGoalCommand("deploy prod auth cookie fix", { target: "codex" });

  assert.equal(packet.blocked, true);
  assert.equal(packet.goal_command, null);
  assert.equal(packet.goal_command_card.command, null);
  assert.deepEqual(packet.risk.forbiddenHits.sort(), ["auth", "cookie", "deploy", "prod"]);
});

test("boundary-only forbidden surfaces stay executable for Whip intake", () => {
  const packet = buildGoalCommand(
    "Whip içinde RePrompter uyumluluğunu kanıtla; no prod/merge/deploy; no secrets/session material; verify before green",
    { target: "codex", repo: "/tmp/whip" }
  );

  assert.equal(packet.blocked, false);
  assert.ok(packet.goal_command.startsWith("/goal "));
  assert.deepEqual(packet.risk.forbiddenHits, []);
  assert.equal(packet.goal_command_card.risk_level, "medium");
});

test("actual forbidden action still blocks even when another surface is bounded", () => {
  const packet = buildGoalCommand("deploy prod now, but no browser", { target: "codex" });

  assert.equal(packet.blocked, true);
  assert.equal(packet.goal_command, null);
  assert.deepEqual(packet.risk.forbiddenHits.sort(), ["deploy", "prod"]);
});

test("a negated verb near a forbidden surface does NOT clear the risk gate", () => {
  // "not" governs the verb "skip", not the surface "prod deploy" — must stay blocked.
  const p1 = buildGoalCommand("do not skip the prod deploy step, run it", { target: "codex" });
  assert.equal(p1.blocked, true);
  assert.ok(p1.risk.forbiddenHits.includes("prod") && p1.risk.forbiddenHits.includes("deploy"));

  // "never" governs "hesitate", not "merge"/"prod".
  const p2 = buildGoalCommand("never hesitate to merge to prod", { target: "codex" });
  assert.equal(p2.blocked, true);
  assert.ok(p2.risk.forbiddenHits.includes("merge") && p2.risk.forbiddenHits.includes("prod"));
});

test("imperative 'block <surface>' is NOT a boundary marker and stays gated", () => {
  // "block auth ..." is a command to work on auth, not a constraint excluding it.
  const p = buildGoalCommand("block auth middleware bypass and harden the login flow", { target: "codex" });
  assert.equal(p.blocked, true);
  assert.ok(p.risk.forbiddenHits.includes("auth"));
});

test("plural forbidden surfaces are still gated (cookies/tokens/passwords)", () => {
  for (const input of ["read cookies from the store", "extract tokens for the api", "rotate passwords nightly"]) {
    const p = buildGoalCommand(input, { target: "codex" });
    assert.equal(p.blocked, true, `"${input}" should block`);
  }
  // ...but a bounded plural ("no secrets") still clears.
  const bounded = buildGoalCommand("ship the change; no secrets in logs", { target: "codex" });
  assert.deepEqual(bounded.risk.forbiddenHits, []);
});

test("a forbidden surface stays gated if ANY occurrence is unbounded (occurrence-aware)", () => {
  // first "deploy" is an unbounded action; the later bounded clause must not clear it.
  const p1 = buildGoalCommand("deploy now; no deploy after midnight", { target: "codex" });
  assert.equal(p1.blocked, true);
  assert.ok(p1.risk.forbiddenHits.includes("deploy"));

  const p2 = buildGoalCommand("read tokens and ensure no tokens in logs", { target: "codex" });
  assert.equal(p2.blocked, true);
  assert.ok(p2.risk.forbiddenHits.includes("token"));
});

test("a boundary marker does not bridge a clause break to a later action", () => {
  // "no prod" governs only its own clause; the separate "deploy now" must gate.
  const p = buildGoalCommand("no prod; deploy now", { target: "codex" });
  assert.equal(p.blocked, true);
  assert.ok(p.risk.forbiddenHits.includes("deploy"));
  // sanity: the legitimate same-clause list still clears
  const ok = buildGoalCommand("ship it; no prod/merge/deploy please", { target: "codex" });
  assert.deepEqual(ok.risk.forbiddenHits, []);
});

test("CLI writes machine-readable goal artifacts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reprompter-goal-"));
  const result = spawnSync(process.execPath, [
    path.join(__dirname, "goal-command.js"),
    "--input", "make Whip emit goal commands automatically",
    "--target", "codex",
    "--out-dir", dir,
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const packet = JSON.parse(fs.readFileSync(path.join(dir, "goal-command.json"), "utf8"));
  assert.ok(packet.goal_command.startsWith("/goal "));
  assert.equal(packet.goal_command_card.mode, "/goal preflight");
  assert.equal(fs.readFileSync(path.join(dir, "goal-command.txt"), "utf8").startsWith("/goal "), true);
  assert.ok(fs.existsSync(path.join(dir, "goal-command-card.json")));
  assert.ok(fs.existsSync(path.join(dir, "reprompter-expanded-prompt.md")));
  assert.ok(fs.existsSync(path.join(dir, "compressed-goal-summary.txt")));
});
