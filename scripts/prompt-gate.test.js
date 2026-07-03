"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { scorePrompt, shouldNudge } = require("./prompt-gate");

const roughPrompt = "uhh build a crypto dashboard, maybe coingecko data, add caching, test it too";
const claudeNudgeFixture = `<reprompter-ambient-gate>Heuristic prompt quality: 2/10 (weakest: constraints, structure). If this request is a nontrivial task, briefly offer once for this request to structure it first via the reprompter skill (user can say "reprompt this"); if the user declines or the task is trivial, proceed normally.</reprompter-ambient-gate>\n`;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rpt-prompt-gate-"));
}

function runGate(input, env = {}, args = []) {
  return execFileSync(process.execPath, ["scripts/prompt-gate.js", ...args], {
    cwd: path.join(__dirname, ".."),
    input,
    env: {
      ...process.env,
      REPROMPTER_AMBIENT: "1",
      REPROMPTER_TELEMETRY: "1",
      REPROMPTER_AMBIENT_THRESHOLD: "5",
      REPROMPTER_AMBIENT_COOLDOWN_MIN: "15",
      XDG_CACHE_HOME: tmpDir(),
      ...env,
    },
    encoding: "utf8",
  });
}

function runGateWithCache(input, env = {}, args = []) {
  const cache = tmpDir();
  const stdout = runGate(input, { XDG_CACHE_HOME: cache, ...env }, args);
  return { stdout, cache };
}

function nudgeOptions(sessionId, options = {}) {
  const dir = tmpDir();
  return {
    ...options,
    env: options.env || {},
    sessionId,
    statePath: options.statePath || path.join(dir, "ambient-gate.json"),
  };
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
  const result = shouldNudge(roughPrompt, nudgeOptions("skip-disabled", { env: { REPROMPTER_AMBIENT: "0" } }));
  assert.equal(result.reason, "disabled");
  assert.equal(result.nudge, false);
});

test("skip reason: slash-command", () => {
  const result = shouldNudge("/build the thing with enough words to pass length", nudgeOptions("skip-slash-command"));
  assert.equal(result.reason, "slash-command");
});

test("skip reason: too-short", () => {
  const result = shouldNudge("fix this", nudgeOptions("skip-too-short"));
  assert.equal(result.reason, "too-short");
});

test("skip reason: acknowledgement", () => {
  const result = shouldNudge(
    "yes please continue with the implementation details now",
    nudgeOptions("skip-acknowledgement")
  );
  assert.equal(result.reason, "acknowledgement");
});

test("skip reason: mentions-reprompt", () => {
  const result = shouldNudge(
    "please reprompt this before we build the dashboard implementation",
    nudgeOptions("skip-mentions-reprompt")
  );
  assert.equal(result.reason, "mentions-reprompt");
});

test("skip reason: not-a-task", () => {
  const result = shouldNudge(
    "the system has many moving parts and uncertain priorities today",
    nudgeOptions("skip-not-a-task")
  );
  assert.equal(result.reason, "not-a-task");
});

test("skip reason: above-threshold", () => {
  const result = shouldNudge(
    "build scripts/prompt-gate.js with tests, must preserve privacy, verify with npm run check, update docs, document evidence",
    nudgeOptions("skip-above-threshold", { env: { REPROMPTER_AMBIENT_THRESHOLD: "2" } })
  );
  assert.equal(result.reason, "above-threshold");
});

test("skip reason: atomic-task", () => {
  const result = shouldNudge(
    "add dark mode to the settings page and make sure it persists across sessions",
    nudgeOptions("skip-atomic-task")
  );
  assert.equal(result.nudge, false);
  assert.equal(result.reason, "atomic-task");
  assert.equal(result.score, undefined);
});

test("vague concise auth refactor still nudges", () => {
  const result = shouldNudge(
    "uhh can you maybe refactor the whole auth thing or something, idk, make it better somehow",
    nudgeOptions("vague-auth-refactor")
  );
  assert.equal(result.nudge, true);
  assert.equal(result.reason, "below-threshold");
});

test("vague concise Turkish task still nudges", () => {
  const result = shouldNudge(
    "belki ayarlar sayfasına tema ekle falan, çok emin değilim",
    nudgeOptions("vague-turkish-task")
  );
  assert.equal(result.nudge, true);
  assert.equal(result.reason, "below-threshold");
});

test("empty threshold env uses default threshold", () => {
  const dir = tmpDir();
  const statePath = path.join(dir, "ambient-gate.json");
  const result = shouldNudge(roughPrompt, {
    env: { REPROMPTER_AMBIENT_THRESHOLD: "  " },
    sessionId: "empty-threshold",
    statePath,
  });
  assert.equal(result.nudge, true);
  assert.equal(result.reason, "below-threshold");
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

test("cooldown treats zero and empty env values as default window", () => {
  const dir = tmpDir();
  const statePath = path.join(dir, "ambient-gate.json");
  const now = Date.parse("2026-07-02T10:00:00.000Z");
  const env = { REPROMPTER_AMBIENT_COOLDOWN_MIN: "0" };

  assert.equal(shouldNudge(roughPrompt, { env, sessionId: "s1", statePath, now: () => now }).nudge, true);
  assert.equal(
    shouldNudge(roughPrompt, { env, sessionId: "s1", statePath, now: () => now + 1 }).reason,
    "cooldown"
  );

  const blankEnv = { REPROMPTER_AMBIENT_COOLDOWN_MIN: " " };
  assert.equal(
    shouldNudge(roughPrompt, { env: blankEnv, sessionId: "s1", statePath, now: () => now + 2 }).reason,
    "cooldown"
  );
});

test("future-dated cooldown state still suppresses nudges", () => {
  const dir = tmpDir();
  const statePath = path.join(dir, "ambient-gate.json");
  const now = Date.parse("2026-07-02T10:00:00.000Z");
  fs.writeFileSync(statePath, JSON.stringify({ s1: new Date(now + 5 * 60 * 1000).toISOString() }), "utf8");

  const result = shouldNudge(roughPrompt, { env: {}, sessionId: "s1", statePath, now: () => now });
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

test("weak Turkish task prompt nudges", () => {
  const prompt = "lütfen bu dağınık akışı belki düzelt ve daha kullanışlı yap ama detaylar bende yok";
  const dir = tmpDir();
  const statePath = path.join(dir, "ambient-gate.json");
  const result = shouldNudge(prompt, { env: {}, sessionId: "weak-turkish-task", statePath });

  assert.equal(result.nudge, true);
  assert.equal(result.reason, "below-threshold");
});

test("hook CLI nudges for low-quality JSON", () => {
  const stdout = runGate(JSON.stringify({ session_id: "s1", prompt: roughPrompt }));
  assert.match(stdout, /<reprompter-ambient-gate>/);
});

test("hook CLI default claude format remains byte-identical", () => {
  const stdout = runGate(JSON.stringify({ session_id: "byte-fixture", prompt: roughPrompt }));
  assert.equal(stdout, claudeNudgeFixture);
});

test("hook CLI codex format emits additionalContext JSON", () => {
  const stdout = runGate(JSON.stringify({ session_id: "codex-nudge", prompt: roughPrompt }), {}, [
    "--format=codex",
  ]);
  const parsed = JSON.parse(stdout);

  assert.deepEqual(Object.keys(parsed), ["hookSpecificOutput"]);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.equal(parsed.hookSpecificOutput.additionalContext, claudeNudgeFixture.trimEnd());
  assert.equal(parsed.decision, undefined);
});

test("hook CLI codex format stays silent on skip", () => {
  const prompt = "implement scripts/prompt-gate.js with tests, must preserve privacy, verify npm run check, update docs";
  const stdout = runGate(JSON.stringify({ session_id: "codex-skip", prompt }), {
    REPROMPTER_AMBIENT_THRESHOLD: "2",
  }, ["--format=codex"]);
  assert.equal(stdout, "");
});

test("hook CLI hermes format emits context JSON from extra.user_message", () => {
  const stdout = runGate(
    JSON.stringify({ session_id: "hermes-nudge", extra: { user_message: roughPrompt } }),
    {},
    ["--format=hermes"]
  );
  const parsed = JSON.parse(stdout);

  assert.deepEqual(parsed, { context: claudeNudgeFixture.trimEnd() });
  assert.equal(parsed.decision, undefined);
});

test("hook CLI hermes format accepts top-level user_message fallback", () => {
  const stdout = runGate(JSON.stringify({ session_id: "hermes-top-level", user_message: roughPrompt }), {}, [
    "--format=hermes",
  ]);
  assert.deepEqual(JSON.parse(stdout), { context: claudeNudgeFixture.trimEnd() });
});

test("hook CLI unknown format falls back to claude", () => {
  const stdout = runGate(JSON.stringify({ session_id: "unknown-format", prompt: roughPrompt }), {}, [
    "--format=wat",
  ]);
  assert.equal(stdout, claudeNudgeFixture);
});

test("hook CLI format flag takes precedence over REPROMPTER_GATE_FORMAT", () => {
  const stdout = runGate(
    JSON.stringify({ session_id: "flag-precedence", prompt: roughPrompt, extra: { user_message: "ignored" } }),
    { REPROMPTER_GATE_FORMAT: "hermes" },
    ["--format=codex"]
  );
  assert.ok(JSON.parse(stdout).hookSpecificOutput.additionalContext);
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

test("hook CLI stays silent for malformed stdin in every format", () => {
  for (const args of [[], ["--format=claude"], ["--format=codex"], ["--format=hermes"], ["--format=unknown"]]) {
    assert.equal(runGate("not json", {}, args), "");
  }
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
      REPROMPTER_AMBIENT: "1",
      REPROMPTER_TELEMETRY: "1",
      REPROMPTER_AMBIENT_THRESHOLD: "5",
      REPROMPTER_AMBIENT_COOLDOWN_MIN: "15",
      XDG_CACHE_HOME: cache,
    },
    encoding: "utf8",
  });
  assert.match(stdout, /<reprompter-ambient-gate>/);

  const eventsPath = path.join(cache, "reprompter", "telemetry", "events.ndjson");
  const events = fs.readFileSync(eventsPath, "utf8");
  const hashedSession = crypto.createHash("sha256").update("privacy").digest("hex").slice(0, 12);
  assert.doesNotMatch(events, /crypto dashboard/);
  assert.doesNotMatch(events, /gate-privacy/);
  assert.match(events, new RegExp(`gate-${hashedSession}`));
  assert.match(events, /gate_prompt/);
});

test("telemetry records runtime for each format without prompt text", () => {
  const cases = [
    { args: ["--format=claude"], input: { session_id: "runtime-claude", prompt: roughPrompt }, runtime: "claude-code" },
    { args: ["--format=codex"], input: { session_id: "runtime-codex", prompt: roughPrompt }, runtime: "codex" },
    {
      args: ["--format=hermes"],
      input: { session_id: "runtime-hermes", extra: { user_message: roughPrompt } },
      runtime: "hermes",
    },
  ];

  for (const { args, input, runtime } of cases) {
    const { cache } = runGateWithCache(JSON.stringify(input), {}, args);
    const eventsPath = path.join(cache, "reprompter", "telemetry", "events.ndjson");
    const events = fs.readFileSync(eventsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));

    assert.equal(events.length, 1);
    assert.equal(events[0].runtime, runtime);
    assert.doesNotMatch(JSON.stringify(events[0]), /crypto dashboard/);
  }
});
