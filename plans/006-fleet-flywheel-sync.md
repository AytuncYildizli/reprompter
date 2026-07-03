# Plan 006: Fleet-shared flywheel — privacy-safe export/import of outcome ledgers across machines (v12.14.0)

> **Executor instructions**: Follow step by step; run every verification. On any
> STOP condition, stop and report. No `git` commands. No `plans/README.md` edits.
>
> **Drift check (run first)**: `scripts/outcome-collector.js` exports `createOutcomeStore`;
> `.reprompter/flywheel/outcomes.ndjson` is its default path (check `scripts/outcome-collector.js:9-17`). Otherwise STOP.

## Status

- **Priority**: P1 | **Effort**: M | **Risk**: MED (privacy boundary — sanitization is the product)
- **Depends on**: none (baseline v12.13.0)
- **Category**: direction
- **Planned at**: 2026-07-03, grounded in read-only recon of the flywheel pipeline (facts below are verified file:line)

## Why this matters

Each machine's flywheel learns alone from `.reprompter/flywheel/outcomes.ndjson`. The strategy learner needs `sampleCount >= 3` per recipe group before recommending — a threshold single machines rarely hit quickly. A fleet of agents exporting **sanitized ledger packs** and importing each other's multiplies samples: N agents × M sessions. The recon confirmed ledger rows are already mostly privacy-safe aggregates and the learner has no machine-local assumptions — but three fields leak and must be sanitized deterministically so cross-machine recipe grouping still merges.

## Verified facts (authoritative)

- Ledger: `.reprompter/flywheel/outcomes.ndjson`, append via `createOutcomeStore().writeOutcome()` (validates, appends, trims to `REPROMPTER_FLYWHEEL_MAX_OUTCOMES` default **500** — `scripts/outcome-collector.js:22-52`).
- Ingest dedupe key: `` `${runId}|${timestamp}` `` (`scripts/outcome-collector.js:403-449`); idempotent re-ingest is test-proven.
- Row fields SHAREABLE as-is: `timestamp`, `recipe.vector.{templateId,patterns,capabilityTier,contextLayers,qualityBucket}`, `recipe.hash`, all numeric `signals.*`, `effectivenessScore`, `applied_recommendation`.
- Row fields that LEAK and must be sanitized: `runId` (often = `prompt_fingerprint`, a sha256 of full prompt text — supports guess-confirmation attacks), `taskId` (raw-task slug), `recipe.vector.domain` + `recipe.readable` (role labels can be user-specific).
- `scripts/recipe-fingerprint.js` exports the fingerprint function; `hash = sha256(JSON.stringify(vector)).slice(0,16)`; deterministic — recomputing after a deterministic domain transform preserves cross-machine grouping.
- Learner reads only the ledger via `createOutcomeStore()`; grouping by `recipe.hash`, time-decay by `timestamp`; no hostname/env reads (`scripts/strategy-learner.js:67-83, 250-254`).
- v1 records in `.reprompter/outcomes/*.json` contain FULL `prompt_text`/`output_text` — **never export these**; fleet sync operates on the ledger only.

## Scope

**In scope**: `scripts/flywheel-sync.js` (create), `scripts/flywheel-sync.test.js` (create), `package.json` (scripts `flywheel:export` / `flywheel:import` + check chain + version), `package-lock.json`, SKILL.md (flywheel section subsection), README.md, CHANGELOG.md, `plugin/**` + `skills/reprompter/**` via generators.
**Out of scope**: outcome-collector.js / strategy-learner.js / recipe-fingerprint.js behavior (require them, don't change them); v1 records export; any network transport (sync recipe is docs: shared dir / rsync / git over the user's own mesh); changing the 500-row default cap.

## Git workflow

None. Reviewer handles git.

## Steps

### Step 1: `scripts/flywheel-sync.js`

Design rules header (match repo style): LEDGER-ONLY (never reads `.reprompter/outcomes/`), DETERMINISTIC sanitization (same input → same output on every machine, so recipe groups merge), PRIVACY (no raw prompt hashes, task slugs, role labels, hostnames in packs), FAIL-SOFT CLI.

Exports:
1. `sanitizeRow(row, {originLabel})` →
   - `runId` → `"fw-" + sha256(String(row.runId)).slice(0,12)`; `taskId` → `"ft-" + sha256(String(row.taskId)).slice(0,12)`.
   - `recipe.vector.domain`: if in the coarse allowlist `["frontend","backend","fullstack","security","testing","docs","research","ops","content","data","mobile","infra",""]` keep; else `"d-" + sha256(domain).slice(0,8)`.
   - RECOMPUTE the recipe fingerprint from the sanitized vector via `require("./recipe-fingerprint")` (hash + readable stay internally consistent; deterministic transform ⇒ identical rows group identically fleet-wide).
   - Keep: timestamp, signals (numeric only — drop any non-numeric unknown signal keys defensively), effectivenessScore, applied_recommendation, schema passthroughs the store validation needs. Drop everything else unknown.
   - Attach `origin: originLabel` (from `--origin <label>`, default `"o-" + sha256(os.hostname()).slice(0,8)`).
2. `exportPack({rootDir, out, originLabel})` → writes NDJSON pack: first line header `{"pack":"reprompter.flywheel_pack.v1","exported_at":ISO,"origin":label,"rows":N}`, then sanitized rows. Default out: `.reprompter/flywheel/packs/<origin>-<yyyymmdd>.ndjson`.
3. `importPacks({rootDir, from})` → `from` = file or dir (all `*.ndjson`); validate header line (`pack === "reprompter.flywheel_pack.v1"`, else skip file with warning); per row: dedupe on `` `${runId}|${timestamp}` `` against the existing ledger AND rows imported this invocation; append survivors via `createOutcomeStore(...).writeOutcome()`. Return `{imported, duplicates, skipped, files}`. Respect the store's existing cap trimming; print a NOTE when the ledger is at/over cap (recommend `REPROMPTER_FLYWHEEL_MAX_OUTCOMES=5000` for fleet use — docs, not code default change).
4. CLI: `--export [--out F] [--origin L]` / `--import <file-or-dir>` / `--json`. Malformed rows are counted-skipped, never fatal.

**Verify**: seed a temp ledger (2 rows with a nasty domain like `"berry-agent"` and a raw-slug taskId), export, then: `grep -c "berry-agent\|<raw-taskid>" <pack>` → 0; import into a second temp rootDir twice → second run `imported=0, duplicates=2`.

### Step 2: Tests (`scripts/flywheel-sync.test.js`, npm `test:flywheel-sync`, wired into `check` after `test:flywheel-e2e`)

Cover: sanitization strips/hashes all three leak fields and is deterministic across two calls; allowlisted domain passes through; recomputed recipe.hash equals `createRecipeFingerprint(sanitizedVector).hash` and two machines' identical original rows produce identical sanitized rows; header validation rejects non-pack files; import dedupe vs existing ledger AND intra-batch; round-trip: after import, `strategy-learner`'s query path (require it, call its exported recommendation/report function per its test file's usage) sees the imported rows grouped with local rows of the same recipe; privacy: pack file contains no `prompt_fingerprint`-shaped original runId (`sha256:`-prefixed) and no `os.hostname()` raw value.

**Verify**: `npm run test:flywheel-sync` → exit 0.

### Step 3: Docs + version + regeneration

SKILL.md flywheel section: "Fleet sync" subsection — export/import commands, what is and is NOT in a pack (explicitly: no prompt text, no prompt hashes, no task slugs, no role labels, no hostnames), the deterministic-grouping property, the cap note, and a sync recipe paragraph (shared directory over the user's own network/rsync/git — RePrompter itself never networks). README: Key Features paragraph + Privacy section one-line addition (packs are sanitized aggregates). CHANGELOG v12.14.0; version bump everywhere (package.json, lock ×2, SKILL frontmatter/title/blurb, README badge + test table real counts); `npm run package:plugin && npm run package:hermes`; `npm run check`.

**Verify**: `cmp SKILL.md plugin/skills/reprompter/SKILL.md` → identical; `npm run check` suites green (artifact guards excepted pre-commit).

## Done criteria

- [ ] Pack export from a seeded ledger contains zero raw runIds/taskIds/non-allowlisted domains/hostnames (grep-verified).
- [ ] Import is idempotent (dedupe both vs ledger and intra-batch) and learner groups imported+local rows of the same recipe together.
- [ ] Sanitization is deterministic (fleet-wide grouping preserved; test-asserted).
- [ ] `npm run check` exit 0; versions consistent at 12.14.0.

## STOP conditions

- `writeOutcome()` validation rejects sanitized rows for a structural reason you cannot fix inside flywheel-sync.js (do NOT loosen collector validation).
- Recomputing the fingerprint requires changing recipe-fingerprint.js.
- Any untouched suite fails.

## Maintenance notes

- Transport stays user-owned (Tailscale shared dir/rsync/git). If a hosted exchange ever happens, it must be explicit opt-in — the Privacy section is a public promise.
- Origin labels enable per-agent effectiveness comparison later (strategy-learner `--ab`-style); not wired in v1.
- The 500-row cap interacts with fleet volume; revisit the default only with data.
