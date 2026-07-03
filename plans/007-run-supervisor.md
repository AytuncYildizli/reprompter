# Plan 007: Mid-run supervisor — advisory health verdicts + delta guidance during live Repromptverse runs (v12.15.0)

> **Executor instructions**: Follow step by step; run every verification. On any
> STOP condition, stop and report. No `git` commands. No `plans/README.md` edits.
>
> **Drift check (run first)**: `scripts/telemetry-store.js` exports `createTelemetryStore`
> defaulting to `.reprompter/telemetry/events.ndjson`; `scripts/run-observability-report.js` exists. Otherwise STOP.

## Status

- **Priority**: P2 | **Effort**: M | **Risk**: LOW (read-only analyzer + docs wiring; advisory, never actuates)
- **Depends on**: plans/006 merged first (sequential rounds, shared version/docs files)
- **Category**: direction
- **Planned at**: 2026-07-03, grounded in read-only recon (facts below verified file:line)

## Why this matters

Today a degrading Repromptverse run is only handled AFTER Phase 3 finishes (Phase 4 evaluate → retry, max 2). Run telemetry already streams to `.reprompter/telemetry/events.ndjson` during execution, and SKILL.md's Phase 3 polling loops are a natural seam to consult a health verdict *between polls* — turning after-the-fact retry into mid-flight awareness (spot the stalled agent at poll 3, not after the timeout). v1 is a stateless analyzer + SKILL.md wiring: it advises the orchestrating model; it never kills, restarts, or messages anything.

## Verified facts (authoritative)

- Run telemetry store: `.reprompter/telemetry/events.ndjson` under rootDir (`scripts/telemetry-store.js:8-16`). Event fields: `timestamp`, `runId`, `taskId`, `stage`, `status ∈ ok|error|stalled|timeout|skipped`, optional `latencyMs`/`attempt`/`pass`/`reason`/`metadata`.
- Stages ACTUALLY emitted by `repromptverse-runtime.js`: build-plan (`route_intent`,`learn_strategy`,`select_patterns`,`resolve_model`,`build_context`,`fingerprint_recipe`,`plan_ready`) then execute (`spawn_agent`,`poll_artifacts`,`evaluate_artifact` ok/error/skipped, `finalize_run`, `collect_outcome`) — `scripts/repromptverse-runtime.js:178-557`.
- **`retry_artifact` is in the schema but NOTHING emits it today** (`scripts/telemetry-schema.js:12-14` vs runtime). Heuristics must not depend on it; handle it if present, and Step 1 adds the missing emission at the one place retries are visible (see Step 1.4).
- Run ids: `rpt-<ms>-<rand8>`; task ids: 32-char slug + base36 time (`scripts/repromptverse-runtime.js:55-64`). Gate events (`gate_*`, runId `gate-*`) live in the CACHE store, not this one — but defensively exclude `gate_` stages anyway.
- Reusable aggregations exist in `scripts/run-observability-report.js:31-103`: per-run grouping, stalled/timeout counts, retry counts, per-stage latency, finalized/success.
- SKILL.md polling seams (quote-verified): Status Line per poll cycle (`SKILL.md:711-724`), Option A bounded TaskList polling + 15-30s monitor cadence (`SKILL.md:882-897`), Option B TeamCreate poll (`SKILL.md:977-979`), Option D artifact-presence status + stall handling (`SKILL.md:1097-1126`). Option H has NO mid-run seam (no cross-agent messaging; returns are the source of truth — `SKILL.md:1143-1153`): supervisor applies only AFTER the workflow returns there.

## Scope

**In scope**: `scripts/run-supervisor.js` (create), `scripts/run-supervisor.test.js` (create), `scripts/repromptverse-runtime.js` (ONLY the additive `retry_artifact` emission of Step 1.4), `package.json` (+lock, `test:run-supervisor` in chain, version), SKILL.md (polling-seam wiring + Phase 4), README.md, CHANGELOG.md, `plugin/**` + `skills/reprompter/**` via generators.
**Out of scope**: any actuation (kill/restart/send), any change to poll loops' structure or budgets, runtime-adapter files, workflow-command.js, telemetry schema.

## Git workflow

None. Reviewer handles git.

## Steps

### Step 1: `scripts/run-supervisor.js`

Stateless single-shot analyzer. Exports:
1. `analyzeRun(events, {runId, now})` → pick the target run (given runId, else the run with the latest event, excluding runIds starting `gate-`). Compute verdict, first match wins:
   - `stalled` — any event in the run has `status ∈ {stalled, timeout}`, OR the run has `spawn_agent`/`poll_artifacts` but no event in the last `staleMs` (default 120000; option) and no `finalize_run`.
   - `failing-evals` — ≥2 `evaluate_artifact` events with `status:"error"` or `pass === false` (or ≥1 `retry_artifact` event — future-proof), and no successful `finalize_run`.
   - `completed` — `finalize_run` present (report `success` from its pass/status).
   - `healthy` — otherwise (in-flight, recent events).
   - `unknown` — runId not found / no events.
2. Verdict object: `{runId, verdict, evidence: [short strings with stage+status+age], advice: [strings]}`. Advice templates (advisory sentences for the ORCHESTRATOR, aligned with the delta-retry pattern): stalled → name the platform stall step from SKILL (check artifacts `/tmp/rpt-{taskname}-*.md`, inspect the stalled lane, consider re-spawn per that Option's runbook); failing-evals → start drafting the Phase-4 delta prompt NOW quoting the failing criteria; completed/healthy → no action.
3. CLI: `node scripts/run-supervisor.js --advise [--run-id X] [--root DIR] [--stale-ms N] [--json]`. Human output = 3-6 lines; `--json` = the verdict object. Missing/empty events file → `unknown` verdict, exit 0 (fail-soft; NEVER nonzero for analysis outcomes — nonzero only for unusable flags).
4. Additive runtime emission: in `scripts/repromptverse-runtime.js`'s execute path, where an `evaluate_artifact` failure leads to another spawn/poll attempt (locate the actual retry control — recon says retries are orchestrator-level, so IF there is genuinely no in-runtime retry branch, SKIP this sub-step and note it; do NOT invent one). If a natural point exists, emit `stage:"retry_artifact"` with `attempt`. Zero behavior change otherwise.

**Verify**: fabricate a 6-event NDJSON with a `stalled` poll event → CLI `--json` verdict `stalled`; empty dir → `unknown`, exit 0.

### Step 2: Tests (`scripts/run-supervisor.test.js`, wired into `check` after `test:stop-gate`)

Fixture event sequences (inline arrays / temp NDJSON): healthy in-flight; stalled via status; stalled via staleness (injected `now`); failing-evals via two eval errors; completed success and completed failure; unknown runId; gate-event exclusion (a `gate-` run must never be auto-picked); CLI `--json` contract + fail-soft on missing file; if Step 1.4 emitted retry events, one test for retry-based failing-evals.

**Verify**: `npm run test:run-supervisor` → exit 0.

### Step 3: SKILL.md wiring + docs + version

1. SKILL.md: one short block in the Phase 3 polling guidance (near the Status Line contract, `SKILL.md:711-724`) — "each poll cycle MAY consult `node scripts/run-supervisor.js --advise --run-id {runId} --json` and fold its verdict into the Status Line; on `stalled` follow the current Option's stall runbook; on `failing-evals` begin drafting Phase-4 delta prompts early. The supervisor is advisory and read-only." Mirror one sentence in Phase 4 (consult before deciding retries) and one in Option H's section (applies only after the workflow returns). Do NOT alter poll budgets or loop structure.
2. README Key Features paragraph; CHANGELOG v12.15.0; version bump everywhere; regenerate both artifacts; `npm run check`.

**Verify**: `npm run validate:templates && npm run validate:tool-refs` → exit 0; `cmp SKILL.md plugin/skills/reprompter/SKILL.md` → identical; `npm run check` suites green.

## Done criteria

- [ ] All verdict classes covered by tests with fabricated event streams; gate runs excluded from auto-pick.
- [ ] CLI fail-soft (`unknown`, exit 0) on absent telemetry.
- [ ] SKILL.md wiring is advisory-only and leaves poll budgets untouched.
- [ ] `repromptverse-runtime.js` diff is either empty or exactly one additive telemetry emission.
- [ ] `npm run check` exit 0; versions consistent at 12.15.0.

## STOP conditions

- Implementing retry emission would require restructuring the execute path (skip it instead and note).
- Any wiring instruction would change poll budgets/loop structure to fit.
- Any untouched suite fails.

## Maintenance notes

- v2 candidates (explicitly deferred): watch mode (`--watch` daemon), per-agent lane attribution via taskId conventions, wiring verdicts into the flywheel as signals, Option H in-script supervision (blocked by no-mid-run-messaging).
- The staleness default (120s) assumes the 15-30s poll cadence documented in SKILL; if cadence guidance changes, revisit.
