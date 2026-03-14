#!/usr/bin/env node
"use strict";

const STAGES = new Set([
  "route_intent",
  "select_patterns",
  "resolve_model",
  "build_context",
  "plan_ready",
  "spawn_agent",
  "poll_artifacts",
  "evaluate_artifact",
  "retry_artifact",
  "finalize_run",
  "fingerprint_recipe",
  "collect_outcome",
  "learn_strategy",
]);

const STATUSES = new Set(["ok", "error", "stalled", "timeout", "skipped"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sanitizeEvent(input = {}) {
  const event = isPlainObject(input) ? { ...input } : {};
  const sanitized = {
    timestamp: toIsoDate(event.timestamp),
    runId: typeof event.runId === "string" ? event.runId.trim() : "",
    taskId: typeof event.taskId === "string" ? event.taskId.trim() : "",
    stage: typeof event.stage === "string" ? event.stage.trim() : "",
    status: typeof event.status === "string" ? event.status.trim() : "ok",
  };

  if (typeof event.runtime === "string" && event.runtime.trim()) {
    sanitized.runtime = event.runtime.trim();
  }
  if (typeof event.provider === "string" && event.provider.trim()) {
    sanitized.provider = event.provider.trim();
  }
  if (typeof event.model === "string" && event.model.trim()) {
    sanitized.model = event.model.trim();
  }

  if (Number.isFinite(event.latencyMs)) {
    sanitized.latencyMs = Number(event.latencyMs);
  }
  if (Number.isFinite(event.tokenEstimate)) {
    sanitized.tokenEstimate = Number(event.tokenEstimate);
  }
  if (Number.isFinite(event.attempt)) {
    sanitized.attempt = Number(event.attempt);
  }
  if (typeof event.pass === "boolean") {
    sanitized.pass = event.pass;
  }
  if (typeof event.reason === "string" && event.reason.trim()) {
    sanitized.reason = event.reason.trim();
  }

  if (isPlainObject(event.metadata)) {
    sanitized.metadata = event.metadata;
  }

  return sanitized;
}

function validateEvent(input = {}) {
  const event = sanitizeEvent(input);
  const errors = [];

  if (!event.timestamp) {
    errors.push("timestamp is required and must be a valid date.");
  }
  if (!event.runId) {
    errors.push("runId is required.");
  }
  if (!event.taskId) {
    errors.push("taskId is required.");
  }
  if (!STAGES.has(event.stage)) {
    errors.push(`stage must be one of: ${Array.from(STAGES).join(", ")}`);
  }
  if (!STATUSES.has(event.status)) {
    errors.push(`status must be one of: ${Array.from(STATUSES).join(", ")}`);
  }
  if (event.latencyMs !== undefined && event.latencyMs < 0) {
    errors.push("latencyMs must be >= 0.");
  }
  if (event.tokenEstimate !== undefined && event.tokenEstimate < 0) {
    errors.push("tokenEstimate must be >= 0.");
  }
  if (event.attempt !== undefined && event.attempt < 0) {
    errors.push("attempt must be >= 0.");
  }

  return {
    valid: errors.length === 0,
    errors,
    event,
  };
}

module.exports = {
  STAGES,
  STATUSES,
  sanitizeEvent,
  validateEvent,
};

if (require.main === module) {
  const sample = {
    runId: "rpt-demo-1",
    taskId: "demo-task",
    stage: "plan_ready",
    status: "ok",
    latencyMs: 32,
  };
  process.stdout.write(`${JSON.stringify(validateEvent(sample), null, 2)}\n`);
}
