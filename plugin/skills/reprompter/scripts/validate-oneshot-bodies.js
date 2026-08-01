#!/usr/bin/env node
/**
 * Invariants for the two emitted One-Shot prompt bodies.
 *
 * The One-Shot template has three emission paths (default body, maximal body,
 * team mapping) and every rule has to reach all of them. Six review rounds on
 * v13.1.0 found the same class of defect five times: a rule added to the default
 * body while the maximal body silently kept the old behaviour. validate:templates
 * skips this file (it is prose by design), so nothing caught it.
 *
 * This asserts that what the lane calls a hard rule is present in the text a user
 * actually pastes, in every body that carries it.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'references', 'oneshot-template.md');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');

/** Collect the contiguous blockquote that follows a heading. */
function bodyAfter(headingPrefix) {
  const start = lines.findIndex((l) => l.startsWith(headingPrefix));
  if (start === -1) throw new Error(`heading not found: ${headingPrefix}`);
  const out = [];
  let seen = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('>')) {
      out.push(l.slice(1).trim());
      seen = true;
    } else if (seen && l.trim() !== '' && !l.startsWith('>')) {
      break;
    }
  }
  if (!out.length) throw new Error(`no blockquote body under: ${headingPrefix}`);
  return out.join(' ');
}

const DEFAULT_BODY = bodyAfter('## The prompt (default mode)');
const MAXIMAL_BODY = bodyAfter('## The prompt (maximal mode');
const WORKED = bodyAfter('**Raw input:**');

// Rules that must reach every emitted body, with the review round that added them.
const SHARED = [
  ['measurement conditions are named', /conditions/i],
  ['conditions must match the real target', /actually run|target's real configuration/i],
  ['unreproducible conditions are recorded unverified', /unverified/i],
  ['scripted checks are calibrated', /calibrat/i],
  ['the checker, not the builder, owns the checks', /never the builder|not the builder/i],
  ['a disagreeing check is suspected in both directions', /passing something (that is )?wrong|failing something (that is )?right/i],
  ['the load-bearing negative survives', /\[hard negative\]/],
];

const failures = [];
const check = (label, body, rules) => {
  for (const [name, re] of rules) {
    if (!re.test(body)) failures.push(`${label}: missing — ${name}`);
  }
};

check('default body', DEFAULT_BODY, SHARED);
check('maximal body', MAXIMAL_BODY, SHARED);

// Mode-specific contracts.
if (!/It is done when/.test(DEFAULT_BODY)) {
  failures.push('default body: missing — the done-list termination clause');
}
if (/It is done when/.test(MAXIMAL_BODY)) {
  failures.push('maximal body: has a second termination clause ("It is done when") — maximal takes exactly one, the reference');
}
if (!/genuinely wowed/.test(MAXIMAL_BODY)) {
  failures.push('maximal body: missing — the reference stopping clause');
}
if (!/re-confirm/i.test(DEFAULT_BODY)) {
  failures.push('default body: missing — re-confirmation after the smoothing pass');
}

// The worked example is the shape users copy; it must not quietly drop the rules.
check('worked example', WORKED, [
  ['named measurement conditions', /pixel ratio/i],
  ['calibration', /calibrat/i],
  ['checker judges against the checklist, not the reference', /against the checklist/i],
]);

if (failures.length) {
  console.error('One-Shot emitted-body invariants FAILED:\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${failures.length} failure(s). A rule that is not in the emitted body does not reach the run.`);
  process.exit(1);
}

console.log(
  `One-Shot emitted-body invariants OK — ${SHARED.length} shared rules present in both bodies, mode contracts intact, worked example compliant.`
);
