#!/usr/bin/env node
/*
 * outcome-record.js — append an outcome_record JSON file to
 * .reprompter/outcomes/ after a Mode 1 reprompter prompt has been run.
 * Schema reference: docs/outcome-capture-schema.md (v1). v1 records only;
 * evaluation and scoring are deferred to v2.
 *
 * Usage (CLI):
 *   node scripts/outcome-record.js \
 *     --prompt path/to/prompt.txt \
 *     --output path/to/output.txt \
 *     --criteria path/to/criteria.json \
 *     --task-type fix_bug [--mode single] [--notes "..."] \
 *     [--outcomes-dir .reprompter/outcomes]
 *
 * Self-test: node scripts/outcome-record.js --self-test
 *
 * Library: const { recordOutcome } = require('./scripts/outcome-record.js');
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const assert = require('node:assert');

const sha256Hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const isoSec = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
// Colons are invalid on some filesystems; swap for hyphens in filenames.
const isoSecForFilename = (d) => isoSec(d).replace(/:/g, '-');

// Validate the optional applied_recommendation attribution block. All
// four fields are required when the object is present so downstream A/B
// reporting has a complete attribution. Returns a normalized object or
// undefined.
function normalizeAppliedRecommendation(input) {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('recordOutcome: appliedRecommendation must be an object when provided');
  }
  const { recipe_hash, confidence, sample_count, applied_at } = input;
  if (typeof recipe_hash !== 'string' || recipe_hash.length === 0) {
    throw new Error('recordOutcome: appliedRecommendation.recipe_hash is required (non-empty string)');
  }
  if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') {
    throw new Error('recordOutcome: appliedRecommendation.confidence must be "low" | "medium" | "high"');
  }
  if (!Number.isFinite(sample_count) || sample_count < 0 || !Number.isInteger(sample_count)) {
    throw new Error('recordOutcome: appliedRecommendation.sample_count must be a non-negative integer');
  }
  if (typeof applied_at !== 'string' || applied_at.length === 0) {
    throw new Error('recordOutcome: appliedRecommendation.applied_at is required (non-empty string)');
  }
  return { recipe_hash, confidence, sample_count, applied_at };
}

function recordOutcome({
  promptText, outputText, criteria, taskType,
  mode = 'single', role, appliedRecommendation, notes = '', outcomesDir, now,
} = {}) {
  if (typeof promptText !== 'string' || promptText.length === 0) {
    throw new Error('recordOutcome: promptText is required (non-empty string)');
  }
  if (typeof outputText !== 'string') {
    throw new Error('recordOutcome: outputText is required (string)');
  }
  if (!Array.isArray(criteria)) {
    throw new Error('recordOutcome: criteria is required (array of criterion objects)');
  }
  if (typeof taskType !== 'string' || taskType.length === 0) {
    throw new Error('recordOutcome: taskType is required (non-empty string)');
  }
  if (role !== undefined && (typeof role !== 'string' || role.length === 0)) {
    throw new Error('recordOutcome: role, if provided, must be a non-empty string');
  }
  const normalizedApplied = normalizeAppliedRecommendation(appliedRecommendation);

  const dir = outcomesDir || path.join(process.cwd(), '.reprompter', 'outcomes');
  fs.mkdirSync(dir, { recursive: true });

  const when = now instanceof Date ? now : new Date();
  const fingerprintHex = sha256Hex(promptText);
  const baseName = `${isoSecForFilename(when)}-${fingerprintHex.slice(0, 8)}`;

  // Pick a filename that doesn't already exist. Two runs of the same
  // prompt within the same second would collide on (timestamp, short-fp);
  // we fall through to -2, -3, ... rather than silently overwriting an
  // earlier record (codex flagged on #33).
  let filepath;
  let suffix = 0;
  // Safety cap — 10_000 identical-second collisions is well beyond any
  // realistic workload and keeps the loop bounded.
  for (; suffix < 10000; suffix++) {
    const name = suffix === 0 ? `${baseName}.json` : `${baseName}-${suffix + 1}.json`;
    const candidate = path.join(dir, name);
    try {
      // wx = create only; throws EEXIST if present.
      const fd = fs.openSync(candidate, 'wx');
      fs.closeSync(fd);
      filepath = candidate;
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
  if (!filepath) {
    throw new Error(`recordOutcome: could not allocate unique filename under ${dir} (baseName=${baseName})`);
  }

  const record = {
    schema_version: 1,
    timestamp: isoSec(when),
    prompt_fingerprint: `sha256:${fingerprintHex}`,
    prompt_text: promptText,
    task_type: taskType,
    mode,
    success_criteria: criteria,
    output_text: outputText,
    verification_results: {},
    score: null,
    notes,
  };
  if (role !== undefined) record.role = role;
  if (normalizedApplied !== undefined) record.applied_recommendation = normalizedApplied;

  fs.writeFileSync(filepath, JSON.stringify(record, null, 2) + '\n', 'utf8');
  return filepath;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') { out.selfTest = true; continue; }
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[key] = true; }
    else { out[key] = next; i++; }
  }
  return out;
}

function readFileOrDie(p, label) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) { throw new Error(`Cannot read ${label} at ${p}: ${e.message}`); }
}

function runCli(argv) {
  const args = parseArgs(argv);
  if (args.selfTest) return runSelfTest();

  const required = ['prompt', 'output', 'criteria', 'task-type'];
  const missing = required.filter((k) => !args[k]);
  if (missing.length) {
    throw new Error(
      `Missing required flags: ${missing.map((m) => '--' + m).join(', ')}. ` +
      `See header of ${path.basename(__filename)} for usage.`
    );
  }

  const promptText = readFileOrDie(args.prompt, '--prompt');
  const outputText = readFileOrDie(args.output, '--output');
  let criteria;
  try { criteria = JSON.parse(readFileOrDie(args.criteria, '--criteria')); }
  catch (e) { throw new Error(`--criteria must be a JSON array of criterion objects (${e.message})`); }

  // --applied-recommendation accepts either an inline JSON string or a
  // path to a JSON file. Omit it entirely (or pass "null") for bias-off
  // runs so the resulting record has no applied_recommendation field.
  let appliedRecommendation;
  const appliedFlag = args['applied-recommendation'];
  if (appliedFlag !== undefined && appliedFlag !== true && appliedFlag !== 'null') {
    let raw;
    if (typeof appliedFlag === 'string' && appliedFlag.trim().startsWith('{')) {
      raw = appliedFlag;
    } else if (typeof appliedFlag === 'string') {
      raw = readFileOrDie(appliedFlag, '--applied-recommendation');
    } else {
      throw new Error('--applied-recommendation must be an inline JSON object or a path to a JSON file');
    }
    try {
      appliedRecommendation = JSON.parse(raw);
    } catch (e) {
      throw new Error(`--applied-recommendation must be valid JSON (${e.message})`);
    }
  }

  const written = recordOutcome({
    promptText, outputText, criteria,
    taskType: args['task-type'],
    mode: args.mode || 'single',
    role: args.role,
    appliedRecommendation,
    notes: args.notes || '',
    outcomesDir: args['outcomes-dir'],
  });
  process.stdout.write(written + '\n');
}

function runSelfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-record-'));
  const criteria = [{
    id: 'compiles',
    description: 'tsc --noEmit succeeds on the patched file.',
    verification_method: 'manual',
  }];
  const written = recordOutcome({
    promptText: '<role>test role</role>\n<task>synthetic self-test</task>',
    outputText: 'ok',
    criteria,
    taskType: 'fix_bug',
    notes: 'self-test',
    outcomesDir: tmp,
    now: new Date('2026-04-17T14:23:09Z'),
  });

  const parsed = JSON.parse(fs.readFileSync(written, 'utf8'));
  assert.strictEqual(parsed.schema_version, 1);
  assert.strictEqual(parsed.timestamp, '2026-04-17T14:23:09Z');
  assert.ok(parsed.prompt_fingerprint.startsWith('sha256:'));
  assert.strictEqual(parsed.task_type, 'fix_bug');
  assert.strictEqual(parsed.mode, 'single');
  assert.deepStrictEqual(parsed.success_criteria, criteria);
  assert.strictEqual(parsed.output_text, 'ok');
  assert.deepStrictEqual(parsed.verification_results, {});
  assert.strictEqual(parsed.score, null);
  assert.strictEqual(parsed.notes, 'self-test');

  const expectedShortFp = sha256Hex(parsed.prompt_text).slice(0, 8);
  assert.ok(
    path.basename(written).endsWith(`-${expectedShortFp}.json`),
    `filename must end with -${expectedShortFp}.json, got ${path.basename(written)}`
  );
  assert.ok(path.basename(written).startsWith('2026-04-17T14-23-09Z-'));

  assert.throws(() => recordOutcome({ outputText: 'x', criteria: [], taskType: 'x' }));

  // Collision handling (codex #33): two identical runs within the same
  // second must produce two distinct files, not silently overwrite.
  const colDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-record-col-'));
  const colArgs = {
    promptText: '<role>x</role><task>collision</task>',
    outputText: 'ok',
    criteria: [{ id: 'c1', description: 'x', verification_method: 'manual' }],
    taskType: 'fix_bug',
    outcomesDir: colDir,
    now: new Date('2026-04-17T14:23:09Z'),
  };
  const first = recordOutcome(colArgs);
  const second = recordOutcome(colArgs);
  const third = recordOutcome(colArgs);
  assert.notStrictEqual(first, second, 'second run must not reuse first run filename');
  assert.notStrictEqual(second, third, 'third run must not reuse second run filename');
  assert.ok(/-2\.json$/.test(second), `second should carry -2 suffix, got ${path.basename(second)}`);
  assert.ok(/-3\.json$/.test(third), `third should carry -3 suffix, got ${path.basename(third)}`);
  fs.rmSync(colDir, { recursive: true, force: true });

  // Role handling (codex #36): role, when provided, is stamped on the
  // record so downstream ingest can use it as a domain for fingerprinting.
  const roleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-record-role-'));
  const roleFile = recordOutcome({
    promptText: '<role>architect</role>',
    outputText: 'schema out',
    criteria: [],
    taskType: 'architecture',
    mode: 'repromptverse',
    role: 'architect',
    outcomesDir: roleDir,
  });
  const roleRecord = JSON.parse(fs.readFileSync(roleFile, 'utf8'));
  assert.strictEqual(roleRecord.role, 'architect');
  assert.strictEqual(roleRecord.mode, 'repromptverse');
  assert.throws(
    () => recordOutcome({ ...colArgs, role: '', outcomesDir: roleDir }),
    /role, if provided, must be a non-empty string/
  );
  fs.rmSync(roleDir, { recursive: true, force: true });

  // applied_recommendation (v3 part 3): stamped when present, absent
  // on bias-off runs, rejected when malformed.
  const attrDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-record-attr-'));
  const attr = {
    recipe_hash: 'abc123',
    confidence: 'high',
    sample_count: 12,
    applied_at: 'prompt_gen',
  };
  const biasOn = recordOutcome({
    promptText: '<role>biased</role>',
    outputText: 'ok',
    criteria: [],
    taskType: 'fix_bug',
    appliedRecommendation: attr,
    outcomesDir: attrDir,
  });
  const biasOnRecord = JSON.parse(fs.readFileSync(biasOn, 'utf8'));
  assert.deepStrictEqual(biasOnRecord.applied_recommendation, attr);

  const biasOff = recordOutcome({
    promptText: '<role>no bias</role>',
    outputText: 'ok',
    criteria: [],
    taskType: 'fix_bug',
    outcomesDir: attrDir,
  });
  const biasOffRecord = JSON.parse(fs.readFileSync(biasOff, 'utf8'));
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(biasOffRecord, 'applied_recommendation'),
    false,
    'bias-off records must NOT carry applied_recommendation (absence is the bias-off signal)'
  );

  // Validation errors on each field.
  for (const [bad, pattern] of [
    [{ ...attr, recipe_hash: '' }, /recipe_hash is required/],
    [{ ...attr, confidence: 'meh' }, /confidence must be/],
    [{ ...attr, sample_count: -1 }, /sample_count must be a non-negative integer/],
    [{ ...attr, sample_count: 1.5 }, /sample_count must be a non-negative integer/],
    [{ ...attr, applied_at: '' }, /applied_at is required/],
    ['not an object', /must be an object/],
  ]) {
    assert.throws(
      () => recordOutcome({
        promptText: '<role>x</role>',
        outputText: 'x',
        criteria: [],
        taskType: 'x',
        appliedRecommendation: bad,
        outcomesDir: attrDir,
      }),
      pattern,
      `expected rejection for ${JSON.stringify(bad)}`
    );
  }
  fs.rmSync(attrDir, { recursive: true, force: true });

  fs.rmSync(tmp, { recursive: true, force: true });
  process.stdout.write('outcome-record self-test: ok\n');
}

module.exports = { recordOutcome, normalizeAppliedRecommendation };

if (require.main === module) {
  try { runCli(process.argv.slice(2)); }
  catch (e) {
    process.stderr.write(`outcome-record: ${e.message}\n`);
    process.exit(1);
  }
}
