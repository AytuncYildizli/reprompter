# Plan 003: Align RePrompter's templates and guidance with 2026 prompt-engineering best practices (v12.10.0)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> Do NOT run any `git` commands. Do NOT update `plans/README.md`.
>
> **Drift check (run first)**: `grep -c "12.9.1" package.json` returns 1 and
> `references/patterns/pattern-catalog.md` exists. Otherwise STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (content changes to the core product; guarded by validate-templates + benchmarks + evaluator tests)
- **Depends on**: none (runs on main @ v12.9.1)
- **Category**: direction
- **Planned at**: commit `f1c52fd`, 2026-07-02

## Why this matters

RePrompter's templates encode 2024–2025-era prompt-engineering practice. A 105-agent, adversarially-verified research pass (2026-07-02) against current vendor guidance (Anthropic Claude 4/5-era docs, OpenAI GPT-5.x guides, Google Gemini 3, xAI Grok) and literature produced 13 verdicts: RePrompter's core structure is validated (XML sectioning, roles, success-criteria blocks, delta-rewrite loops all CURRENT), but several encoded practices are now SUPERSEDED or CONTESTED — most notably aggressive emphasis language, prompt-embedded output schemas, prescriptive step plans, constraint stuffing, unconditional constraint-FIRST placement, and default clarification interviews. This plan applies those verdicts. Full evidence with sources: `/private/tmp/claude-501/-Users-aytuncyildizli-reprompter/4dad2e46-45b3-4341-a7b6-8b01b27d635d/scratchpad/research-findings.md` (supplementary; every verdict you need is inlined below). The technique inventory that grounds the file targets: `/private/tmp/claude-501/-Users-aytuncyildizli-reprompter/4dad2e46-45b3-4341-a7b6-8b01b27d635d/scratchpad/technique-inventory.md` (supplementary).

## Research verdicts (inline — authoritative for this plan)

**KEEP (validated, do not remove):**
- V1 XML-tag structuring — CURRENT on all vendors; Anthropic still recommends dedicated tags; OpenAI cites Cursor's XML-spec adherence gains.
- V2 Role prompting — CURRENT ("even a single sentence makes a difference") and 3–5 few-shot examples in `<example>` tags.
- V3 Success-criteria + verification-first prompting — CURRENT, explicitly endorsed for coding agents (acceptance criteria, test expectations, validation steps).
- V4 Delta-style retry (reference specific failures from the prior attempt) — CURRENT (xAI-endorsed).
- V5 Sectioning matters, syntax doesn't — XML vs Markdown is officially NEUTRAL (Anthropic: "exact formatting is likely becoming less important"; xAI: either). Soften any XML-mandatory language to "clear sectioning; XML default, Markdown equally valid."

**CHANGE (superseded/contested):**
- V6 SUPERSEDED — Aggressive emphasis ("CRITICAL", "MUST", "ALWAYS", "Be THOROUGH") causes over-compliance and tool-call loops on frontier models (Anthropic: "dial back any aggressive language"; OpenAI/Cursor removed their thoroughness block). Rule: plain imperative phrasing; emphasis only for genuine safety gates.
- V7 SUPERSEDED (hard) — Prompt-embedded output schemas and assistant prefill: Claude 4.6+ returns 400 on prefill; OpenAI says "remove output schema definitions from the prompt, use Structured Outputs." Rule: when the target runtime exposes structured-output API features, the prompt should NAME the expected shape and defer enforcement to the API; prompt-embedded schemas remain the fallback where no such surface exists.
- V8 SUPERSEDED — Hand-written step-by-step reasoning plans: outcome-first prompting wins (Anthropic: "prefer general instructions over prescriptive steps"; OpenAI GPT-5.5: state goal, success criteria, allowed side effects, output shape — not steps). Templates should emit objectives + verification, not numbered how-to plans, except for genuinely ordered procedures (migrations, protocols).
- V9 SUPERSEDED — Exhaustive constraint enumeration / edge-case stuffing: Anthropic "right altitude" — specific enough to guide, flexible enough to leave heuristics. Rule: constraints must be load-bearing boundaries, not exhaustive lists; quality-over-quantity.
- V10 CONTESTED — Constraint-FIRST placement: Gemini 3 guidance puts the core request and critical/negative constraints at the END for complex prompts; blanket negatives are harmful. Rule: constraint placement becomes RUNTIME-AWARE (keep constraint-first as the Claude/Codex default; for Gemini-targeted prompts place critical constraints last; avoid blanket negative constraints everywhere).
- V11 CONTESTED — Default 2–5 question interviews: for autonomous/agentic execution OpenAI recommends proceeding on documented reasonable assumptions instead of asking. Rule: interview stays for interactive use, but becomes CONDITIONAL — skip when the prompt is destined for autonomous execution (goal/workflow/team lanes) and instead emit an `<assumptions>` block of documented defaults the user can veto.
- V12 CURRENT (frame shift) — Context engineering: context is a finite degrading resource ("context rot"). Add right-altitude and token-budget awareness to guidance; prompts should curate context, not maximize it.
- V13 CURRENT (new lever, currently absent) — Tool-description prompting: writing/refining tool descriptions is one of the highest-leverage prompt improvements for agents. RePrompter has no template coverage for it.

## Current state (files you will touch)

- `SKILL.md` — behavior spec (~1870 lines). Interview flow in "Lane: Single prompt" (~line 344+); quality scoring at ~line 1386; header/version at top. Contains "MUST"/"CRITICAL"-style emphasis in several rule lists (audit them; keep genuine safety gates like risk-gate rules).
- `references/patterns/pattern-catalog.md` — the 6 pluggable patterns, including `constraint-first framing` (V10 target).
- `references/*-template.md` — 17+ templates emitting XML skeletons (`<role>`, `<context>`, `<task>`, `<requirements>`, `<constraints>`, `<output_format>`, `<success_criteria>`). V6/V7/V8/V9 targets. `references/runtime/evaluation-rubric.md` — scoring criteria (V9: "Constraints" criterion must reward load-bearing boundaries, not count).
- `references/runtime/context-layers.md` — context assembly guidance (V12 target).
- `scripts/validate-templates.sh` — structural template validator; must keep passing.
- Benchmarks (`npm run check` tail) test ROUTING and artifact-contract scoring, not template prose — content edits must not change template file names, trigger tables, or section tag names, or routing/artifact benchmarks may break.
- Version: 12.9.1 → 12.10.0 (feature release; package.json, package-lock.json ×2, SKILL.md frontmatter/title/blurb, README badge).
- Generated artifacts: regenerate `skills/reprompter/` (`npm run package:hermes`) and `plugin/` (`npm run package:plugin`) after content edits.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Template validation | `npm run validate:templates && npm run validate:tool-refs` | exit 0 |
| Full gate | `npm run check` | exit 0 pre-regeneration suites; artifact guards fail only pre-commit (expected — report, don't fix) |
| Regenerate | `npm run package:plugin && npm run package:hermes` | exit 0 |

## Scope

**In scope**: `SKILL.md`, `references/**` (templates, pattern-catalog, evaluation-rubric, context-layers, runtime docs where they assert prompting practice), `README.md` (Key Features + version badge), `CHANGELOG.md`, `package.json`, `package-lock.json`, `plugin/**` + `skills/reprompter/**` via generators only.

**Out of scope**: all `scripts/*.js` code (scoring weights in prompt-gate.js and evaluator stay untouched this release — heuristic recalibration is a separate data-driven task); benchmark fixtures; template FILE NAMES and section TAG NAMES (routing + validators depend on them); trigger tables; plans/.

## Git workflow

None. Reviewer handles git.

## Steps

### Step 1: Emphasis audit (V6)

Grep `SKILL.md` and every `references/*.md` for `CRITICAL`, `MUST`, `ALWAYS`, `NEVER`, `THOROUGH` (case-sensitive). For each hit decide: (a) genuine safety/protocol gate (risk gates, "never emit /goal for runtimes without it", privacy rules) → KEEP; (b) emphasis-as-motivation in generated-prompt guidance or template text → rewrite to plain imperative ("Use X when…" not "CRITICAL: You MUST use X"). Add one new subsection to SKILL.md's quality-scoring area: "Emphasis calibration" — generated prompts use plain phrasing; reserve capitalized emphasis for safety-critical boundaries only; note that frontier models over-comply with aggressive language (per current Anthropic/OpenAI guidance).

**Verify**: `npm run validate:templates` → exit 0.

### Step 2: Pattern catalog update (V10, V6, V13)

In `references/patterns/pattern-catalog.md`:
1. Rework `constraint-first framing` → `constraint placement (runtime-aware)`: keep the constraint-early default for Claude/Codex targets; add the Gemini-3 rule (critical + negative constraints near the END for complex prompts); add "avoid blanket negative constraints — state what TO do instead" as a universal rule. Preserve the pattern's ID/key if scripts reference it (grep `pattern-selector.js` and fixtures for the pattern id; if the id `constraint-first` is load-bearing, keep the id and change only the body text — do NOT rename ids).
2. Add a 7th pattern: `tool-description quality` — when the task involves agent tools/MCP, the generated prompt should instruct writing tool descriptions "as if onboarding a new hire," with implicit context made explicit (V13). Follow the existing pattern entry format exactly. Only add it to the catalog body; wire it into `pattern-selector.js` ONLY if the selector reads the catalog dynamically (it does not — so catalog-only, and note in the entry that selector wiring is a follow-up).

**Verify**: `npm run test:pattern-selector` → exit 0 (proves you didn't break ids).

### Step 3: Template content pass (V5, V7, V8, V9)

Across the 17 `references/*-template.md` files (and SKILL.md's inline prompt-generation rules):
1. V5: where a template asserts XML is required, soften to "clear sectioning (XML default; Markdown headers equally valid)". Keep emitting XML by default — no skeleton changes.
2. V7: in `<output_format>` guidance, add the routing rule: if the target runtime supports structured-output API features, name the shape and defer enforcement to the API; embed full schemas only as fallback. Do not remove existing `<output_format>` sections.
3. V8: where templates instruct generating numbered step-by-step implementation plans inside prompts, reframe to outcome-first (objective + requirements + verification); keep ordered steps only in genuinely sequential templates (e.g. migration parts of refactor-template if present).
4. V9: in `<constraints>` guidance and `references/runtime/evaluation-rubric.md`'s constraints criterion, replace "more boundaries" framing with "load-bearing boundaries only, right-altitude" (specific enough to guide, flexible enough to leave heuristics).

**Verify**: `npm run validate:templates && npm run test:artifact-evaluator` → exit 0.

### Step 4: Conditional interview + assumptions block (V11)

In SKILL.md's Single-mode interview flow and the `/goal` + Workflow + Repromptverse lanes: interviews remain the default for interactive Single mode, but when the output is destined for autonomous execution (goal preflight, workflow compile, team agents) and the missing information has a reasonable default, SKIP the question and emit an `<assumptions>` block (documented defaults, one line each, user can veto before running). Update the Goal Command Card's "Missing Inputs" row description to reference documented assumptions. Add `<assumptions>` to the Appendix "Extended XML tags" list (SKILL.md ~line 1710).

**Verify**: `npm run validate:templates && npm run test:goal-command && npm run test:workflow-command` → exit 0.

### Step 5: Context-engineering guidance (V12)

In `references/runtime/context-layers.md` (and one short paragraph in SKILL.md near the quality-scoring section): add right-altitude framing and context-rot awareness — context is a finite, degrading resource; generated prompts should curate the minimal sufficient context, prefer references over inlined dumps for long material, and respect the existing token budgeting.

**Verify**: `npm run test:context-builder` → exit 0.

### Step 6: Version, docs, regeneration

1. Version 12.10.0 everywhere (package.json, package-lock ×2, SKILL.md frontmatter + title + one blurb clause, README badge).
2. README Key Features: update the relevant bullets (pattern library count if it changed; one sentence noting templates align with 2026 vendor guidance).
3. CHANGELOG v12.10.0 entry: list the verdict-driven changes (V5–V13), note KEEPs were validated by the same research, cite that the research artifact lives with the maintainer (do not paste URLs into CHANGELOG beyond vendor doc names).
4. `npm run package:plugin && npm run package:hermes`.
5. `npm run check` — all suites green (artifact guards fail only pre-commit).

**Verify**: `grep -c "12.10.0" package.json` → 1; `cmp SKILL.md plugin/skills/reprompter/SKILL.md` → identical; `npm run check` final suites pass.

## Test plan

No new JS tests (no code changes). The gates are: validate-templates, validate-tool-refs, pattern-selector, artifact-evaluator, goal-command, workflow-command, context-builder suites, plus all four benchmarks (routing/artifact contracts must be unaffected).

## Done criteria

- [ ] Zero unjustified `CRITICAL:`/`MUST` emphasis in template guidance (safety gates exempt, each surviving hit defensible).
- [ ] Pattern catalog: constraint placement is runtime-aware; tool-description pattern added; `npm run test:pattern-selector` green.
- [ ] `<assumptions>` block specified for autonomous-destined lanes; goal/workflow suites green.
- [ ] `npm run check` exit 0 (pre-commit artifact-guard failures excepted).
- [ ] Version 12.10.0 consistent; artifacts regenerated; SKILL.md mirrors byte-identical.
- [ ] No template file renamed; no XML section tag renamed; no trigger table changed.

## STOP conditions

- Any benchmark (`benchmark:swarms/provider/realworld/flywheel`) fails after content edits — report which assertion broke; do not tune benchmarks to pass.
- `pattern-selector.js` or fixtures hardcode pattern ids you'd need to rename — keep ids, change body text only; if impossible, STOP.
- A template's structure validation fails after edits and the fix would require changing validate-templates.sh.
- The supplementary artifacts are unreadable (plan is self-contained; proceed on the inlined verdicts and note it).

## Maintenance notes

- Heuristic recalibration of `prompt-gate.js` scoring (e.g. constraints-counting rewarding stuffing, contra V9) is deliberately deferred — it should be driven by accumulated local outcome-log data, not docs.
- Wiring the new tool-description pattern into `pattern-selector.js` + tests is a follow-up (code change).
- Per-model emphasis calibration (V6 qualifier: GPT-5.1 re-added persistence emphasis) may eventually belong in capability-profiles.md.
- Re-run this alignment against vendor docs roughly every 2 releases; the research artifact records the 2026-07-02 baseline.
