# Prompt/Context Pattern Catalog

Pluggable pattern set for benchmark-driven prompt/context engineering.

## Core Patterns

- `constraint-first-framing` — Constraint placement is runtime-aware. Keep constraint-early framing as the Claude/Codex default, but for Gemini 3-targeted complex prompts place the core request plus critical/negative constraints near the end. Across all runtimes, avoid blanket negative constraints; state what to do instead where possible. Compatibility note: keep this ID unchanged until selector wiring is updated.
- `uncertainty-labeling`
- `self-critique-checkpoint`
- `delta-retry-scaffold`
- `evidence-strength-labeling`
- `context-manifest-transparency`
- `tool-description-quality` — When the task involves agent tools, MCP servers, or callable capabilities, write tool descriptions as if onboarding a new hire: make implicit context explicit, name when to use the tool, inputs/outputs, side effects, limits, and examples of good calls.

## Usage

Enable patterns per task/domain/outcome profile. Prefer policy-driven activation and benchmark A/B validation instead of hardcoded universal defaults. Constraints should be load-bearing boundaries at the right altitude, not exhaustive lists.
