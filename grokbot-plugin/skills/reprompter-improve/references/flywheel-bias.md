# Flywheel bias injection and fleet sync

> Verbatim from root SKILL.md lines 384-415 (Intent: Improve → Process step 5). `scripts/outcome-record.js` is bundled as `../../reprompter/scripts/outcome-record.js`; `npm run flywheel:*` needs the full RePrompter repo checkout.

#### Flywheel bias injection (v3 read-path)

Default: off. Enable explicitly with `REPROMPTER_FLYWHEEL_BIAS=1` so runs with and without bias can be compared apples-to-apples until it earns the default.

When the flag is set, between the interview and the template pick:

1. Run `npm run flywheel:query -- --task-type <slug>` where `<slug>` is the task type identified from the interview (e.g. `fix_bug`, `write_code`).
2. Read the command's stdout. It's either `null` (cold start / low N) or a single JSON object with `recipe`, `confidence`, `sampleCount`.
3. **Only bias on `confidence ∈ {"medium", "high"}` AND `sampleCount >= 3`.** Low-confidence recommendations add noise without signal; treat them as cold start.
4. When biasing:
   - Prefer `recipe.vector.templateId` over the default intent-routed template.
   - Adopt `recipe.vector.patterns` alongside anything you would have picked from `references/patterns/`.
   - Match `recipe.vector.capabilityTier` in your reasoning about downstream execution.
5. Announce the decision in one line before the generate step so the user sees what happened:
   > Flywheel: preferring `<template>` + `[patterns]` based on N past runs (score X/10, <confidence> confidence)
   Or, if no bias applied:
   > Flywheel: no bias (cold start / low confidence)
6. The bias changes **which template/patterns you start from.** The rest of the pipeline (interview content, generated prompt's XML structure, criteria emission) is unchanged. The flywheel never rewrites Claude's output.
7. **Attribution (v3 part 3).** When bias is applied, remember the chosen recipe's `hash`, `confidence`, and `sampleCount` until the outcome is recorded for this run. Then stamp them onto the record via `scripts/outcome-record.js --applied-recommendation '{"recipe_hash":"<hash>","confidence":"<low|medium|high>","sample_count":<N>,"applied_at":"prompt_gen"}'`. Use `applied_at="phase_2"` for Repromptverse team-wide bias. **If no bias was applied (flag off, query returned null, or low confidence) OMIT the flag entirely** — the *absence* of `applied_recommendation` on a record is what marks it as the bias-off control group for `npm run flywheel:ab` analysis. Never stamp a zero/placeholder block; absence is the signal.

#### Fleet sync (v12.14 privacy boundary)

Fleet sync shares only sanitized aggregate ledger rows from `.reprompter/flywheel/outcomes.ndjson`. It never reads `.reprompter/outcomes/`, and a pack contains no prompt text, no raw prompt hashes, no raw task slugs, no raw role/domain labels outside the coarse allowlist, and no hostnames.

```bash
npm run flywheel:export -- --origin o-laptop
npm run flywheel:import -- .reprompter/flywheel/packs/o-laptop-20260703.ndjson
```

Exported rows deterministically hash `runId`/`taskId`, coarsen non-allowlisted `recipe.vector.domain` labels, and recompute the recipe fingerprint from the sanitized vector. Identical sanitized recipes from different machines still group together in `flywheel:query`/`flywheel:report`, but raw prompt fingerprints and local task labels do not leave the machine.

Transport is user-owned: put packs in a shared directory, rsync them, or move them through your own git/Tailscale/mesh workflow. RePrompter itself does not network for fleet sync. The default flywheel cap remains 500 rows; active fleets can opt into a larger local ledger with `REPROMPTER_FLYWHEEL_MAX_OUTCOMES=5000`.
