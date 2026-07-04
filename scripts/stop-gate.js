#!/usr/bin/env node
// Ambient nudge outcome recorder for opt-in Claude Code Stop hooks.
//
// Design rules:
//   - FAIL-SOFT: any internal error exits 0 silently.
//   - OPT-IN: this only runs when a user installs the hook. Set
//     REPROMPTER_AMBIENT=0 or REPROMPTER_TELEMETRY=0 as kill switches.
//   - PRIVACY: transcript text never leaves the process; only the boolean
//     accepted outcome is written to telemetry.
//   - NEVER-BLOCK: Stop hooks must never exit 2, print output, or block stop.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { cacheDir, hashedSessionId, readStdinWithDeadline } = require("./prompt-gate");

function detectNudge(events, hashedId) {
  const runId = `gate-${hashedId}`;
  return Array.isArray(events) && events.some((event) => {
    return event &&
      event.runId === runId &&
      event.stage === "gate_prompt" &&
      event.metadata &&
      event.metadata.nudged === true;
  });
}

function detectAcceptance(transcriptText, afterIso) {
  void afterIso;
  const text = String(transcriptText || "");
  if (/reprompt this/i.test(text)) return true;

  return text.split(/\r?\n/).some((line) => {
    const lower = line.toLowerCase();
    return lower.includes("reprompter") && (lower.includes("tool") || lower.includes("skill"));
  });
}

function alreadyRecorded(events, hashedId) {
  const runId = `gate-${hashedId}`;
  return Array.isArray(events) && events.some((event) => {
    return event && event.runId === runId && event.stage === "gate_outcome";
  });
}

async function readPayload() {
  const raw = await readStdinWithDeadline();
  if (raw == null) return null;
  if (!raw.trim()) return null;
  const payload = JSON.parse(raw);
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
}

function telemetryStore(env) {
  const { createTelemetryStore } = require("./telemetry-store");
  return createTelemetryStore({ dirPath: path.join(cacheDir(env), "telemetry") });
}

async function runHookMode(env = process.env) {
  if (env.REPROMPTER_TELEMETRY === "0" || env.REPROMPTER_AMBIENT === "0") return;

  const payload = await readPayload();
  if (!payload) return;

  const sessionId = typeof payload.session_id === "string" && payload.session_id.trim()
    ? payload.session_id.trim()
    : "anonymous";
  const transcriptPath = typeof payload.transcript_path === "string" && payload.transcript_path.trim()
    ? payload.transcript_path
    : "";
  if (!transcriptPath) return;

  const hashedId = hashedSessionId(sessionId);
  const store = telemetryStore(env);
  const events = store.readEvents({ limit: 1000 });
  if (!detectNudge(events, hashedId) || alreadyRecorded(events, hashedId)) return;

  const transcriptText = fs.readFileSync(transcriptPath, "utf8");
  store.writeEvent({
    runId: `gate-${hashedId}`,
    taskId: "ambient-gate",
    stage: "gate_outcome",
    status: "ok",
    metadata: {
      accepted: detectAcceptance(transcriptText),
    },
  });
}

module.exports = {
  detectNudge,
  detectAcceptance,
  alreadyRecorded,
};

if (require.main === module) {
  (async () => {
    try {
      await runHookMode();
    } catch {
      /* Always fail soft and silent. */
    } finally {
      process.exit(0);
    }
  })();
}
