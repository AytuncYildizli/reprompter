#!/usr/bin/env node
"use strict";

// Fleet flywheel sync rules:
// - LEDGER-ONLY: never read `.reprompter/outcomes/`; those v1 files can hold prompt text.
// - DETERMINISTIC: same input row sanitizes identically on every machine so recipe groups merge.
// - PRIVACY: packs contain no raw prompt hashes, task slugs, role labels, or hostnames by default.
// - FAIL-SOFT CLI: malformed files/rows are counted and skipped instead of aborting the run.

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createOutcomeStore,
  defaultOutcomeDir,
  outcomeDedupKey,
} = require("./outcome-collector");
const { fingerprint: createRecipeFingerprint } = require("./recipe-fingerprint");

const PACK_SCHEMA = "reprompter.flywheel_pack.v1";
const ALLOWLISTED_DOMAINS = new Set([
  "frontend",
  "backend",
  "fullstack",
  "security",
  "testing",
  "docs",
  "research",
  "ops",
  "content",
  "data",
  "mobile",
  "infra",
  "",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function defaultOriginLabel() {
  return `o-${sha256(os.hostname()).slice(0, 8)}`;
}

function yyyymmdd(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function normalizeDomain(value) {
  const domain = String(value || "").trim().toLowerCase();
  if (ALLOWLISTED_DOMAINS.has(domain)) return domain;
  return `d-${sha256(domain).slice(0, 8)}`;
}

function sanitizeSignals(signals = {}) {
  const sanitized = {};
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) {
    return sanitized;
  }

  for (const [key, value] of Object.entries(signals)) {
    if (Number.isFinite(value)) {
      sanitized[key] = Number(value);
    }
  }
  return sanitized;
}

function sanitizeAppliedRecommendation(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { recipe_hash, confidence, sample_count, applied_at } = raw;
  if (typeof recipe_hash !== "string" || recipe_hash.length === 0) return null;
  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") return null;
  if (!Number.isInteger(sample_count) || sample_count < 0) return null;
  if (typeof applied_at !== "string" || applied_at.length === 0) return null;
  return { recipe_hash, confidence, sample_count, applied_at };
}

function qualityScoreForBucket(bucket) {
  switch (String(bucket || "").trim().toLowerCase()) {
    case "excellent":
      return 9;
    case "good":
      return 7;
    case "fair":
      return 5;
    case "weak":
      return 3;
    case "poor":
    default:
      return 0;
  }
}

function sanitizeRecipe(row) {
  const vector = {
    ...((row.recipe && row.recipe.vector) || {}),
  };
  vector.domain = normalizeDomain(vector.domain);
  return createRecipeFingerprint({
    ...vector,
    qualityScore: qualityScoreForBucket(vector.qualityBucket),
  });
}

function sanitizeRow(row, options = {}) {
  const originLabel = options.originLabel || defaultOriginLabel();
  const sanitized = {
    timestamp: row.timestamp,
    runId: `fw-${sha256(row.runId).slice(0, 12)}`,
    taskId: `ft-${sha256(row.taskId).slice(0, 12)}`,
    recipe: sanitizeRecipe(row),
    signals: sanitizeSignals(row.signals),
    origin: originLabel,
  };

  if (Number.isFinite(row.effectivenessScore)) {
    sanitized.effectivenessScore = Number(row.effectivenessScore);
  }

  const applied = sanitizeAppliedRecommendation(row.applied_recommendation);
  if (applied) {
    sanitized.applied_recommendation = applied;
  }

  return sanitized;
}

function defaultPackPath(rootDir, originLabel) {
  return path.join(defaultOutcomeDir(rootDir), "packs", `${originLabel}-${yyyymmdd()}.ndjson`);
}

function exportPack(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const originLabel = options.originLabel || defaultOriginLabel();
  const out = options.out || defaultPackPath(rootDir, originLabel);
  const store = createOutcomeStore({ rootDir });
  const rows = store
    .readOutcomes({ limit: Number.MAX_SAFE_INTEGER })
    .map((row) => sanitizeRow(row, { originLabel }));

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const header = {
    pack: PACK_SCHEMA,
    exported_at: new Date().toISOString(),
    origin: originLabel,
    rows: rows.length,
  };
  const body = [JSON.stringify(header), ...rows.map((row) => JSON.stringify(row))].join("\n") + "\n";
  fs.writeFileSync(out, body, "utf8");
  return { out, origin: originLabel, rows: rows.length };
}

function listPackFiles(from) {
  if (!from || !fs.existsSync(from)) return [];
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    return fs
      .readdirSync(from)
      .filter((name) => name.endsWith(".ndjson"))
      .sort()
      .map((name) => path.join(from, name));
  }
  return [from];
}

function readJsonLine(line) {
  return JSON.parse(line);
}

function ledgerAtOrOverCap(store) {
  const maxFromEnv = Number(process.env.REPROMPTER_FLYWHEEL_MAX_OUTCOMES || 0);
  const cap = maxFromEnv > 0 ? maxFromEnv : 500;
  const count = store.readOutcomes({ limit: Number.MAX_SAFE_INTEGER }).length;
  return { atOrOver: count >= cap, count, cap };
}

function importPacks(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const from = options.from;
  const store = createOutcomeStore({ rootDir });
  const files = listPackFiles(from);
  const seen = new Set(
    store
      .readOutcomes({ limit: Number.MAX_SAFE_INTEGER })
      .map((row) => outcomeDedupKey(row))
  );
  const warnings = [];
  let imported = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const file of files) {
    let lines;
    try {
      lines = fs
        .readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (error) {
      skipped++;
      warnings.push(`${path.basename(file)}: ${error.message}`);
      continue;
    }

    if (lines.length === 0) {
      skipped++;
      warnings.push(`${path.basename(file)}: empty pack`);
      continue;
    }

    let header;
    try {
      header = readJsonLine(lines[0]);
    } catch (error) {
      skipped++;
      warnings.push(`${path.basename(file)}: invalid header JSON`);
      continue;
    }

    if (!header || header.pack !== PACK_SCHEMA) {
      skipped++;
      warnings.push(`${path.basename(file)}: skipped non-flywheel pack`);
      continue;
    }

    for (const line of lines.slice(1)) {
      let row;
      try {
        row = readJsonLine(line);
        const key = outcomeDedupKey(row);
        if (seen.has(key)) {
          duplicates++;
          continue;
        }
        store.writeOutcome(row);
        seen.add(key);
        imported++;
      } catch (error) {
        skipped++;
        warnings.push(`${path.basename(file)}: skipped malformed row (${error.message})`);
      }
    }
  }

  const cap = ledgerAtOrOverCap(store);
  if (cap.atOrOver) {
    warnings.push(
      `NOTE: ledger has ${cap.count} rows at/over cap ${cap.cap}; fleet users can set REPROMPTER_FLYWHEEL_MAX_OUTCOMES=5000.`
    );
  }

  return { imported, duplicates, skipped, files: files.length, warnings };
}

function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--export") {
      args.mode = "export";
      continue;
    }
    if (token === "--import") {
      args.mode = "import";
      args.from = argv[i + 1];
      i++;
      continue;
    }
    if (token === "--out") {
      args.out = argv[i + 1];
      i++;
      continue;
    }
    if (token === "--origin") {
      args.originLabel = argv[i + 1];
      i++;
      continue;
    }
    if (token === "--root-dir") {
      args.rootDir = argv[i + 1];
      i++;
      continue;
    }
    if (token === "--json") {
      args.json = true;
      continue;
    }
  }
  return args;
}

function printResult(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  for (const warning of result.warnings || []) {
    process.stderr.write(`flywheel-sync: ${warning}\n`);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  if (args.mode === "export") {
    printResult(exportPack(args), args.json);
    return 0;
  }
  if (args.mode === "import" && args.from) {
    printResult(importPacks(args), args.json);
    return 0;
  }

  process.stderr.write(
    "flywheel-sync: use --export [--out F] [--origin L] [--root-dir D] [--json] or --import <file-or-dir> [--root-dir D] [--json]\n"
  );
  return 1;
}

module.exports = {
  PACK_SCHEMA,
  ALLOWLISTED_DOMAINS,
  sanitizeRow,
  exportPack,
  importPacks,
  defaultOriginLabel,
};

if (require.main === module) {
  process.exit(runCli());
}
