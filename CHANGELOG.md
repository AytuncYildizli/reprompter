# Reprompter Changelog

## v6.1.3 (2026-02-12)

### Added
- **Repromptception end-to-end test results** — 3-agent sequential pipeline proven: 2.15/10 → 9.15/10 (+326%), audit PASS 99.1%, 24/24 weaknesses addressed
- **Skill description routing logic** — "Use when / Don't use when" block following OpenAI's skill routing best practices
- **TEAMS.md** — Full Agent Teams execution guide with `teammateMode: "tmux"` split pane monitoring
- **`send-keys -l` pattern** — Critical fix for tmux multiline prompt delivery (literal flag mandatory)

### Changed
- Skill description rewritten as routing logic (triggers, anti-triggers, outputs, success criteria) instead of marketing copy
- README updated with proven test results table and v6.1.2 badge

## v6.1.2 (2026-02-12)

### Fixed
- **B1**: Version mismatch — SKILL.md now matches CHANGELOG (was v6.1.0, should have been v6.1.1+)
- **B2**: Overly broad complexity keywords — "create"/"build" now only trigger interview when followed by broad-scope nouns (dashboard, app, system, etc.). "with" only triggers when connecting multiple items. Removed "the current" (too many false positives). Simple prompts like "create a button" now correctly use Quick Mode.
- **B3**: MCP tool name in swarm-template — `memory_store` → `memory_usage` with `action: "store"` to match actual API
- **B4**: Added `count_distinct_systems()` definition to Quick Mode pseudocode (was referenced but undefined)

### Added
- Template priority rules — explicit tiebreaking when multiple templates match (most specific wins)
- Quick Mode examples for "create"/"build" edge cases
- Per-Agent Sub-Task sections for Tests Agent and Research Agent in team-brief-template
- Example section in team-brief-template (was the only template without one)
- `<avoid>` sections in feature-template, bugfix-template, and api-template (template + example) — explicit anti-patterns per task type

### Changed
- Complexity keywords refined: "build", "create", "with" moved to pattern-based detection instead of simple keyword match

## v6.1.1 (2026-02-11)

### Fixed
- Removed duplicated Execution Mode question (was defined twice in SKILL.md)
- Removed duplicated Motivation question (was defined twice in SKILL.md)
- Removed stray `</output>` tags from template files
- Fixed version header mismatch (was v6.0, now v6.1.0 matching frontmatter)
- Removed dead reference to non-existent `reprompter-teams` skill

### Added
- Edge case handling section (empty input, non-English, code blocks, long prompts, conflicting choices)
- Complexity keywords: build, create, dashboard, app, system, platform, service, pipeline
- Cost documentation section (API calls per mode)
- AskUserQuestion fallback note for non-Claude-Code platforms
- `team-brief-template.md` extracted to resources/templates/
- `TESTING.md` with 9 test scenarios and anti-pattern examples
- Self-assessment bias acknowledgment in scoring section
- Security notes: XML injection warning, --dangerously-skip-permissions warning
- Cost/token budget section in TEAMS.md
- /tmp cleanup note for brief files

### Changed
- Renamed `ui-component-template.md` -> `ui-template.md` (matches SKILL.md table)
- Renamed `documentation-template.md` -> `docs-template.md` (matches SKILL.md table)

### Removed
- `SKILL.md.bak.v4.1` backup file (outdated v4.1 backup)

## v6.0.0

- Closed-loop quality: Execute -> Evaluate -> Retry
- Delta prompt pattern for targeted retries
- Success criteria generation (machine-checkable)
- Max 2 retries (3 total attempts)

## v5.1.0

- Team mode: Parallel and Sequential execution
- Team brief generation
- Per-agent sub-prompt generation
- Motivation capture in interview
- Execution mode question
- Auto-detect complexity rules

## v4.1.0

- Fixed Quick Mode false positives for compound tasks
- Task-specific follow-up questions
- Whole-word regex matching for complexity keywords

## v4.0.0

- Project-scoped context detection (pwd isolation)
- Smart boundaries and session isolation
- Context scope rules (no parent scanning, no cross-project)

## v3.0.0

- Chain-of-thought (`<thinking>`) section
- RAG reference section
- Swarm and research templates

## v2.0.0

- AskUserQuestion integration
- Quality scoring (6 dimensions)
- Quick Mode detection
- 8 output templates

## v1.0.0

- Basic prompt transformation
- XML template format
