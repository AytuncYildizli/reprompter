#!/usr/bin/env node
"use strict";

const { createTelemetryStore } = require("./telemetry-store");

const DEFAULT_STALE_MS = 120000;
const GATE_RUN_PREFIX = "gate-";
const GATE_STAGE_PREFIX = "gate_";

function toTime(value) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : null;
}

function resolveNowMs(now) {
  if (now instanceof Date) return now.getTime();
  if (typeof now === "number") return now;
  return toTime(now) ?? Date.now();
}

function ageEvidence(event, nowMs) {
  const eventMs = toTime(event.timestamp);
  if (eventMs === null) {
    return `${event.stage || "unknown"}:${event.status || "unknown"} age=unknown`;
  }
  return `${event.stage || "unknown"}:${event.status || "unknown"} age=${Math.max(0, nowMs - eventMs)}ms`;
}

function isGateEvent(event = {}) {
  return String(event.runId || "").startsWith(GATE_RUN_PREFIX) ||
    String(event.stage || "").startsWith(GATE_STAGE_PREFIX);
}

function comparableEventTime(event, index) {
  return toTime(event.timestamp) ?? index;
}

function pickRunId(events) {
  let latest = null;
  events.forEach((event, index) => {
    if (isGateEvent(event)) return;
    if (!event.runId) return;

    const candidate = {
      runId: String(event.runId),
      time: comparableEventTime(event, index),
      index,
    };
    if (
      !latest ||
      candidate.time > latest.time ||
      (candidate.time === latest.time && candidate.index > latest.index)
    ) {
      latest = candidate;
    }
  });
  return latest ? latest.runId : null;
}

function adviceFor(verdict) {
  if (verdict === "stalled") {
    return [
      "Advisory only: do not kill, restart, spawn, or message anything from the supervisor.",
      "Check artifacts at /tmp/rpt-{taskname}-*.md, inspect the stalled lane, and follow the current Option's stall runbook; consider a targeted re-spawn only if that runbook says to.",
    ];
  }
  if (verdict === "failing-evals") {
    return [
      "Advisory only: begin drafting the Phase-4 delta prompt now, quoting the failing criteria and gaps.",
      "Do not re-run the whole fleet; use the existing delta-retry pattern if Phase 4 confirms a retry is needed.",
    ];
  }
  if (verdict === "completed") {
    return ["No supervisor action. Use the finalized run result when deciding Phase 4 retries."];
  }
  if (verdict === "healthy") {
    return ["No supervisor action. Continue the current polling loop."];
  }
  return ["No supervisor action. Telemetry is missing or does not identify a run."];
}

function analyzeRun(events = [], options = {}) {
  const nowMs = resolveNowMs(options.now);
  const staleMs = Number.isFinite(Number(options.staleMs))
    ? Number(options.staleMs)
    : DEFAULT_STALE_MS;
  const usableEvents = Array.isArray(events) ? events.filter((event) => !isGateEvent(event)) : [];
  const requestedRunId = options.runId ? String(options.runId) : null;
  const runId = requestedRunId || pickRunId(usableEvents);

  if (!runId) {
    return {
      runId: null,
      verdict: "unknown",
      evidence: ["no non-gate telemetry events"],
      advice: adviceFor("unknown"),
    };
  }

  const runEvents = usableEvents.filter((event) => String(event.runId || "") === runId);
  if (runEvents.length === 0) {
    return {
      runId,
      verdict: "unknown",
      evidence: [`run ${runId} not found`],
      advice: adviceFor("unknown"),
    };
  }

  const finalized = runEvents.filter((event) => event.stage === "finalize_run");
  const successfulFinalize = finalized.some((event) => event.pass === true || event.status === "ok");
  const terminalStatusEvent = runEvents.find((event) =>
    event.status === "stalled" || event.status === "timeout"
  );
  if (terminalStatusEvent) {
    return {
      runId,
      verdict: "stalled",
      evidence: [ageEvidence(terminalStatusEvent, nowMs)],
      advice: adviceFor("stalled"),
    };
  }

  const lastEvent = runEvents.reduce((latest, event, index) => {
    const candidate = { event, time: comparableEventTime(event, index), index };
    if (!latest || candidate.time > latest.time || (candidate.time === latest.time && candidate.index > latest.index)) {
      return candidate;
    }
    return latest;
  }, null);
  const lastEventMs = lastEvent ? toTime(lastEvent.event.timestamp) : null;
  const hasActiveExecution = runEvents.some(
    (event) => event.stage === "spawn_agent" || event.stage === "poll_artifacts"
  );
  const hasFinalize = finalized.length > 0;
  if (hasActiveExecution && !hasFinalize && lastEventMs !== null && nowMs - lastEventMs > staleMs) {
    return {
      runId,
      verdict: "stalled",
      evidence: [
        `${lastEvent.event.stage}:${lastEvent.event.status || "unknown"} last event age=${Math.max(0, nowMs - lastEventMs)}ms`,
      ],
      advice: adviceFor("stalled"),
    };
  }

  const failedEvaluations = runEvents.filter(
    (event) =>
      event.stage === "evaluate_artifact" &&
      (event.status === "error" || event.pass === false)
  );
  const retryEvents = runEvents.filter((event) => event.stage === "retry_artifact");
  if (!successfulFinalize && (failedEvaluations.length >= 2 || retryEvents.length >= 1)) {
    const evidence = [
      ...failedEvaluations.slice(0, 2).map((event) => ageEvidence(event, nowMs)),
      ...retryEvents.slice(0, 1).map((event) => ageEvidence(event, nowMs)),
    ];
    return {
      runId,
      verdict: "failing-evals",
      evidence,
      advice: adviceFor("failing-evals"),
    };
  }

  if (hasFinalize) {
    const finalEvent = finalized[finalized.length - 1];
    const success = finalEvent.pass === true || finalEvent.status === "ok";
    return {
      runId,
      verdict: "completed",
      evidence: [`${ageEvidence(finalEvent, nowMs)} success=${success}`],
      advice: adviceFor("completed"),
    };
  }

  return {
    runId,
    verdict: "healthy",
    evidence: lastEvent ? [ageEvidence(lastEvent.event, nowMs)] : ["run has no events"],
    advice: adviceFor("healthy"),
  };
}

function parseArgs(argv) {
  const options = {
    advise: false,
    json: false,
    root: process.cwd(),
    runId: null,
    staleMs: DEFAULT_STALE_MS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--advise") {
      options.advise = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--root") {
      i += 1;
      if (!argv[i]) throw new Error("--root requires a value");
      options.root = argv[i];
    } else if (arg === "--run-id") {
      i += 1;
      if (!argv[i]) throw new Error("--run-id requires a value");
      options.runId = argv[i];
    } else if (arg === "--stale-ms") {
      i += 1;
      if (!argv[i] || !Number.isFinite(Number(argv[i]))) {
        throw new Error("--stale-ms requires a numeric value");
      }
      options.staleMs = Number(argv[i]);
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return options;
}

function formatHuman(result) {
  const lines = [
    `Run supervisor: ${result.verdict}`,
    `Run: ${result.runId || "unknown"}`,
    `Evidence: ${result.evidence.slice(0, 2).join("; ") || "none"}`,
  ];
  for (const item of result.advice.slice(0, 3)) {
    lines.push(`Advice: ${item}`);
  }
  return `${lines.slice(0, 6).join("\n")}\n`;
}

function runCli(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }

  const store = createTelemetryStore({ rootDir: options.root });
  const events = store.readEvents();
  const result = analyzeRun(events, {
    runId: options.runId,
    staleMs: options.staleMs,
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatHuman(result));
  }
  return 0;
}

module.exports = {
  DEFAULT_STALE_MS,
  analyzeRun,
  formatHuman,
  parseArgs,
  runCli,
};

if (require.main === module) {
  process.exitCode = runCli();
}
