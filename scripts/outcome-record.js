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

function recordOutcome({
  promptText, outputText, criteria, taskType,
  mode = 'single', notes = '', outcomesDir, now,
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

  const dir = outcomesDir || path.join(process.cwd(), '.reprompter', 'outcomes');
  fs.mkdirSync(dir, { recursive: true });

  const when = now instanceof Date ? now : new Date();
  const fingerprintHex = sha256Hex(promptText);
  const filename = `${isoSecForFilename(when)}-${fingerprintHex.slice(0, 8)}.json`;
  const filepath = path.join(dir, filename);

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

  const written = recordOutcome({
    promptText, outputText, criteria,
    taskType: args['task-type'],
    mode: args.mode || 'single',
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

  fs.rmSync(tmp, { recursive: true, force: true });
  process.stdout.write('outcome-record self-test: ok\n');
}

module.exports = { recordOutcome };

if (require.main === module) {
  try { runCli(process.argv.slice(2)); }
  catch (e) {
    process.stderr.write(`outcome-record: ${e.message}\n`);
    process.exit(1);
  }
}
