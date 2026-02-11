# Changelog

## [6.0.0] - 2026-02-11

### Added
- **Closed-Loop Quality System** — Post-execution output evaluation with automatic retry
  - Score output against success criteria (0-10 scale)
  - Targeted delta prompts for retries (not full re-prompts)
  - Max 2 retries with progressive gap analysis
  - Success criteria auto-generation from task analysis
- **RePrompter Teams** — Companion skill for tmux agent team orchestration
  - Phase 1: Improve (prompt engineering)
  - Phase 2: Execute (single agent, team parallel, or team sequential)
  - Phase 3: Evaluate + Retry (closed-loop quality)
  - Auto-route to optimal model (Codex for coding, Gemini for research, Claude for analysis)
- **New trigger words**: "reprompter teams", "run with quality", "smart run"

## [5.1.0] - 2026-02-11

### Added
- Think tool support and guidance
- Context engineering awareness
- Extended thinking integration
- Response prefilling patterns
- Uncertainty handling in prompts
- Motivation interview question

## [5.0.0] - 2026-02-11

### Added
- Execution Mode detection (single/team parallel/sequential)
- Auto-detect complexity for team recommendations
- Team brief generation with per-agent sub-prompts
- Agent-teams skill integration
- Decomposition scoring dimension

## [4.1.0] - 2026-02-11

### Changed
- Voice Input section removed (limits tool appeal)
- Math corrections (+481% → +462%)
- SKILL.md trimmed from 1153 to 1036 lines
- Team brief template created

## [4.0.0] - 2026-02-10

### Added
- Initial public release
- Smart interview with AskUserQuestion
- 8 scoring dimensions
- XML template generation
- Quick Mode for simple prompts
- Context auto-detection
