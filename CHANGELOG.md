# RePrompter Changelog

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
