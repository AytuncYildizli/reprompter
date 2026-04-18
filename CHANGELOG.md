# RePrompter Changelog

## v12.1.0 (2026-04-18) — Codex CLI runtime contract + factual corrections

### Headline

Option D (Codex CLI runtime) is now a first-class Phase 3 path with a full runtime contract — not the five-bullet prose stub it had been. Native subagents via the `[agents]` config block (D1) and shell-level parallelism via `codex exec` backgrounding (D2) are both documented with runnable commands, verified against Codex 0.121.0 source. A SKILL.md frontmatter `description` that silently exceeded Codex's 1024-char load limit (skipping the entire skill in Codex CLI) was trimmed to 960 chars without losing any skill-selection trigger.

Docs-only release. No runtime code changes.

### Added — Codex CLI as a documented runtime (PR #43)

- **`references/runtime/codex-runtime.md`** — new reference file covering D1 vs D2 picker logic, prerequisites, invocation, artifact contract, concurrency caps, status-line patterns, retries, and known gotchas (issues #11435, #14866, #15177 — all cross-linked). Parallels the implicit runtime contracts used by Options A/B.
- **SKILL.md Option D expansion.** Replaced the five-bullet stub with a full D1 + D2 treatment:
  - **D1 Native subagents:** `[features] multi_agent = true` + `[agents] max_threads = 6` + `~/.codex/agents/<name>.toml` role definitions + prompt-driven spawn. Includes a working orchestrator example that fans out one `rpt_audit_explorer` per audit dimension and synthesizes the result.
  - **D2 Shell-level `codex exec`:** runnable bash block with `--ephemeral`, `--sandbox workspace-write`, `--output-last-message`, artifact verification, FS-polling status line, hang recovery, FIFO semaphore with failure propagation.
  - Picker table (D1 vs D2 vs "neither, use Option B for cross-agent messaging").
- **SKILL.md Settings section.** Added a Codex CLI subsection documenting `~/.codex/config.toml` with `[features]`, `[agents]`, and skill-defined `[reprompter]` keys. Clarified that Claude Code is optional when Codex is the target runtime.
- **Frontmatter compatibility claim** rewritten from "parallel sessions if available" (hedged) to naming the actual mechanisms (native subagents or shell-level parallelism via `codex exec`).
- **README.md compatibility table** aligned — removed the asterisk on Codex parallel and added a clarifier pointing to Option D plus the new reference file.

### Fixed — factual corrections to the Codex runtime path (PR #44, 8 commits over 7 bot-review rounds)

Every correction verified against openai/codex `rust-v0.121.0` source, `codex exec --help`, and the current status of each cited GitHub issue as of 2026-04-18.

- **`--full-auto` semantics in `codex exec`.** Source check: `codex-rs/exec/src/cli.rs:50–52` defines `--full-auto` as "Convenience alias for low-friction sandboxed automatic execution (--sandbox workspace-write)". `codex-rs/exec/src/lib.rs:263` selects only the sandbox when `full_auto` is true; `lib.rs:374–376` sets approval policy unconditionally to `AskForApproval::Never` for headless mode. In exec mode, `--sandbox workspace-write` and `--full-auto` are functionally equivalent. The docs now recommend `--sandbox workspace-write` for readability and explain that both options work; no bogus warning about approval-policy side effects.
- **`--sandbox read-only` artifact-write bug.** D2 workers write their `/tmp/rpt-{taskname}-{agent}.md` artifacts themselves, which requires `workspace-write`. `read-only` breaks the artifact contract. D2 examples and explanatory prose updated accordingly; `read-only` is documented only as an option for pure-analysis workers that capture findings via `--output-last-message` instead of writing their own file.
- **`report_agent_job_result` scope.** Tool is registered for `spawn_agents_on_csv` batch workers, not for ordinary prompt-spawned `spawn_agent` subagents. Removed from the D1 custom-agent `developer_instructions` template in SKILL.md and `references/runtime/codex-runtime.md`; added a clarifying note directing CSV-job users to OpenAI's subagents docs.
- **`[agents] max_threads` semantics.** `core/src/agent/registry.rs` `reserve_spawn_slot` returns `AgentLimitReached` when the open-thread count reaches the cap — normal `spawn_agent` calls past the limit fail, they do not queue. The "queues 2 and runs 6 concurrently" line was wrong; replaced with the actual failure mode and a pointer to `spawn_agents_on_csv` for true fan-out.
- **Issue #11435 framing.** Issue is closed (cannot-reproduce after `exec` was reimplemented on the app server). `--ephemeral` is still the right default for isolated parallel runs, but reframed from "required to avoid corruption" to a historical motivation for the flag.
- **Issue #15177 fix claim.** Issue is still open with no linked fix. Removed the "Fixed in 0.122.0-alpha" claim; now documents the current-state workaround (prefer the `default` role when model-override fidelity matters).
- **`codex exec` approval default.** `codex-rs/exec/src/lib.rs:376` hardcodes `Some(AskForApproval::Never)` for headless mode. The `approval_policy` key in `config.toml` applies to the interactive TUI only. Settings table and `config.toml` comment corrected.
- **`features.multi_agent` default.** Default-enabled in 0.121.0+ (`features/src/lib.rs`: `default_enabled: true`). Docs no longer imply users must set this explicitly to use Option D1.
- **Native subagents ship date.** Reframed "shipped 2026-03-16" (imprecise) to "`multi_agent` feature flag stabilized in 0.115.0 on 2026-03-16" (matches `rust-v0.115.0` release notes: `#14622 Stabilize multi-agent feature flag`).
- **Bash portability.** SKILL.md's `(portable, any POSIX shell)` claim on the D2 status loop conflicted with Bash-only `[[ ... ]]` tests. Rewrote the artifact counter as a POSIX-compatible loop using `[ -e "$f" ]` and `case`, and added the same hardening to `references/runtime/codex-runtime.md`. Zero-match safety: the loop does not abort under `set -euo pipefail` when no artifacts exist or only `.prompt.md` inputs are present — both cases previously aborted an `ls | grep | wc` pipeline.
- **FIFO semaphore failure propagation.** The hard-cap example now collects PIDs, `wait`s on each explicitly, aggregates a `status` variable, closes fd 9 after the wait loop, and `exit "$status"` so downstream Phase 4 synthesis does not run on missing artifacts. `trap 'echo >&9' EXIT` inside the worker subshell guarantees the semaphore token is returned even when a worker exits non-zero under strict mode.
- **Picker-table drift.** Added the missing `Cross-agent messaging required mid-run → Neither, use Option B` row to the lower SKILL.md picker table (previously only in the top table and the reference file).
- **macOS CPU-count.** `nproc` alone misled readers on Darwin; the concurrency-cap note now shows both `nproc` (Linux) and `sysctl -n hw.ncpu` (macOS) in SKILL.md and the reference file.

### Fixed — SKILL.md description exceeds Codex load limit (PR #45)

- **Trimmed `description` frontmatter from 1217 to 960 characters** (64-char safety margin under Codex's 1024-character limit, enforced by `validate_len(&description, MAX_DESCRIPTION_LEN, "description")` in Codex 0.121.0). Before this, Codex silently skipped the skill with: `Skipped loading 1 skill(s) due to invalid SKILL.md files. ~/.codex/skills/reprompter/SKILL.md: invalid description: exceeds maximum length of 1024 characters`. Claude Code did not enforce the limit, so the bug was Codex-only and easy to miss.
- Every Single / Repromptverse / Reverse-mode trigger keyword preserved. Removed only verbose phrasing and redundant aliases (`anything going to agent teams`, `multi-agent marketing`, `best practices`, per-mode score breakdown prose). No trigger was dropped.

### Changed

- `compatibility:` frontmatter claim names the actual mechanism used on each runtime instead of hedged "if available" language.
- README.md compatibility table upgrades Codex `Multi-agent parallel` from `yes*` to `yes` with the footnote pointing to Option D.

### Review notes

- PR #44 went through **7 rounds of automated Codex bot review** plus a source-level cross-check at the `rust-v0.121.0` tag. Each round traded a narrower, more accurate claim for a broader, sloppier one — the final wording is grounded in cited source lines rather than memory-from-spec. The takeaway recorded in the commit messages: source-verify contested claims before prose lands in a docs-only PR.

### What's next (deliberately out of scope)

- TESTING.md scenarios for D1 (native subagent fan-out) and D2 (shell-level `codex exec` fan-out) were flagged as desirable but not included here; they fit better as a small follow-up PR so the review surface stays focused.
- Codex-specific install one-liner in README (alongside the existing Claude Code `curl | tar` recipe) — same reason, follow-up.

## v12.0.0 (2026-04-17) — Closed-loop Flywheel

### Headline

Reprompter is no longer an open-loop prompt rewriter. Every generated prompt now emits testable success criteria, every run can be recorded and scored, every outcome feeds a local flywheel, and the skill can consult that flywheel at generation time to bias template / pattern choices toward historical winners — with an A/B report (`npm run flywheel:ab`) that *proves* whether the bias helps. All data local; no telemetry.

This release also recovers Repromptverse under opus 4.7 (which enforces tool schemas strictly where 4.6 was lenient), ships a tool-drift linter as long-term regression insurance, and hardens the Repromptverse runtime selection path.

### Added — closed-loop flywheel (v2+v3 rollout, PRs #33–#35 + #39–#41)

- **v1 outcome-record schema** (`references/outcome-schema.md`). Canonical JSON shape at `.reprompter/outcomes/<ts>-<fp>.json` with `success_criteria`, `verification_results`, `score`, and optional `role` (Repromptverse agent identity) / `applied_recommendation` (flywheel attribution) fields.
- **`scripts/outcome-record.js`** — zero-dep node CLI + library for writing outcome records. Accepts `--prompt`, `--output`, `--criteria`, `--task-type`, `--mode`, `--role`, `--applied-recommendation`, `--notes`. Fingerprint-based filename with collision-safe `-2.json` / `-3.json` retry. Includes `--self-test`.
- **`scripts/evaluate-outcome.js`** — scores records against their criteria. Four methods: `rule`/`regex`, `rule`/`predicate` (tiny DSL: `len(output_text) OP N`, `contains("...")`, `not contains("...")`), `llm_judge` (via user-supplied `--judge-cmd`), `manual` (always skipped). Score = `round(passed / (passed + failed) * 10)`, skipped excluded. Includes `--self-test`.
- **v1 → NDJSON flywheel bridge** (`scripts/outcome-collector.js::ingestDirectory` + `v1RecordToFlywheelOutcome`). Translates records into the existing flywheel shape, preserves `role`→`recipe.domain` routing so per-agent Repromptverse records don't collapse into one bucket, preserves `applied_recommendation` as first-class attribution, dedupes re-runs by `runId|timestamp`, sorts filenames deterministically. Wired as `npm run flywheel:ingest`.
- **Read-path query API** (`scripts/strategy-learner.js::getRecommendation`). Returns `{recipe, confidence, sampleCount}` or `null` on cold start / low confidence. Optional `promptShape` refinement treats missing fields as wildcards (not strict-matches). Wired as `npm run flywheel:query`.
- **Bias injection behind a flag.** New env var `REPROMPTER_FLYWHEEL_BIAS=0|1` (default **off**). When on, Mode 1 step 5 and Mode 2 Phase 2 consult `getRecommendation()` and bias `templateId`/`patterns`/`capabilityTier` toward historical winners when confidence is medium/high with `sampleCount >= 3`. The skill announces the decision in one line so the bias is never silent.
- **Attribution via `applied_recommendation`** field on outcome records. When bias is applied the record carries `{recipe_hash, confidence, sample_count, applied_at}`; when bias is not applied the field is **absent** — absence is the control-group signal for A/B analysis.
- **A/B report** (`scripts/strategy-learner.js::buildAbReport`). Splits outcomes by attribution presence, reports `{count, mean, median}` per group plus `delta_mean_effectiveness`. Flags groups below 5 samples so readers don't over-read noise. Wired as `npm run flywheel:ab`.
- **`<success_criteria>` emission across all three modes.** Mode 1 step 5 now requires a `<success_criteria schema_version="1">` block with 3–6 `<criterion>` entries (`id`, `verification_method` ∈ `rule` / `llm_judge` / `manual`, `description`, and `<rule>` or `<judge_prompt>` per method). Mode 2 Phase 2 requires per-agent criteria scoped to each teammate's artifact. Mode 3 extracts criteria from the exemplar across three layers (structural / content / style) and embeds them in the generated reverse prompt.

### Added — infrastructure + opus-4.7 compatibility

- **Tool-drift linter** (`scripts/validate-tool-refs.js`, PRs #28–#29 + #32). Node script that scans SKILL.md and references for every obsolete tool shape we've shipped a fix for: pre-2.1 `Task(subagent_type=...)` spawn, pre-2.1 `SendMessage(type=/recipient=)`, broadcast-with-structured-message, Claude Flow references, hardcoded `claude-*-<major>-<minor>` model pins. Multi-line regex support. Wired as `npm run validate:tool-refs` and chained into `npm run check`.
- **Auto-pick runtime** (Repromptverse Phase 3, PR #30). Decision tree detects which of Options A–E is available in the current environment (`TeamCreate` + `Agent` + `SendMessage` + `TeamDelete` toolset → Option B; `sessions_spawn` → C; `tmux` + `claude` ≥ 2.1 → A; Codex → D; else E) and picks automatically. Explicit user intent short-circuits.
- **Tool-schema guard** (Repromptverse Phase 3, PR #31). Pre-invocation self-check paragraph, known-pitfall list (captured from 4.6→4.7 drift), and canonical signatures for every tool Option B depends on — so the skill is self-authoritative.

### Changed

- Mode 1 Process list grew from 6 to 7 steps — "Flywheel bias check" inserted between the interview and the generate step.
- Mode 2 Phase 2 per-agent adaptation checklist requires structured criteria (same shape as Mode 1) for every teammate's prompt. Bullet-list scaffolding in `references/*-template.md` is acceptable starting point but the generated per-agent prompt must upgrade to the structured form.
- Mode 3 Process grew from 7 to 8 steps — "Extract criteria" runs between Analyze and Generate; MUST-GENERATE-AFTER-ANALYSIS checklist updated to match (PR #37).
- `references/swarm-template.md` realigned from Claude Flow (third-party MCP) to reprompter's own Options A–E orchestration (PR #26). Example rewritten to coordinate via artifact files + `TaskList` status instead of Claude Flow memory keys.
- `scripts/validate-templates.sh` accepts a list of non-template exceptions (`EXCEPTION_TEMPLATES`). Now skips both `outcome-schema.md` and `team-brief-template.md`.

### Fixed — opus 4.7 strictness recovery

- `Task(subagent_type=...)` spawn → `Agent(...)` (PR #23). Claude Code 2.1 split the legacy `Task` spawn primitive into `Agent` + `TaskCreate`/`TaskUpdate`/`TaskList`; 4.6 inferred the rename, 4.7 rejects.
- `SendMessage(type=, recipient=)` → `SendMessage(to=, message=)` (PR #25). Pre-2.1 kwargs don't exist on the current tool.
- Broadcast shutdown `SendMessage(to="*", message={structured})` → per-agent `SendMessage(to="<name>", message={...})` (PR #27). Broadcast form accepts plain strings only.

### Fixed — codex review rounds

- **On v2 rollout (PR #38, roundup):** filename collision handling (outcome-record.js), shell quoting for `--judge-cmd` (evaluate-outcome.js), regex body validation (evaluate-outcome.js), idempotent re-ingest (outcome-collector.js), deterministic sort order (outcome-collector.js), agent-identity via `role` → `fingerprint.domain` (outcome-collector.js + outcome-record.js + SKILL.md), Mode 3 MUST-GENERATE checklist updated.
- **On v3 read-path (in-branch to #39):** filter-before-limit on queries so task-type recommendations don't vanish as the store grows, partial `promptShape` fields treated as wildcards instead of strict-match defaults.

### Infra / wiring

- New npm scripts: `validate:tool-refs`, `flywheel:query`, `flywheel:ingest`, `flywheel:ab`.
- New env flag: `REPROMPTER_FLYWHEEL_BIAS=0|1` (consultation; default off). Complements existing `REPROMPTER_FLYWHEEL=0|1` (writing; default on).

### Tests

- **205 tests total** (was 169).
- outcome-collector: 30 → 43. strategy-learner: 24 → 36.
- Two new self-tests: `node scripts/outcome-record.js --self-test`, `node scripts/evaluate-outcome.js --self-test`.

### What's next (deliberately out of scope)

- Default-on flip of `REPROMPTER_FLYWHEEL_BIAS`. Wait for `flywheel:ab` to show a consistent positive `delta_mean_effectiveness` across multiple task types with ≥5 samples per group.
- Per-role bias queries for Repromptverse teams once role-stamped records accumulate.
- Visualizations / dashboards on top of `flywheel:ab` output.
- Community / telemetry pooling — the loop stays local-first.

---

## v11.0.0 (2026-03-30) — Reverse Reprompter

### Added
- **Mode 3: Reverse Reprompter** — extract optimal prompts from exemplar outputs. Show reprompter a great output (code review, architecture doc, PR description, etc.) and it reverse-engineers the prompt that would reproduce that quality.
  - 4-phase pipeline: EXTRACT (structural analysis) → ANALYZE (task type, domain, tone classification) → SYNTHESIZE (XML prompt generation) → INJECT (flywheel seeding)
  - 11 task type classifiers: code-review, security-audit, architecture-doc, api-spec, test-plan, bug-report, pr-description, documentation, content, research, ops-report
  - Structural analysis: heading hierarchy, bullet density, code block count, table detection, file:line reference counting, average sentence length
  - Tone detection: formal/neutral/casual with directive language markers
  - Domain detection: 8 domains (frontend, backend, security, database, infrastructure, ops, mobile, ml)
  - Quality analysis: specificity, coverage, clarity scoring
  - Output format inference from exemplar structure
  - Constraint extraction from exemplar patterns
  - Prompt scoring on 6 dimensions
  - **Extraction Card**: transparency table showing detected task type, domain, tone, structure, quality
- **Flywheel exemplar injection** — `injectExemplar()` in outcome-collector.js seeds the flywheel with pre-graded outcomes from reverse-engineered exemplars. Solves the cold-start problem.
  - `buildExemplarOutcome()` in reverse-engineer.js creates flywheel-compatible outcome records
  - Exemplar outcomes get +0.5 effectiveness bonus (user-curated = high quality)
  - Source field marked as `reverse-exemplar` for provenance tracking
- **Reverse mode intent routing** — 10 trigger phrases detected in intent-router.js: "reverse reprompt", "reprompt from example", "learn from this", "extract prompt from", "prompt dna", "prompt genome", etc.
- `references/reverse-template.md` — new template for reverse mode prompts with EXTRACT/ANALYZE/SYNTHESIZE documentation
- 43 new tests in `scripts/reverse-engineer.test.js` covering structure analysis, tone detection, domain detection, task classification, quality analysis, format inference, full pipeline, scoring, flywheel injection, and edge cases

### Changed
- SKILL.md updated from 2 modes to 3 modes (Single, Repromptverse, Reverse)
- Task types table expanded with Reverse entry
- Description and trigger words updated to include reverse mode

### Inspired by
- [Extraktor](https://github.com/AytuncYildizli/extraktor) genome extraction pattern: dual-signal analysis (structural + content), phase-based pipeline with progressive enrichment

## v10.0.0 (2026-03-19) — Repromptmania

### Added
- **Dimension Interview** — score-driven interview for Repromptverse Phase 1. Askable dimensions (Clarity, Specificity, Constraints, Decomposition) scoring < 5 trigger targeted AskUserQuestion calls (0-4 questions). Structure excluded (auto-fixed by templates). Interview responses feed into agent planning via interviewContext.
- **Agent Cards** — three transparency templates for Repromptverse:
  - **Plan Cards** (Phase 1): team roster table with roles, scopes, excludes, output paths
  - **Status Line** (Phase 3): compact emoji-based polling status per agent
  - **Result Cards** (Phase 4): per-agent score, finding count, and key insight summary
- **User confirmation gate** — Plan Cards shown before execution; user must approve team plan before agents launch
- 8 new test scenarios (34-41) covering Dimension Interview triggers, Agent Cards rendering, interview-to-constraint flow, and edge cases

### Changed
- Phase 1 expanded from 4 steps to 7 (score → interview → pick mode → define team → Plan Cards → confirm → write brief)
- Phase 1 time estimate updated from ~30s to ~45s
- Phase 4 adds Result Cards as mandatory step before synthesis (step 4 of 5)
- Phase 3 polling now shows Status Line format across all platform options
- 4 new anti-patterns added to TESTING.md

### Migration
- Breaking: Repromptverse Phase 1 now includes optional interview and mandatory confirmation gate. Existing workflows may see new AskUserQuestion calls.

## v9.2.1 (2026-03-15)

### Fixed
- **7 critical flywheel gaps** resolved by 3-agent parallel team (RuntimeEngineer, OutcomeEngineer, DocsEngineer)
- `flywheelPreferredTier` now consumed by capability-policy.js (+2 score boost)
- `postCorrectionEdits` collected via git log heuristic
- `.reprompter/` added to .gitignore
- Pattern merge complete (full objects via `getPatternById`)
- Ledger rotation with `trimOutcomes(500)` and atomic write
- E2E integration test (5 tests covering full flywheel cycle)
- SKILL.md flywheel user guidance added
- Version alignment: all files now report 9.2.1
- CHANGELOG cleanup: removed semantic-release auto-generated duplicates

## v9.1.0 (2026-03-15)

### Added
- **Closed-loop flywheel** — historical outcomes now automatically change future execution behavior
- **Pre-decision domain lookup** — `bestRecipeForDomain()` queries historical best recipe before pattern/model decisions are made (no fingerprint needed)
- **Confidence-gated bias application** — `applyFlywheelBias()` merges winning patterns at medium+ confidence, overrides capability tier at high confidence
- **Restructured execution flow** — flywheel lookup moved before pattern selection and model resolution so bias can influence decisions

### Changed
- `buildExecutionPlan` flow: routeIntent → flywheelLookup → biased selectPatterns → biased resolveModel → buildContext → fingerprint (of actual decisions)
- Plan result now includes `flywheelBias` (with `applied`, `changes`, `confidence` fields) instead of unused `flywheelRecommendation`
- Pattern selection reasons include flywheel bias trace when applied

## v9.0.0 (2026-03-15)

### Added
- **Prompt Flywheel engine** — closed-loop outcome learning system that gets smarter with every use
- **Recipe fingerprinting** — `scripts/recipe-fingerprint.js` produces deterministic SHA-256 hashes of prompt strategy vectors (template + patterns + tier + domain + layers + quality bucket). Order-invariant, case-insensitive.
- **Outcome collection** — `scripts/outcome-collector.js` passively captures execution signals (artifact score/pass, retry count, execution time) and links them to recipe fingerprints. Storage: `.reprompter/flywheel/outcomes.ndjson`
- **Strategy learning** — `scripts/strategy-learner.js` queries the outcome ledger for similar past tasks, computes time-decay weighted effectiveness scores (7-day half-life), and recommends best-performing recipes with confidence levels
- **Runtime integration** — flywheel hooks at `plan_ready` (fingerprint + strategy lookup) and `finalize_run` (outcome collection) in `scripts/repromptverse-runtime.js`
- **Feature flag** — `REPROMPTER_FLYWHEEL=0|1` for controlled rollout (enabled by default)
- **Telemetry stages** — 3 new event types: `fingerprint_recipe`, `collect_outcome`, `learn_strategy`
- **Flywheel benchmark harness** — `scripts/run-flywheel-benchmark.js` with 13 fixtures covering fingerprint determinism (4), effectiveness scoring (6), and strategy learning (3) with Wilson 95% CI
- **Unit test suites** — `recipe-fingerprint.test.js` (14 tests), `outcome-collector.test.js` (19 tests), `strategy-learner.test.js` (15 tests)
- **npm scripts** — `test:recipe-fingerprint`, `test:outcome-collector`, `test:strategy-learner`, `benchmark:flywheel`, `flywheel:report`

### Privacy
- All flywheel data is stored locally in `.reprompter/flywheel/`. No data is transmitted anywhere.

## v8.3.1 (2026-02-28)

### Added
- **Real-world benchmark harness** — `scripts/run-realworld-benchmark.js` with routing + artifact fixture evaluation and Wilson 95% confidence intervals
- **Expanded real-world fixtures** — `benchmarks/fixtures/realworld-routing-fixtures.json` (64 cases) and `benchmarks/fixtures/realworld-artifact-fixtures.json` (84 cases)
- **Real-world benchmark artifacts** — `benchmarks/v8.3-realworld-benchmark.md` and `benchmarks/v8.3-realworld-benchmark.json`
- **Router regression coverage** for low-signal multi-agent fallbacks and single-mode false-positive protection (`scripts/intent-router.test.js`)

### Fixed
- **Implicit multi-agent over-triggering** in `scripts/intent-router.js` by requiring coordination-scope signals for multi-domain auto-detection
- **Weak single-keyword profile matches** now fall back to generic `repromptverse` via a minimum routing score gate
- **Ops/research routing misses** improved with additional domain phrases (`incident containment`, `recovery`, `decision matrix`, `evidence scoring`)
- **Benchmark evaluator pass accounting** in `scripts/run-provider-benchmark.js` and `scripts/run-realworld-benchmark.js` so score bounds are only enforced for expected-pass fixtures by default (with `enforceScoreBounds` opt-in)

## v8.3.0 (2026-02-28)

### Added
- **Implicit multi-agent intent detection** in `scripts/intent-router.js` for complexity signals (`audit`, `parallel`) and multi-domain prompts (2+ detected systems)
- **Router regression tests** for implicit-intent activation and `forceSingle` override behavior
- **Benchmark fixture expansion** from 6 to 9 routing cases, including implicit-intent scenarios
- **Capability policy engine** — `scripts/capability-policy.js` for provider/model tier routing with fallback chains
- **Layered context builder** — `scripts/context-builder.js` with token-budget manifest output
- **Strict artifact evaluator** — `scripts/artifact-evaluator.js` for gated acceptance and retry targeting
- **Pattern selector** — `scripts/pattern-selector.js` for pluggable prompt/context advancement patterns
- **Runtime adapters** — `scripts/runtime-adapter.js` + `scripts/runtime-adapter-openclaw.js` for OpenClaw-first execution with sequential fallback
- **Runtime orchestrator** — `scripts/repromptverse-runtime.js` composes routing, patterns, policy, context, adapter execution, and optional artifact evaluation
- **Telemetry schema + store** — `scripts/telemetry-schema.js` and `scripts/telemetry-store.js` for stage-level run instrumentation
- **Observability report generator** — `scripts/run-observability-report.js` with markdown/json outputs under `benchmarks/observability/`
- **Provider/evaluator benchmark harness** — `scripts/run-provider-benchmark.js` + new fixtures and reports (`benchmarks/v8.3-provider-benchmark.*`)
- **Expanded test suite** — dedicated unit tests for capability policy, context builder, evaluator, pattern selector, runtime adapter, orchestrator integration, and telemetry/reporting
- **Runtime feature flags** for controlled rollout: `REPROMPTER_POLICY_ENGINE`, `REPROMPTER_LAYERED_CONTEXT`, `REPROMPTER_STRICT_EVAL`, `REPROMPTER_PATTERN_LIBRARY`

### Fixed
- **`forceSingle` precedence** now overrides explicit profile triggers, guaranteeing deterministic single-mode routing when requested
- **Skill packaging filter** now excludes all `scripts/*.test.js` instead of a single test file

## v8.2.0 (2026-02-24)

### Added
- **Deterministic intent router** — `scripts/intent-router.js` with explicit profile triggers + weighted keyword routing
- **Router unit tests** — `scripts/intent-router.test.js` (8 passing tests)
- **Benchmark harness** — `scripts/run-swarm-benchmark.js` + fixture set under `benchmarks/fixtures/`
- **Benchmark reports** — generated markdown/json artifacts for pre-release checks

### Changed
- **Codex/Claude operational parity hardened** with runnable `npm run check` pipeline (templates + router tests + benchmark)
- **Packaging scope tightened** — benchmark artifacts and router test file excluded from skill zip
- Version alignment across docs and skill metadata to `v8.2.0`

## v8.1.0 (2026-02-24)

### Added
- **Engineering swarm template** — `references/engineering-swarm-template.md` for architecture/feature/refactor/migration/test coverage multi-agent runs
- **Ops swarm template** — `references/ops-swarm-template.md` for incident/reliability/infra workflows
- **Research swarm template** — `references/research-swarm-template.md` for benchmark/analysis/tradeoff workflows
- **Expanded test coverage** — scenarios for engineering, ops, and research swarm auto-load plus single-mode pattern-pack verification
- **Deterministic intent router** — `scripts/intent-router.js` + `scripts/intent-router.test.js`
- **Swarm benchmark harness** — `scripts/run-swarm-benchmark.js` with fixture-driven reports in `benchmarks/`

### Changed
- **Repromptverse routing broadening:** lazy-load domain profiles now cover marketing + engineering + ops + research intents
- **Docs parity:** README and SKILL updated to reflect Codex/Claude compatibility with all swarm profiles
- **Template priority:** domain swarms are preferred before generic `repromptverse-template` in multi-agent mode

## v8.0.0 (2026-02-24)

### Added
- **Repromptverse template** — `references/repromptverse-template.md` adds explicit `routing_policy`, `termination_policy`, `artifact_contract`, and `evaluation_loop`
- **Marketing swarm template** — `references/marketing-swarm-template.md` for campaign/growth/SEO/content multi-agent runs
- **Codex installation path** documented in README (`~/.codex/skills/reprompter`)
- **Codex compatibility** in SKILL frontmatter and execution options
- **Microsoft-inspired orchestration notes** in README for selector-style routing + evaluator loops

### Breaking
- **Repromptverse is now the only multi-agent mode name** — Repromptception naming removed from docs/triggers

### Changed
- **Marketing-first routing:** Repromptverse auto-loads marketing swarm profile for campaign/growth/SEO/content intents
- Multi-agent mode docs now describe runtime-specific execution options: tmux, TeamCreate, sessions_spawn, Codex parallel sessions, and sequential fallback
- Template priority updated to prefer `marketing-swarm-template`/`repromptverse-template` for multi-agent tasks

## v7.1.0 (2026-02-22)

### Added
- **Platform-aware Phase 3 execution** — TeamCreate (Claude Code native), Sequential (any LLM) promoted to first-class options alongside tmux (#12)
- **GitHub Releases automation** — `release.yml` workflow creates releases from tags + CHANGELOG (#3)
- **Input guard + content template + vague prompt fallback** (#4)
- **Template reference system** — templates read on demand from `references/`, not bundled in SKILL.md

### Fixed
- **Interview mode restored** — 4 bugs in Quick Mode gate: complexity keyword table, simple verb whitelist, broad-scope noun detection, force-interview signal ordering (#13)
- **Release workflow** — awk double-v prefix bug (#8)
- **Anthropic Skills Guide compliance** — directory structure + sentence case headings (#6, #10)
- **Audit findings** — 20+ fixes across 3 audit sprints (CRITICAL/HIGH/MED), template structural alignment, extended XML tags, negative constraints in all Example sections
- Bold formatting and `count_distinct_systems()` restored after merge conflicts

### Changed
- `docs/examples/` renamed to `docs/references/` (#7)
- Template files consolidated into single adaptive XML template
- README examples upgraded to v7 Repromptverse quality
- Extended tags, Advanced Features, teammateMode documented
- Compatibility frontmatter updated for multi-platform support

## v7.0.0 (2026-02-12)

### Breaking
- **Merged `reprompter` + `reprompter-teams` into single skill** — one SKILL.md, two modes
- **Removed `TEAMS.md` as separate file** — all team execution docs now in SKILL.md
- **Removed `research-reprompter`** — was broken, unused

### Added
- **Two-mode architecture:** Single prompt mode + Repromptverse mode in one skill
- **Repromptverse vs Raw comparison data** — 4-agent audit: +100% CRITICALs, +160% findings, +30% cost savings
- **Auto-detection:** suggests Repromptverse when task mentions 2+ systems or "audit"
- **content-template:** added for blog posts, articles, and marketing copy (12 templates total)
- content-template is now included in references and template tables across SKILL.md/README

### Changed
- SKILL.md trimmed from 1130 lines to ~470 lines (at v7.0.0 release) (59% reduction)
- All team execution patterns consolidated (tmux send-keys -l, separate Enter, Opus default)
- Quality scoring section streamlined
- Templates section condensed to reference table
- README updated for v7.0 with dual-mode docs

### Removed
- Redundant Quick Mode pseudocode (~450 tokens saved)
- Verbose interview JSON examples (kept one compact reference)
- Duplicate context detection test scenarios
- Separate TEAMS.md file (content merged into SKILL.md)

## v6.1.3 (2026-02-12)

### Added
- Repromptverse E2E test results in README (2.15→9.15, +326%)
- Routing-logic skill descriptions (OpenAI best practices)
- `teammateMode: "tmux"` documentation for split-pane agent monitoring

### Changed
- TEAMS.md rewritten with proven `send-keys -l` pattern
- SKILL.md execution strategy updated for Agent Teams primary

## v6.1.2 (2026-02-12)

### Fixed
- Version mismatch — SKILL.md now matches CHANGELOG
- Overly broad complexity keywords — "create"/"build" only trigger interview with broad-scope nouns
- MCP tool name in swarm-template — `memory_store` → `memory_usage`
- Added `count_distinct_systems()` definition to Quick Mode pseudocode

### Added
- Template priority rules — explicit tiebreaking
- `<avoid>` sections in feature, bugfix, and api templates
- Per-Agent Sub-Task sections for Tests and Research agents in team-brief-template

## v6.1.1 (2026-02-11)

### Fixed
- Removed duplicated interview questions
- Removed stray `</output>` tags from templates
- Fixed version header mismatch

### Added
- CONTRIBUTING.md, TESTING.md
- GitHub issue templates (bug report, feature request)
- README overhaul with logo, demo GIF, badges

## v6.0.0 (2026-02-10)

### Added
- Closed-loop quality: Execute → Evaluate → Retry
- Team execution via Claude Code Agent Teams
- Delta prompt pattern for targeted retries
- Success criteria generation
- 11 templates (added team-brief, swarm, research)

## v5.1.0 (2026-02-09)

### Added
- Think tool awareness (Claude 4.x)
- Context engineering guidance
- Extended thinking support
- Response prefilling suggestions
- Uncertainty handling section
- Motivation capture

## v5.0.0 (2026-02-08)

### Added
- Smart interview with AskUserQuestion
- Quick Mode auto-detection
- Project-scoped context detection
- Quality scoring (6 dimensions)
- Task-specific follow-up questions
- 8 XML templates
