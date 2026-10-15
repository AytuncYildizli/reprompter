#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_RE = /(?:token|secret|password|authorization|api[-_]?key|session|cookie|email|phone|prompt|content|url)$/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const LONG_TOKEN_RE = /\b[a-zA-Z0-9_-]{32,}\b/g;

function redactString(value) {
  return String(value).replace(EMAIL_RE, REDACTED).replace(PHONE_RE, REDACTED).replace(LONG_TOKEN_RE, REDACTED);
}

function redactTelemetry(input, depth = 0) {
  if (depth > 6) return REDACTED;
  if (input == null) return input;
  if (typeof input === "string") return redactString(input);
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map((item) => redactTelemetry(item, depth + 1));
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : redactTelemetry(value, depth + 1);
  }
  return out;
}

function sanitizeHeader(value) {
  if (Array.isArray(value)) value = value[0];
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return clean ? clean.slice(0, 128) : undefined;
}

function parseTraceParent(traceparent) {
  const parts = String(traceparent || "").split("-");
  if (parts.length < 4) return {};
  return {
    trace_id: /^[a-f0-9]{32}$/i.test(parts[1]) ? parts[1].toLowerCase() : undefined,
    span_id: /^[a-f0-9]{16}$/i.test(parts[2]) ? parts[2].toLowerCase() : undefined,
  };
}

function createObservabilityContext(headers = {}, overrides = {}) {
  const trace = parseTraceParent(sanitizeHeader(headers.traceparent));
  return {
    request_id: sanitizeHeader(headers["x-request-id"]) || crypto.randomUUID(),
    ...trace,
    correlation_id: sanitizeHeader(headers["x-correlation-id"]) || crypto.randomUUID(),
    actor_id: sanitizeHeader(headers["x-actor-id"]),
    session_id: sanitizeHeader(headers["x-session-id"]),
    app_version: sanitizeHeader(headers["x-app-version"]) || process.env.APP_VERSION || "12.7.1",
    environment: process.env.NODE_ENV || "development",
    surface: sanitizeHeader(headers["x-client-surface"]) || "cli",
    ...overrides,
  };
}

function normalizeLabels(labels = {}) {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([key]) => !["request_id", "trace_id", "span_id", "correlation_id", "actor_id", "session_id"].includes(key))
      .map(([key, value]) => [key.replace(/[^a-zA-Z0-9_]/g, "_"), value == null || value === "" ? "unknown" : String(value).slice(0, 96)])
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

function renderSample(name, labels, value) {
  const pairs = Object.entries(normalizeLabels(labels));
  const suffix = pairs.length ? `{${pairs.map(([key, val]) => `${key}="${String(val).replace(/"/g, "\\\"")}"`).join(",")}}` : "";
  return `${name}${suffix} ${value}`;
}

module.exports = {
  REDACTED,
  redactString,
  redactTelemetry,
  createObservabilityContext,
  normalizeLabels,
  renderSample,
};
