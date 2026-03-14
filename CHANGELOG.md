# RePrompter Changelog

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
