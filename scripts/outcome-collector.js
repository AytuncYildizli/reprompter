#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { fingerprint } = require("./recipe-fingerprint");

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
    const maxFromEnv = Number(process.env.REPROMPTER_FLYWHEEL_MAX_OUTCOMES || 0);
    trimOutcomes(maxFromEnv > 0 ? maxFromEnv : 500);
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

  // Provenance source (e.g., "reverse-exemplar")
  if (typeof raw.source === "string" && raw.source.length > 0) {
    signals.source = raw.source;
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

function parseBooleanEnv(raw, defaultValue) {
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  const normalized = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function injectExemplar(exemplarOutcome, options = {}) {
  // Respect REPROMPTER_FLYWHEEL feature flag (consistent with repromptverse-runtime.js)
  if (parseBooleanEnv(process.env.REPROMPTER_FLYWHEEL, true) === false) {
    return null;
  }

  const store = createOutcomeStore({
    rootDir: options.rootDir || process.cwd(),
    dirPath: options.dirPath,
    filePath: options.filePath,
  });

  if (!exemplarOutcome || typeof exemplarOutcome !== "object") {
    const error = new Error("exemplarOutcome must be a non-null object");
    error.code = "EXEMPLAR_VALIDATION_ERROR";
    throw error;
  }

  // Ensure the source signal is set
  const signals = { ...(exemplarOutcome.signals || {}) };
  if (!signals.source) {
    signals.source = "reverse-exemplar";
  }

  const outcome = {
    ...exemplarOutcome,
    signals: sanitizeExemplarSignals(signals),
  };

  return store.writeOutcome(outcome);
}

function sanitizeExemplarSignals(raw = {}) {
  const base = sanitizeSignals(raw);
  // Preserve reverse-exemplar-specific fields
  if (raw.source) {
    base.source = String(raw.source);
  }
  return base;
}

// ---------------------------------------------------------------------
// Bridge: v1 outcome records → flywheel outcomes
//
// Records produced by scripts/outcome-record.js (schema v1, one JSON per
// run under .reprompter/outcomes/) have a different shape than the
// flywheel's NDJSON store. Convert here so the existing
// strategy-learner.js machinery can consume them unchanged.
// ---------------------------------------------------------------------

function defaultV1RecordsDir(rootDir = process.cwd()) {
  return path.join(rootDir, ".reprompter", "outcomes");
}

function v1RecordToFlywheelOutcome(v1Record) {
  if (!v1Record || typeof v1Record !== "object") {
    throw new Error("v1RecordToFlywheelOutcome: record must be an object");
  }
  if (typeof v1Record.prompt_fingerprint !== "string") {
    throw new Error("v1RecordToFlywheelOutcome: missing prompt_fingerprint");
  }

  const promptText = String(v1Record.prompt_text || "");
  const contextLayers = (promptText.match(/<context\b/gi) || []).length;
  const score = Number.isFinite(v1Record.score) ? v1Record.score : 0;

  const recipe = fingerprint({
    templateId: String(v1Record.task_type || "unknown"),
    patterns: [],
    capabilityTier: "default",
    domain: "",
    contextLayers,
    qualityScore: score,
  });

  const signals = { source: "flywheel-ingest-v1" };
  if (Number.isFinite(v1Record.score)) {
    signals.artifactScore = v1Record.score;
    signals.artifactPass = v1Record.score >= 7;
  }

  return {
    timestamp: v1Record.timestamp || new Date().toISOString(),
    runId: v1Record.prompt_fingerprint,
    taskId: String(v1Record.task_type || "unknown"),
    recipe,
    signals,
  };
}

function ingestOutcomeRecord(v1Record, options = {}) {
  const outcome = v1RecordToFlywheelOutcome(v1Record);
  const store = createOutcomeStore({
    rootDir: options.rootDir,
    dirPath: options.dirPath,
    filePath: options.filePath,
  });
  return store.writeOutcome(outcome);
}

function ingestDirectory(dir, options = {}) {
  const targetDir = dir || defaultV1RecordsDir(options.rootDir || process.cwd());
  if (!fs.existsSync(targetDir)) {
    return { ingested: 0, skipped: 0, errors: [], dir: targetDir };
  }

  const files = fs
    .readdirSync(targetDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(targetDir, f));

  const errors = [];
  let ingested = 0;
  let skipped = 0;

  for (const f of files) {
    try {
      const v1 = JSON.parse(fs.readFileSync(f, "utf8"));
      if (v1.schema_version !== undefined && v1.schema_version !== 1) {
        skipped++;
        errors.push({ file: path.basename(f), reason: `unsupported schema_version: ${v1.schema_version}` });
        continue;
      }
      if (typeof v1.prompt_fingerprint !== "string") {
        skipped++;
        errors.push({ file: path.basename(f), reason: "missing prompt_fingerprint (not a v1 record)" });
        continue;
      }
      ingestOutcomeRecord(v1, options);
      ingested++;
    } catch (e) {
      skipped++;
      errors.push({ file: path.basename(f), reason: e.message });
    }
  }

  return { ingested, skipped, errors, dir: targetDir };
}

module.exports = {
  createOutcomeStore,
  defaultOutcomeDir,
  defaultV1RecordsDir,
  validateOutcome,
  sanitizeSignals,
  computeEffectiveness,
  collectGitSignals,
  injectExemplar,
  v1RecordToFlywheelOutcome,
  ingestOutcomeRecord,
  ingestDirectory,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--ingest-dir") {
    const dir = args[1] || defaultV1RecordsDir();
    const result = ingestDirectory(dir);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.errors.length > 0 && result.ingested === 0 ? 1 : 0);
  }
  const store = createOutcomeStore();
  process.stdout.write(`${JSON.stringify({ filePath: store.filePath }, null, 2)}\n`);
}
