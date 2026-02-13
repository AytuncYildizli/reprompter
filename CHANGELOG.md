# RePrompter Changelog

## v7.0.0 (2026-02-12)

### Breaking
- **Merged `reprompter` + `reprompter-teams` into single skill** — one SKILL.md, two modes
- **Removed `TEAMS.md` as separate file** — all team execution docs now in SKILL.md
- **Removed `research-reprompter`** — was broken, unused

### Added
- **Two-mode architecture:** Single prompt mode + Repromptception mode in one skill
- **Repromptception vs Raw comparison data** — 4-agent audit: +100% CRITICALs, +160% findings, +30% cost savings
- **Auto-detection:** suggests Repromptception when task mentions 2+ systems or "audit"
- **content-template:** added for blog posts, articles, and marketing copy (12 templates total)
- content-template is now included in docs/references and template tables across SKILL.md/README

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
- Repromptception E2E test results in README (2.15→9.15, +326%)
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
