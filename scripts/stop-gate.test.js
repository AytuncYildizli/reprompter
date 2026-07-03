"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.join(__dirname, "..");
const roughPrompt = "uhh build a crypto dashboard, maybe coingecko data, add caching, test it too";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rpt-stop-gate-"));
}

function gateEnv(cacheDir, overrides = {}) {
  return {
    ...process.env,
    REPROMPTER_AMBIENT: "1",
    REPROMPTER_TELEMETRY: "1",
    REPROMPTER_AMBIENT_THRESHOLD: "5",
    REPROMPTER_AMBIENT_COOLDOWN_MIN: "15",
    XDG_CACHE_HOME: cacheDir,
    ...overrides,
  };
}

function runStop(payload, options = {}) {
  const cache = options.cache || tmpDir();
  return spawnSync(process.execPath, ["scripts/stop-gate.js"], {
    cwd: repoRoot,
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    env: gateEnv(cache, options.env),
  });
}

function telemetryPath(cache) {
  return path.join(cache, "reprompter", "telemetry", "events.ndjson");
}

function readEvents(cache) {
  const filePath = telemetryPath(cache);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function appendEvent(cache, event) {
  const filePath = telemetryPath(cache);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
}

function hashedSessionId(sessionId) {
  return crypto.createHash("sha256").update(String(sessionId || "anonymous")).digest("hex").slice(0, 12);
}

function seedGatePrompt(cache, sessionId, nudged) {
  appendEvent(cache, {
    timestamp: "2026-07-03T00:00:00.000Z",
    runId: `gate-${hashedSessionId(sessionId)}`,
    taskId: "ambient-gate",
    stage: "gate_prompt",
    status: "ok",
    metadata: {
      nudged,
      reason: nudged ? "below-threshold" : "above-threshold",
    },
  });
}

function writeTranscript(cache, lines) {
  const filePath = path.join(cache, "transcript.jsonl");
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

function assertSilentSuccess(result) {
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
}

test("exports pure nudge, acceptance, and dedupe detectors", () => {
  const stopGate = require("./stop-gate");
  const hashed = hashedSessionId("exports");
  const events = [
    { runId: `gate-${hashed}`, stage: "gate_prompt", metadata: { nudged: true } },
    { runId: `gate-${hashed}`, stage: "gate_outcome", metadata: { accepted: false } },
  ];

  assert.equal(stopGate.detectNudge(events, hashed), true);
  assert.equal(stopGate.alreadyRecorded(events, hashed), true);
  assert.equal(stopGate.detectAcceptance('{"type":"tool_use","name":"reprompter"}'), true);
  assert.equal(stopGate.detectAcceptance('{"type":"user","content":"reprompt this"}'), true);
  assert.equal(stopGate.detectAcceptance('{"type":"user","content":"continue"}'), false);
});

test("nudged and accepted session records one accepted outcome", () => {
  const cache = tmpDir();
  const sessionId = "accepted-session";
  seedGatePrompt(cache, sessionId, true);
  const transcriptPath = writeTranscript(cache, ['{"type":"tool_use","name":"reprompter"}']);

  const result = runStop({ session_id: sessionId, transcript_path: transcriptPath }, { cache });

  assertSilentSuccess(result);
  const outcomes = readEvents(cache).filter((event) => event.stage === "gate_outcome");
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].runId, `gate-${hashedSessionId(sessionId)}`);
  assert.deepEqual(outcomes[0].metadata, { accepted: true });
});

test("nudged but ignored session records one rejected outcome", () => {
  const cache = tmpDir();
  const sessionId = "ignored-session";
  seedGatePrompt(cache, sessionId, true);
  const transcriptPath = writeTranscript(cache, ['{"type":"assistant","content":"Done."}']);

  const result = runStop({ session_id: sessionId, transcript_path: transcriptPath }, { cache });

  assertSilentSuccess(result);
  const outcomes = readEvents(cache).filter((event) => event.stage === "gate_outcome");
  assert.equal(outcomes.length, 1);
  assert.deepEqual(outcomes[0].metadata, { accepted: false });
});

test("not-nudged sessions record no outcome", () => {
  const cache = tmpDir();
  const sessionId = "not-nudged-session";
  seedGatePrompt(cache, sessionId, false);
  const transcriptPath = writeTranscript(cache, ['{"type":"user","content":"reprompt this"}']);

  const result = runStop({ session_id: sessionId, transcript_path: transcriptPath }, { cache });

  assertSilentSuccess(result);
  assert.equal(readEvents(cache).filter((event) => event.stage === "gate_outcome").length, 0);
});

test("second Stop invocation records no duplicate outcome", () => {
  const cache = tmpDir();
  const sessionId = "dedupe-session";
  seedGatePrompt(cache, sessionId, true);
  const transcriptPath = writeTranscript(cache, ['{"type":"user","content":"reprompt this"}']);

  assertSilentSuccess(runStop({ session_id: sessionId, transcript_path: transcriptPath }, { cache }));
  assertSilentSuccess(runStop({ session_id: sessionId, transcript_path: transcriptPath }, { cache }));

  assert.equal(readEvents(cache).filter((event) => event.stage === "gate_outcome").length, 1);
});

test("kill switches are silent and record nothing", () => {
  for (const [key, value] of [
    ["REPROMPTER_TELEMETRY", "0"],
    ["REPROMPTER_AMBIENT", "0"],
  ]) {
    const cache = tmpDir();
    const sessionId = `kill-${key}`;
    seedGatePrompt(cache, sessionId, true);
    const transcriptPath = writeTranscript(cache, ['{"type":"user","content":"reprompt this"}']);

    const result = runStop(
      { session_id: sessionId, transcript_path: transcriptPath },
      { cache, env: { [key]: value } }
    );

    assertSilentSuccess(result);
    assert.equal(readEvents(cache).filter((event) => event.stage === "gate_outcome").length, 0);
  }
});

test("malformed stdin and missing transcript exit silently", () => {
  assertSilentSuccess(runStop("garbage"));

  const cache = tmpDir();
  const sessionId = "missing-transcript";
  seedGatePrompt(cache, sessionId, true);
  const result = runStop({ session_id: sessionId, transcript_path: path.join(cache, "missing.jsonl") }, { cache });

  assertSilentSuccess(result);
  assert.equal(readEvents(cache).filter((event) => event.stage === "gate_outcome").length, 0);
});

test("spawned end-to-end persists only boolean outcome after prompt-gate nudge", () => {
  const cache = tmpDir();
  const sessionId = "privacy-e2e";
  const promptResult = spawnSync(process.execPath, ["scripts/prompt-gate.js"], {
    cwd: repoRoot,
    input: JSON.stringify({ session_id: sessionId, prompt: roughPrompt }),
    encoding: "utf8",
    env: gateEnv(cache),
  });
  assert.equal(promptResult.status, 0);
  assert.match(promptResult.stdout, /<reprompter-ambient-gate>/);

  const transcriptPath = writeTranscript(cache, ['{"type":"user","content":"please reprompt this"}']);
  const stopResult = runStop({ session_id: sessionId, transcript_path: transcriptPath }, { cache });

  assertSilentSuccess(stopResult);
  const rawEvents = fs.readFileSync(telemetryPath(cache), "utf8");
  const outcomes = readEvents(cache).filter((event) => event.stage === "gate_outcome");
  assert.equal(outcomes.length, 1);
  assert.deepEqual(outcomes[0].metadata, { accepted: true });
  assert.doesNotMatch(rawEvents, /please reprompt this/);
  assert.doesNotMatch(rawEvents, /crypto dashboard/);
});
