#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function defaultOutcomeDir(rootDir = process.cwd()) {
  return path.join(rootDir, ".reprompter", "flywheel");
}

function createOutcomeStore(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const dirPath = options.dirPath || defaultOutcomeDir(rootDir);
  const filePath = options.filePath || path.join(dirPath, "outcomes.ndjson");

  function ensureDir() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function writeOutcome(outcome) {
    const validated = validateOutcome(outcome);
    if (!validated.valid) {
      const error = new Error(`Invalid outcome: ${validated.errors.join(" | ")}`);
      error.code = "OUTCOME_VALIDATION_ERROR";
      error.details = validated;
      throw error;
    }

    ensureDir();
    fs.appendFileSync(filePath, `${JSON.stringify(validated.outcome)}\n`, "utf8");
    trimOutcomes();
    return validated.outcome;
  }

  function trimOutcomes(maxEntries = 500) {
    if (!fs.existsSync(filePath)) return;

    const lines = fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim() !== "");

    if (lines.length <= maxEntries) return;

    const kept = lines.slice(lines.length - maxEntries);
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, kept.join("\n") + "\n", "utf8");
    fs.renameSync(tmpPath, filePath);
  }

  function readOutcomes(readOptions = {}) {
    if (!fs.existsSync(filePath)) return [];

    const lines = fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let outcomes = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (readOptions.domain) {
      outcomes = outcomes.filter((o) =>
        o.recipe && o.recipe.vector && o.recipe.vector.domain === readOptions.domain
      );
    }

    const limit = Number(readOptions.limit || 0);
    if (limit > 0 && outcomes.length > limit) {
      outcomes = outcomes.slice(outcomes.length - limit);
    }

    return outcomes;
  }

  function clear() {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }

  return {
    rootDir,
    dirPath,
    filePath,
    writeOutcome,
    readOutcomes,
    trimOutcomes,
    clear,
  };
}

function validateOutcome(input = {}) {
  const errors = [];

  if (!input.runId || typeof input.runId !== "string") {
    errors.push("runId is required and must be a string.");
  }
  if (!input.taskId || typeof input.taskId !== "string") {
    errors.push("taskId is required and must be a string.");
  }
  if (!input.recipe || typeof input.recipe !== "object") {
    errors.push("recipe fingerprint is required.");
  }
  if (!input.signals || typeof input.signals !== "object") {
    errors.push("signals object is required.");
  }

  const outcome = {
    timestamp: input.timestamp || new Date().toISOString(),
    runId: String(input.runId || ""),
    taskId: String(input.taskId || ""),
    recipe: input.recipe || {},
    signals: sanitizeSignals(input.signals || {}),
    effectivenessScore: Number.isFinite(input.effectivenessScore)
      ? input.effectivenessScore
      : computeEffectiveness(input.signals || {}),
  };

  return { valid: errors.length === 0, errors, outcome };
}

function sanitizeSignals(raw = {}) {
  const signals = {};

  // Artifact evaluator score (from Phase 4)
  if (Number.isFinite(raw.artifactScore)) {
    signals.artifactScore = Number(raw.artifactScore);
  }

  // Did the artifact pass the evaluator gate?
  if (typeof raw.artifactPass === "boolean") {
    signals.artifactPass = raw.artifactPass;
  }

  // Number of retries needed (0 = first attempt passed)
  if (Number.isFinite(raw.retryCount)) {
    signals.retryCount = Math.max(0, Math.round(raw.retryCount));
  }

  // Git-based passive signals
  if (Number.isFinite(raw.filesChanged)) {
    signals.filesChanged = Math.max(0, Math.round(raw.filesChanged));
  }
  if (Number.isFinite(raw.insertions)) {
    signals.insertions = Math.max(0, Math.round(raw.insertions));
  }
  if (Number.isFinite(raw.deletions)) {
    signals.deletions = Math.max(0, Math.round(raw.deletions));
  }

  // Post-task correction proxy
  if (Number.isFinite(raw.postCorrectionEdits)) {
    signals.postCorrectionEdits = Math.max(0, Math.round(raw.postCorrectionEdits));
  }

  // Wall-clock execution time in ms
  if (Number.isFinite(raw.executionMs)) {
    signals.executionMs = Math.max(0, raw.executionMs);
  }

  // Explicit user verdict (optional)
  if (raw.userVerdict === "accept" || raw.userVerdict === "reject") {
    signals.userVerdict = raw.userVerdict;
  }

  return signals;
}

function computeEffectiveness(signals = {}) {
  let score = 5.0; // neutral baseline

  // Artifact evaluator score is the strongest signal
  if (Number.isFinite(signals.artifactScore)) {
    score = signals.artifactScore;
  }

  // Penalty for retries (each retry = -0.5)
  if (Number.isFinite(signals.retryCount) && signals.retryCount > 0) {
    score -= signals.retryCount * 0.5;
  }

  // Bonus for passing on first attempt
  if (signals.artifactPass === true && (!signals.retryCount || signals.retryCount === 0)) {
    score += 0.5;
  }

  // Penalty for post-corrections (each correction = -0.3)
  if (Number.isFinite(signals.postCorrectionEdits) && signals.postCorrectionEdits > 0) {
    score -= Math.min(signals.postCorrectionEdits * 0.3, 2.0);
  }

  // Explicit user verdict overrides
  if (signals.userVerdict === "reject") {
    score = Math.min(score, 3.0);
  }
  if (signals.userVerdict === "accept" && score < 7.0) {
    score = 7.0;
  }

  return Number(Math.max(0, Math.min(10, score)).toFixed(2));
}

function collectGitSignals(rootDir = process.cwd()) {
  const signals = {};

  try {
    const diffStat = execFileSync(
      "git",
      ["diff", "--stat", "HEAD~1", "HEAD"],
      { cwd: rootDir, encoding: "utf8", timeout: 5000 }
    ).trim();

    if (diffStat) {
      const summaryMatch = diffStat.match(
        /(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?)?(?:,\s+(\d+)\s+deletions?)?/
      );
      if (summaryMatch) {
        signals.filesChanged = Number(summaryMatch[1] || 0);
        signals.insertions = Number(summaryMatch[2] || 0);
        signals.deletions = Number(summaryMatch[3] || 0);
      }
    }
  } catch {
    // Not in a git repo or git not available — signals stay empty
  }

  // Post-correction proxy: count recent commits that modified the same files
  try {
    const recentLog = execFileSync(
      "git",
      ["log", "--since=10min", "--diff-filter=M", "--format=", "--name-only", "HEAD"],
      { cwd: rootDir, encoding: "utf8", timeout: 5000 }
    ).trim();

    if (recentLog) {
      const modifiedFiles = recentLog.split(/\r?\n/).filter((l) => l.trim() !== "");
      signals.postCorrectionEdits = modifiedFiles.length;
    } else {
      signals.postCorrectionEdits = 0;
    }
  } catch {
    // git log failed — leave postCorrectionEdits unset
  }

  return signals;
}

module.exports = {
  createOutcomeStore,
  defaultOutcomeDir,
  validateOutcome,
  sanitizeSignals,
  computeEffectiveness,
  collectGitSignals,
};

if (require.main === module) {
  const store = createOutcomeStore();
  process.stdout.write(`${JSON.stringify({ filePath: store.filePath }, null, 2)}\n`);
}
