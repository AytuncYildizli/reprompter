#!/usr/bin/env node
// Ambient prompt gate for opt-in Claude Code UserPromptSubmit hooks.
//
// Design rules:
//   - FAIL-SOFT: any internal error resolves to empty stdout and exit 0. The
//     gate must never block work or add meaningful latency to a prompt.
//   - OPT-IN: this only runs when a user installs the hook. Set
//     REPROMPTER_AMBIENT=0 as the kill switch.
//   - PRIVACY: raw prompt text never leaves the process; it is not written to
//     telemetry, state files, or any other persisted artifact.
//   - NEVER-BLOCK: the process always exits 0 and never exits 2.

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const WEIGHTS = {
  clarity: 0.2,
  specificity: 0.2,
  structure: 0.15,
  constraints: 0.15,
  verifiability: 0.15,
  decomposition: 0.15,
};

const DEFAULT_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MIN = 15;
const STATE_TTL_MS = 24 * 60 * 60 * 1000;

const TASK_VERBS = [
  "build",
  "create",
  "add",
  "fix",
  "implement",
  "refactor",
  "migrate",
  "write",
  "make",
  "update",
  "improve",
  "optimize",
  "deploy",
  "integrate",
  "convert",
  "design",
  "set up",
  "setup",
  "debug",
  "investigate",
  "audit",
  "review",
  "ekle",
  "yap",
  "kur",
  "yaz",
  "oluştur",
  "düzelt",
  "güncelle",
  "geliştir",
  "incele",
  "araştır",
  "değiştir",
  "kaldır",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

const TASK_VERB_PATTERN = new RegExp(
  `(?:^|[^\\p{L}])(?:${TASK_VERBS.map(escapeRegExp).join("|")})(?=[^\\p{L}]|$)`,
  "iu"
);
const VAGUENESS_PATTERN = new RegExp(
  `(?:^|[^\\p{L}])(?:${[
    "maybe",
    "somehow",
    "stuff",
    "etc",
    "idk",
    "whatever",
    "uhh",
    "or something",
    "belki",
    "falan",
    "filan",
    "herhalde",
    "bilmem",
    "bir şeyler",
  ]
    .map(escapeRegExp)
    .join("|")})(?=[^\\p{L}]|$)`,
  "giu"
);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizedText(value) {
  return String(value || "");
}

function lowerText(value) {
  return normalizedText(value).toLowerCase();
}

function countMatches(text, pattern) {
  const matches = normalizedText(text).match(pattern);
  return matches ? matches.length : 0;
}

function wordCount(text) {
  return (normalizedText(text).trim().match(/\S+/g) || []).length;
}

function hasTaskVerb(text) {
  return TASK_VERB_PATTERN.test(text);
}

function scoreClarity(text) {
  const value = normalizedText(text).trim();
  const lower = lowerText(value);
  const length = value.length;
  const vagueHits = countMatches(lower, VAGUENESS_PATTERN);

  let score = 1;
  if (length >= 40) score += 2;
  if (length >= 100) score += 2;
  if (length >= 240) score += 1;
  if (hasTaskVerb(value)) score += 2;
  score -= vagueHits * 2;

  return clamp(score, 0, 10);
}

function scoreSpecificity(text) {
  const value = normalizedText(text);
  const pathLike = countMatches(value, /\b(?:\.{0,2}\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\b/g);
  const dotted = countMatches(value, /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+\b/g);
  const numbers = countMatches(value, /\b\d+(?:\.\d+)?%?\b/g);
  const quoted = countMatches(value, /"[^"]+"|'[^']+'|`[^`]+`/g);
  const identifiers = countMatches(value, /\b(?:[A-Z]{2,}|[A-Z][a-z]+[A-Z][A-Za-z0-9]*)\b/g);

  let score = 1;
  score += Math.min(pathLike + dotted, 3) * 2;
  score += Math.min(numbers, 2);
  score += Math.min(quoted, 2);
  score += Math.min(identifiers, 3);

  return clamp(score, 0, 10);
}

function scoreStructure(text) {
  const value = normalizedText(text);
  const lines = value.split(/\r?\n/).filter((line) => line.trim());
  const bullets = countMatches(value, /^\s*[-*]\s+/gm);
  const numbered = countMatches(value, /^\s*\d+\.\s+/gm);
  const headings = countMatches(value, /^\s{0,3}#{1,6}\s+/gm);
  const xmlTags = countMatches(value, /<\/?[a-z][a-z0-9_-]*>/gi);

  let score = 0;
  if (lines.length >= 2) score += 2;
  if (lines.length >= 6) score += 2;
  score += Math.min(bullets + numbered, 4);
  score += Math.min(headings, 2);
  score += Math.min(xmlTags, 2);

  return clamp(score, 0, 10);
}

function scoreConstraints(text) {
  const lower = lowerText(text);
  const hits = countMatches(
    lower,
    /\b(?:must|only|never|don't|do not|without breaking|no more than|limit|preserve)\b/g
  );
  if (hits === 0) return 0;
  return clamp(2 + hits * 2, 0, 10);
}

function scoreVerifiability(text) {
  const lower = lowerText(text);
  const hits = countMatches(
    lower,
    /\b(?:test|verify|passes|criteria|expect|assert|coverage|should return)\b/g
  );
  if (hits === 0) return 0;
  return clamp(1 + hits * 2, 0, 10);
}

function scoreDecomposition(text) {
  const value = normalizedText(text);
  const words = wordCount(value);
  if (words > 0 && words < 25) return 8;

  const lower = lowerText(value);
  const markers = countMatches(
    lower,
    /\b(?:then|after that|first|second|third|finally|next)\b|^\s*\d+\.\s+/gm
  );

  let score = 1;
  score += Math.min(markers, 5) * 2;
  if (countMatches(value, /^\s*[-*]\s+/gm) >= 3) score += 2;

  return clamp(score, 0, 10);
}

function scorePrompt(text) {
  const dimensions = {
    clarity: scoreClarity(text),
    specificity: scoreSpecificity(text),
    structure: scoreStructure(text),
    constraints: scoreConstraints(text),
    verifiability: scoreVerifiability(text),
    decomposition: scoreDecomposition(text),
  };
  const overall = Number(
    Object.entries(WEIGHTS)
      .reduce((total, [key, weight]) => total + dimensions[key] * weight, 0)
      .toFixed(1)
  );
  const weakest = Object.entries(dimensions)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([key]) => key);

  return { dimensions, overall, weakest };
}

function cacheDir(env = process.env) {
  const base = env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(base, "reprompter");
}

function defaultStatePath(env = process.env) {
  return path.join(cacheDir(env), "ambient-gate.json");
}

function readState(statePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(statePath, state, nowMs) {
  try {
    const pruned = {};
    for (const [key, value] of Object.entries(state)) {
      const ts = Date.parse(value);
      if (!Number.isNaN(ts) && nowMs - ts <= STATE_TTL_MS) {
        pruned[key] = value;
      }
    }
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(pruned, null, 2), "utf8");
  } catch {
    /* cooldown state is best-effort */
  }
}

function thresholdFromEnv(env) {
  const raw = env.REPROMPTER_AMBIENT_THRESHOLD;
  if (raw == null || String(raw).trim() === "") return DEFAULT_THRESHOLD;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_THRESHOLD;
}

function cooldownMinFromEnv(env) {
  const raw = env.REPROMPTER_AMBIENT_COOLDOWN_MIN;
  if (raw == null || String(raw).trim() === "") return DEFAULT_COOLDOWN_MIN;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COOLDOWN_MIN;
}

function shouldNudge(prompt, options = {}) {
  const env = options.env || process.env;
  const sessionId = options.sessionId || "anonymous";
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const statePath = options.statePath || defaultStatePath(env);
  const trimmed = normalizedText(prompt).trim();

  if (env.REPROMPTER_AMBIENT === "0") return { nudge: false, reason: "disabled" };
  if (/^[!/]/.test(trimmed)) return { nudge: false, reason: "slash-command" };
  if (trimmed.length < 40) return { nudge: false, reason: "too-short" };
  if (/^(yes|no|ok(?:ay)?|sure|continue|go ahead|thanks?|ty|lgtm|approved?|evet|tamam|devam|olur)\b/i.test(trimmed)) {
    return { nudge: false, reason: "acknowledgement" };
  }
  if (/reprompt/i.test(trimmed)) return { nudge: false, reason: "mentions-reprompt" };
  if (!hasTaskVerb(trimmed)) return { nudge: false, reason: "not-a-task" };
  if (wordCount(trimmed) <= 15 && countMatches(lowerText(trimmed), VAGUENESS_PATTERN) === 0) {
    return { nudge: false, reason: "atomic-task" };
  }

  const score = scorePrompt(trimmed);
  if (score.overall >= thresholdFromEnv(env)) {
    return { nudge: false, reason: "above-threshold", score };
  }

  const nowMs = now();
  const state = readState(statePath);
  const last = Date.parse(state[sessionId]);
  const cooldownMs = cooldownMinFromEnv(env) * 60 * 1000;
  if (!Number.isNaN(last) && nowMs - last < cooldownMs) {
    return { nudge: false, reason: "cooldown", score };
  }

  state[sessionId] = new Date(nowMs).toISOString();
  writeState(statePath, state, nowMs);

  return { nudge: true, reason: "below-threshold", score };
}

function buildNudge(scoreResult) {
  const score = scoreResult || scorePrompt("");
  return `<reprompter-ambient-gate>Heuristic prompt quality: ${score.overall}/10 (weakest: ${score.weakest[0]}, ${score.weakest[1]}). If this request is a nontrivial task, briefly offer once for this request to structure it first via the reprompter skill (user can say "reprompt this"); if the user declines or the task is trivial, proceed normally.</reprompter-ambient-gate>`;
}

function hashedSessionId(sessionId) {
  return crypto.createHash("sha256").update(String(sessionId || "anonymous")).digest("hex").slice(0, 12);
}

function emitTelemetry({ env, sessionId, decision, score }) {
  if (env.REPROMPTER_TELEMETRY === "0") return;
  try {
    const { createTelemetryStore } = require("./telemetry-store");
    const store = createTelemetryStore({ dirPath: path.join(cacheDir(env), "telemetry") });
    const scoreResult = score || { overall: null, weakest: [] };
    store.writeEvent({
      runId: `gate-${hashedSessionId(sessionId)}`,
      taskId: "ambient-gate",
      stage: "gate_prompt",
      status: "ok",
      metadata: {
        overall: scoreResult.overall,
        weakest: scoreResult.weakest,
        nudged: Boolean(decision.nudge),
        reason: decision.reason,
      },
    });
  } catch {
    /* telemetry is optional and fail-soft */
  }
}

function readStdin() {
  return fs.readFileSync(0, "utf8");
}

function runHookMode() {
  const raw = readStdin();
  if (!raw.trim()) return;

  const payload = JSON.parse(raw);
  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  const sessionId = typeof payload.session_id === "string" && payload.session_id.trim()
    ? payload.session_id.trim()
    : "anonymous";
  const env = process.env;
  const decision = shouldNudge(prompt, { env, sessionId });
  const score = decision.score || null;

  emitTelemetry({ env, sessionId, decision, score });

  if (decision.nudge) {
    process.stdout.write(`${buildNudge(score)}\n`);
  }
}

module.exports = {
  scorePrompt,
  shouldNudge,
  buildNudge,
};

if (require.main === module) {
  try {
    if (process.argv[2] === "--score") {
      process.stdout.write(`${JSON.stringify(scorePrompt(process.argv[3] || ""), null, 2)}\n`);
    } else {
      runHookMode();
    }
  } catch {
    /* Always fail soft and silent. */
  } finally {
    process.exit(0);
  }
}
