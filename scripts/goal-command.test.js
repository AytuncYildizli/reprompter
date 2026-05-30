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
