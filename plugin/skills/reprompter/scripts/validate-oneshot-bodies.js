#!/usr/bin/env node
/**
 * Invariants for every One-Shot emission path.
 *
 * The One-Shot template has three emission paths (default body, maximal body,
 * team mapping) and every rule has to reach all of them. Six review rounds on
 * v13.1.0 found the same class of defect five times: a rule added to the default
 * body while the maximal body silently kept the old behaviour. validate:templates
 * skips this file (it is prose by design), so nothing caught it.
 *
 * This asserts that what the lane calls a hard rule is present in the text a user
 * actually pastes: both emitted bodies, the worked example, the team mapping, and
 * the no-helper fallback (which has to name every helper reference it replaces).
 *
 * Calibrated against known-bad copies before being trusted, per the rule it enforces.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'references', 'oneshot-template.md');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');

/** Collect the prose of a `## ` section, up to the next `## `. */
function section(heading) {
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start === -1) throw new Error(`section not found: ${heading}`);
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    out.push(lines[i]);
  }
  return out.join(' ');
}

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

// The team mapping is the third emission path: it hands the brief to Repromptverse
// instead of emitting a one-prompt body, so the same rules have to survive the handoff.
const TEAM = section('## Split across a team');
check('team mapping', TEAM, [
  ['measured criteria keep their conditions', /conditions/i],
  ['the evaluator calibrates what it scripts', /calibrat/i],
  ['the evaluator runs the artifact rather than reading a report', /run the built|not read a summary|live inspection/i],
  ['what integration changes is re-checked', /re-check/i],
]);

// A helper reference the no-helper fallback does not mention is a reference that
// silently survives onto a runtime with no helpers.
const FALLBACK = section('## Helper wording');
const HELPER_PHRASES = [
  ['one helper per area', /one helper per area/],
  ['a separate helper checks each piece', /separate helper/],
  ['the checking helper', /the checking helper/],
  ['the helper doing the checking', /the helper doing the checking/],
];
for (const [name, re] of HELPER_PHRASES) {
  const inBodies = re.test(DEFAULT_BODY) || re.test(MAXIMAL_BODY);
  if (inBodies && !re.test(FALLBACK)) {
    failures.push(`no-helper fallback: does not say what replaces — "${name}"`);
  }
}

if (failures.length) {
  console.error('One-Shot emitted-body invariants FAILED:\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${failures.length} failure(s). A rule that is not in the emitted body does not reach the run.`);
  process.exit(1);
}

console.log(
  `One-Shot emitted-body invariants OK — ${SHARED.length} shared rules present in both bodies, mode contracts intact, ` +
    `worked example compliant, team mapping carries the same rules, no-helper fallback covers every helper reference.`
);
