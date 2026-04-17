#!/usr/bin/env node
/*
 * evaluate-outcome.js — score an outcome record against its success_criteria.
 *
 * Reads a JSON outcome_record (produced by scripts/outcome-record.js),
 * applies each criterion's verification_method, and fills in
 * verification_results + score. Writes the updated record back to the
 * same file (default) or to stdout (--stdout).
 *
 * Evaluation rules per verification_method:
 *   - "rule" with rule.type = "regex":
 *       Pass if new RegExp(rule.body, 's').test(output_text) returns true.
 *   - "rule" with rule.type = "predicate":
 *       Evaluate a minimal DSL (parsePredicate). Pass if the predicate holds.
 *       Supported forms:
 *         len(output_text) OP N     OP in <, >, <=, >=, ==, !=
 *         contains("literal")
 *         not contains("literal")
 *   - "llm_judge":
 *       If --judge-cmd is provided, spawn that command with the
 *       judge_prompt + output fed via stdin. Parse stdout's first line
 *       for "pass" or "fail" (case-insensitive). Without --judge-cmd,
 *       llm_judge criteria are marked "skipped".
 *   - "manual":
 *       Always marked "skipped". A human fills these in later.
 *
 * Score: round(passed / (passed + failed) * 10). Skipped criteria are
 * excluded from the denominator; they do not hurt the score. If every
 * criterion is skipped, score is null.
 *
 * Usage:
 *   node scripts/evaluate-outcome.js --record <path>
 *     [--stdout]               # print instead of writing back
 *     [--judge-cmd "<cmd>"]    # shell command for llm_judge criteria
 *     [--verbose]              # log skipped-reason details to stderr
 *
 * Self-test:
 *   node scripts/evaluate-outcome.js --self-test
 *
 * Library:
 *   const { evaluateOutcome } = require('./scripts/evaluate-outcome.js');
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

// ---------- Predicate DSL ----------

function parsePredicate(body) {
  const trimmed = String(body).trim();
  let m;

  if ((m = trimmed.match(/^not\s+contains\(\s*"((?:[^"\\]|\\.)*)"\s*\)$/s))) {
    return { kind: 'not_contains', needle: m[1].replace(/\\"/g, '"') };
  }
  if ((m = trimmed.match(/^contains\(\s*"((?:[^"\\]|\\.)*)"\s*\)$/s))) {
    return { kind: 'contains', needle: m[1].replace(/\\"/g, '"') };
  }
  if ((m = trimmed.match(/^len\(output_text\)\s*(<=|>=|==|!=|<|>)\s*(\d+)$/))) {
    return { kind: 'len', op: m[1], n: parseInt(m[2], 10) };
  }

  throw new Error(`unknown predicate: ${body}`);
}

function evalPredicate(pred, outputText) {
  if (pred.kind === 'contains') return outputText.includes(pred.needle);
  if (pred.kind === 'not_contains') return !outputText.includes(pred.needle);
  if (pred.kind === 'len') {
    const L = outputText.length;
    switch (pred.op) {
      case '<': return L < pred.n;
      case '>': return L > pred.n;
      case '<=': return L <= pred.n;
      case '>=': return L >= pred.n;
      case '==': return L === pred.n;
      case '!=': return L !== pred.n;
      default: return false;
    }
  }
  return false;
}

// ---------- Per-criterion evaluator ----------

function splitShellArgs(s) {
  // minimal split: groups of non-space or double-quoted strings, quotes stripped.
  const tokens = s.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return tokens.map((t) => t.replace(/(?:^"|"$)/g, ''));
}

function evaluateCriterion(criterion, outputText, { judgeCmd, verbose } = {}) {
  const method = criterion.verification_method;

  if (method === 'manual') return 'skipped';

  if (method === 'rule') {
    const rule = criterion.rule || {};
    if (rule.type === 'regex') {
      try {
        const re = new RegExp(rule.body, 's');
        return re.test(outputText) ? 'pass' : 'fail';
      } catch (e) {
        if (verbose) {
          process.stderr.write(`  [${criterion.id}] rule regex invalid: ${e.message}\n`);
        }
        return 'skipped';
      }
    }
    if (rule.type === 'predicate') {
      try {
        const pred = parsePredicate(rule.body);
        return evalPredicate(pred, outputText) ? 'pass' : 'fail';
      } catch (e) {
        if (verbose) {
          process.stderr.write(`  [${criterion.id}] predicate parse failed: ${e.message}\n`);
        }
        return 'skipped';
      }
    }
    if (verbose) {
      process.stderr.write(`  [${criterion.id}] unknown rule.type: ${rule.type}\n`);
    }
    return 'skipped';
  }

  if (method === 'llm_judge') {
    if (!judgeCmd) return 'skipped';
    const prompt = String(criterion.judge_prompt || '');
    const stdin =
      `${prompt}\n\n---\nOutput to evaluate:\n\n${outputText}\n\n---\n` +
      `Reply with exactly one word on the first line: pass or fail. No other text.\n`;
    try {
      const parts = splitShellArgs(judgeCmd);
      if (parts.length === 0) throw new Error('empty judge-cmd');
      const result = spawnSync(parts[0], parts.slice(1), {
        input: stdin,
        encoding: 'utf8',
        timeout: 120000,
      });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        if (verbose) {
          process.stderr.write(
            `  [${criterion.id}] judge cmd exited ${result.status}: ${String(result.stderr).slice(0, 200)}\n`
          );
        }
        return 'skipped';
      }
      const firstLine = String(result.stdout || '').trim().split('\n')[0].toLowerCase();
      if (/\bpass\b/.test(firstLine) && !/\bfail\b/.test(firstLine)) return 'pass';
      if (/\bfail\b/.test(firstLine) && !/\bpass\b/.test(firstLine)) return 'fail';
      if (verbose) {
        process.stderr.write(
          `  [${criterion.id}] judge cmd returned ambiguous first line: "${firstLine.slice(0, 120)}"\n`
        );
      }
      return 'skipped';
    } catch (e) {
      if (verbose) {
        process.stderr.write(`  [${criterion.id}] judge cmd threw: ${e.message}\n`);
      }
      return 'skipped';
    }
  }

  if (verbose) {
    process.stderr.write(`  [${criterion.id}] unknown verification_method: ${method}\n`);
  }
  return 'skipped';
}

// ---------- Score ----------

function computeScore(results) {
  let passed = 0;
  let failed = 0;
  for (const v of Object.values(results)) {
    if (v === 'pass') passed++;
    else if (v === 'fail') failed++;
  }
  if (passed + failed === 0) return null;
  return Math.round((passed / (passed + failed)) * 10);
}

// ---------- Top-level evaluator ----------

function evaluateOutcome(record, { judgeCmd, verbose } = {}) {
  if (!record || typeof record !== 'object') {
    throw new Error('evaluateOutcome: record must be an object');
  }
  if (!Array.isArray(record.success_criteria)) {
    throw new Error('evaluateOutcome: record.success_criteria must be an array');
  }
  if (typeof record.output_text !== 'string') {
    throw new Error('evaluateOutcome: record.output_text must be a string');
  }

  const results = {};
  for (const c of record.success_criteria) {
    if (!c || typeof c.id !== 'string') {
      throw new Error('evaluateOutcome: each criterion must have a string id');
    }
    results[c.id] = evaluateCriterion(c, record.output_text, { judgeCmd, verbose });
  }
  return { ...record, verification_results: results, score: computeScore(results) };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--record') args.record = argv[++i];
    else if (a === '--stdout') args.stdout = true;
    else if (a === '--judge-cmd') args.judgeCmd = argv[++i];
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--self-test') args.selfTest = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else {
      process.stderr.write(`evaluate-outcome: unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    'Usage: evaluate-outcome.js --record <path> [--stdout] [--judge-cmd "<cmd>"] [--verbose]\n' +
      '       evaluate-outcome.js --self-test\n' +
      'See the top-of-file comment for full documentation.\n'
  );
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }
  if (args.selfTest) { runSelfTest(); return; }

  if (!args.record) {
    process.stderr.write('evaluate-outcome: --record <path> is required (or use --self-test)\n');
    process.exit(2);
  }

  const recordPath = path.resolve(args.record);
  let record;
  try {
    record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`evaluate-outcome: cannot read ${recordPath}: ${e.message}\n`);
    process.exit(1);
  }

  const updated = evaluateOutcome(record, { judgeCmd: args.judgeCmd, verbose: args.verbose });
  const out = JSON.stringify(updated, null, 2) + '\n';

  if (args.stdout) {
    process.stdout.write(out);
  } else {
    fs.writeFileSync(recordPath, out);
    const scoreStr = updated.score === null ? 'null (all skipped)' : `${updated.score}/10`;
    process.stdout.write(
      `evaluate-outcome: wrote ${path.relative(process.cwd(), recordPath)} (score: ${scoreStr})\n`
    );
  }
}

// ---------- Self-test ----------

function runSelfTest() {
  // 1. parsePredicate + evalPredicate
  assert.deepStrictEqual(parsePredicate('len(output_text) < 100'), { kind: 'len', op: '<', n: 100 });
  assert.deepStrictEqual(parsePredicate('contains("hello")'), { kind: 'contains', needle: 'hello' });
  assert.deepStrictEqual(parsePredicate('not contains("error")'), { kind: 'not_contains', needle: 'error' });
  assert.throws(() => parsePredicate('bogus()'));

  assert.strictEqual(evalPredicate({ kind: 'len', op: '<', n: 10 }, 'hello'), true);
  assert.strictEqual(evalPredicate({ kind: 'len', op: '<', n: 10 }, 'hello world!'), false);
  assert.strictEqual(evalPredicate({ kind: 'contains', needle: 'ell' }, 'hello'), true);
  assert.strictEqual(evalPredicate({ kind: 'not_contains', needle: 'xyz' }, 'hello'), true);

  // 2. evaluateCriterion — regex
  assert.strictEqual(
    evaluateCriterion(
      { id: 'r', verification_method: 'rule', rule: { type: 'regex', body: 'hel+o' } },
      'hello world'
    ),
    'pass'
  );
  assert.strictEqual(
    evaluateCriterion(
      { id: 'r', verification_method: 'rule', rule: { type: 'regex', body: '^bye' } },
      'hello world'
    ),
    'fail'
  );
  assert.strictEqual(
    evaluateCriterion(
      { id: 'r', verification_method: 'rule', rule: { type: 'regex', body: '(unclosed' } },
      'anything'
    ),
    'skipped'
  );

  // 3. evaluateCriterion — predicate
  assert.strictEqual(
    evaluateCriterion(
      { id: 'p', verification_method: 'rule', rule: { type: 'predicate', body: 'contains("ok")' } },
      'all ok here'
    ),
    'pass'
  );
  assert.strictEqual(
    evaluateCriterion(
      { id: 'p', verification_method: 'rule', rule: { type: 'predicate', body: 'len(output_text) > 1000' } },
      'short'
    ),
    'fail'
  );

  // 4. manual + llm_judge (without cmd) → skipped
  assert.strictEqual(
    evaluateCriterion({ id: 'm', verification_method: 'manual' }, 'x'),
    'skipped'
  );
  assert.strictEqual(
    evaluateCriterion(
      { id: 'j', verification_method: 'llm_judge', judge_prompt: 'check' },
      'x'
    ),
    'skipped'
  );

  // 5. llm_judge with a deterministic judge-cmd (`cat` echoes stdin, and
  //    we prepend "pass" to the stdin so the first line of stdout is "pass").
  //    On macOS/Linux `cat` is always present.
  const passResult = evaluateCriterion(
    { id: 'j', verification_method: 'llm_judge', judge_prompt: 'check' },
    '__prelude__',
    { judgeCmd: 'sh -c "echo pass; cat"' }
  );
  assert.strictEqual(passResult, 'pass');

  const failResult = evaluateCriterion(
    { id: 'j', verification_method: 'llm_judge', judge_prompt: 'check' },
    '__prelude__',
    { judgeCmd: 'sh -c "echo fail; cat"' }
  );
  assert.strictEqual(failResult, 'fail');

  // 6. computeScore
  assert.strictEqual(computeScore({ a: 'pass', b: 'pass', c: 'fail' }), 7);
  assert.strictEqual(computeScore({ a: 'pass', b: 'pass', c: 'pass', d: 'skipped' }), 10);
  assert.strictEqual(computeScore({ a: 'skipped', b: 'skipped' }), null);
  assert.strictEqual(computeScore({}), null);

  // 7. end-to-end evaluateOutcome
  const record = {
    schema_version: 1,
    timestamp: '2026-04-17T00:00:00Z',
    prompt_fingerprint: 'sha256:abc',
    prompt_text: 'whatever',
    task_type: 'fix_bug',
    mode: 'single',
    success_criteria: [
      { id: 'has_fix', verification_method: 'rule', rule: { type: 'regex', body: 'return.*400' } },
      { id: 'small_diff', verification_method: 'rule', rule: { type: 'predicate', body: 'len(output_text) < 500' } },
      { id: 'human_check', verification_method: 'manual' },
    ],
    output_text: 'if (empty) { return NextResponse.json(x, { status: 400 }); }',
    verification_results: {},
    score: null,
    notes: '',
  };
  const after = evaluateOutcome(record);
  assert.deepStrictEqual(after.verification_results, {
    has_fix: 'pass',
    small_diff: 'pass',
    human_check: 'skipped',
  });
  assert.strictEqual(after.score, 10);

  process.stdout.write('evaluate-outcome self-test: ok\n');
}

if (require.main === module) {
  runCli();
}

module.exports = {
  evaluateOutcome,
  evaluateCriterion,
  parsePredicate,
  evalPredicate,
  computeScore,
};
