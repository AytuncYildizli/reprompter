"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { scorePrompt, shouldNudge } = require("./prompt-gate");

const roughPrompt = "uhh build a crypto dashboard, maybe coingecko data, add caching, test it too";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rpt-prompt-gate-"));
}

function runGate(input, env = {}) {
  return execFileSync(process.execPath, ["scripts/prompt-gate.js"], {
    cwd: path.join(__dirname, ".."),
    input,
    env: {
      ...process.env,
      XDG_CACHE_HOME: tmpDir(),
      ...env,
    },
    encoding: "utf8",
  });
}

test("scores rough prompt below the ambient threshold", () => {
  assert.ok(scorePrompt(roughPrompt).overall < 5);
});

test("scores structured prompts higher than rough prompts", () => {
  const structured = `
# Role
Senior full-stack engineer.

# Task
Implement the ambient gate in scripts/prompt-gate.js and scripts/prompt-gate.test.js.

# Constraints
- Must preserve existing package scripts.
- Never persist prompt text.
- Only write telemetry metadata.

# Success criteria
1. npm run test:prompt-gate passes.
2. npm run check should return exit 0.
3. Assert no raw "crypto dashboard" text appears in cache files.
`;
  const low = scorePrompt(roughPrompt);
  const high = scorePrompt(structured);

  assert.ok(high.overall >= 7);
  assert.ok(high.overall > low.overall);
});

test("skip reason: disabled", () => {
  const result = shouldNudge(roughPrompt, { env: { REPROMPTER_AMBIENT: "0" } });
  assert.equal(result.reason, "disabled");
  assert.equal(result.nudge, false);
});

test("skip reason: slash-command", () => {
  const result = shouldNudge("/build the thing with enough words to pass length", { env: {} });
  assert.equal(result.reason, "slash-command");
});

test("skip reason: too-short", () => {
  const result = shouldNudge("fix this", { env: {} });
  assert.equal(result.reason, "too-short");
});

test("skip reason: acknowledgement", () => {
  const result = shouldNudge("yes please continue with the implementation details now", { env: {} });
  assert.equal(result.reason, "acknowledgement");
});

test("skip reason: mentions-reprompt", () => {
  const result = shouldNudge("please reprompt this before we build the dashboard implementation", { env: {} });
  assert.equal(result.reason, "mentions-reprompt");
});

test("skip reason: not-a-task", () => {
  const result = shouldNudge("the system has many moving parts and uncertain priorities today", { env: {} });
  assert.equal(result.reason, "not-a-task");
});

test("skip reason: above-threshold", () => {
  const result = shouldNudge(
    "build scripts/prompt-gate.js with tests, must preserve privacy, verify with npm run check",
    { env: { REPROMPTER_AMBIENT_THRESHOLD: "2" } }
  );
  assert.equal(result.reason, "above-threshold");
});

test("skip reason: cooldown", () => {
  const dir = tmpDir();
  const statePath = path.join(dir, "ambient-gate.json");
  const now = Date.parse("2026-07-02T10:00:00.000Z");
  assert.equal(shouldNudge(roughPrompt, { env: {}, sessionId: "s1", statePath, now: () => now }).nudge, true);

  const result = shouldNudge(roughPrompt, {
    env: {},
    sessionId: "s1",
    statePath,
    now: () => now + 5 * 60 * 1000,
  });
  assert.equal(result.reason, "cooldown");
});

test("cooldown expires after the configured window", () => {
  const dir = tmpDir();
  const statePath = path.join(dir, "ambient-gate.json");
  const now = Date.parse("2026-07-02T10:00:00.000Z");

  assert.equal(shouldNudge(roughPrompt, { env: {}, sessionId: "s1", statePath, now: () => now }).nudge, true);
  assert.equal(
    shouldNudge(roughPrompt, {
      env: {},
      sessionId: "s1",
      statePath,
      now: () => now + 14 * 60 * 1000,
    }).reason,
    "cooldown"
  );
  assert.equal(
    shouldNudge(roughPrompt, {
      env: {},
      sessionId: "s1",
      statePath,
      now: () => now + 16 * 60 * 1000,
    }).nudge,
    true
  );
});

test("hook CLI nudges for low-quality JSON", () => {
  const stdout = runGate(JSON.stringify({ session_id: "s1", prompt: roughPrompt }));
  assert.match(stdout, /<reprompter-ambient-gate>/);
});

test("hook CLI stays silent for high-quality prompts", () => {
  const prompt = "implement scripts/prompt-gate.js with tests, must preserve privacy, verify npm run check, update docs";
  const stdout = runGate(JSON.stringify({ session_id: "s1", prompt }), {
    REPROMPTER_AMBIENT_THRESHOLD: "2",
  });
  assert.equal(stdout, "");
});

test("hook CLI stays silent for malformed stdin", () => {
  assert.equal(runGate("not json"), "");
});

test("hook CLI honors REPROMPTER_AMBIENT=0", () => {
  const stdout = runGate(JSON.stringify({ session_id: "s1", prompt: roughPrompt }), {
    REPROMPTER_AMBIENT: "0",
  });
  assert.equal(stdout, "");
});

test("telemetry never persists raw prompt text", () => {
  const cache = tmpDir();
  const stdout = execFileSync(process.execPath, ["scripts/prompt-gate.js"], {
    cwd: path.join(__dirname, ".."),
    input: JSON.stringify({ session_id: "privacy", prompt: roughPrompt }),
    env: {
      ...process.env,
      XDG_CACHE_HOME: cache,
    },
    encoding: "utf8",
  });
  assert.match(stdout, /<reprompter-ambient-gate>/);

  const eventsPath = path.join(cache, "reprompter", "telemetry", "events.ndjson");
  const events = fs.readFileSync(eventsPath, "utf8");
  assert.doesNotMatch(events, /crypto dashboard/);
  assert.match(events, /gate_prompt/);
});
