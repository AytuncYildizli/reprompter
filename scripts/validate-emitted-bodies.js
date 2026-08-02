#!/usr/bin/env node
/**
 * Invariants for every emission path in the Build intent - One-Shot and the design
 * loop.
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
const DESIGN_FILE = path.join(__dirname, '..', 'references', 'design-loop-template.md');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');
const designLines = fs.readFileSync(DESIGN_FILE, 'utf8').split('\n');

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
function bodyAfter(headingPrefix, src = lines) {
  const start = src.findIndex((l) => l.startsWith(headingPrefix));
  if (start === -1) throw new Error(`heading not found: ${headingPrefix}`);
  const out = [];
  let seen = false;
  for (let i = start + 1; i < src.length; i++) {
    const l = src[i];
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
// Maximal mode takes exactly ONE stopping clause. Banning a single phrase is not
// enough: any second "stop when …" wording reintroduces the two-clause failure, so
// count every stopping construction rather than blacklisting one.
const STOP_CLAUSE = /it is done when|(?:do not|don't|dont) stop until|keep going until|stop once|you are finished when|finished when|until it (?:is|'s) perfect/gi;
const stops = MAXIMAL_BODY.match(STOP_CLAUSE) || [];
if (stops.length !== 1) {
  failures.push(
    `maximal body: found ${stops.length} stopping clause(s) [${stops.join(' | ')}] — maximal takes exactly one, the reference`
  );
}
if (!/genuinely wowed/.test(MAXIMAL_BODY)) {
  failures.push('maximal body: missing — the reference stopping clause');
} else if (stops.length === 1 && !/(?:do not|don't|dont) stop until/i.test(stops[0])) {
  failures.push(`maximal body: its one stopping clause is not the reference clause (found "${stops[0]}")`);
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
  ['unreproducible criteria are recorded unverified', /recorded unverified/i],
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

// ── the design loop's single emitted body ──────────────────────────────────
// Three reviewers found the same class of defect here that six rounds found in the
// One-Shot bodies: a rule the template calls hard, living in prose the pasted text
// never carries. Each entry below was one of those findings.
/** The design loop has one body and the blockquote starts on the anchor line itself. */
function blockquoteFrom(src, anchor) {
  const start = src.findIndex((l) => l.startsWith(anchor));
  if (start === -1) throw new Error(`design-loop body not found: ${anchor}`);
  const out = [];
  for (let i = start; i < src.length && src[i].startsWith('>'); i++) {
    out.push(src[i].slice(1).trim());
  }
  if (!out.length) throw new Error('design-loop body is empty');
  return out.join(' ');
}

const DESIGN_BODY = blockquoteFrom(designLines, '> Redesign **[what]**');
const DESIGN = [
  ['found copy is checked against the code before porting a claim', /check it against what the code actually does/i],
  ['the scan stays inside this repository', /this repository/i],
  ['adjectives are refused as a source of direction', /never from words like premium/i],
  ['a different helper does the critique', /a different helper/i],
  ['the no-browser case stops instead of inventing screenshots', /do not describe screenshots you did not take/i],
  ['fallback fonts are caught by computed value', /computed font family/i],
  ['contrast is computed, with a number', /4\.5:1/],
  ['the craft floor reaches the run', /concentric/i],
  ['the quality floor reaches the run', /390px/i],
  ['states are walked only where the page has them', /only where the page has them/i],
  ['scripted checks are calibrated against known-good and known-bad', /you know is good and something you know is bad/i],
  ['measured items carry their conditions', /emulated pixel ratio/i],
  ['a measurement without a budget is not a check', /budget you are measuring against/i],
  ['unreproducible conditions are recorded unverified', /record the item unverified/i],
  ['the round cap never ends the run with an open item', /never ends the run with an item still open/i],
  ['what already worked has to keep working', /keep working/i],
  ['the load-bearing negative survives', /\[hard negative\]/],
  ['the done-list is actually stated', /\[done-list/],
];
check('design-loop body', DESIGN_BODY, DESIGN);

if (failures.length) {
  console.error('Emitted-body invariants FAILED:\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${failures.length} failure(s). A rule that is not in the emitted body does not reach the run.`);
  process.exit(1);
}

console.log(
  `Emitted-body invariants OK — One-Shot: ${SHARED.length} shared rules in both bodies, mode contracts intact, worked ` +
    `example compliant, team mapping carries the same rules, no-helper fallback covers every helper reference. ` +
    `Design loop: ${DESIGN.length} rules present in the pasted text.`
);
