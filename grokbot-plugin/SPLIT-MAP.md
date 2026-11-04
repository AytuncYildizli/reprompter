# SPLIT-MAP — root `SKILL.md` (v13.3.1, 2086 lines) → `grokbot-plugin/`

Each row maps a root `SKILL.md` heading (line number) to where its text now lives. Paths are relative to `grokbot-plugin/skills/`. "Verbatim" means the line range was copied unchanged with `sed -n 'A,Bp'`. The only edits are added pointer lines and plugin-local headers.

Status: every root heading is placed (chunk 1 + chunk 2), synced to v13.3.1. Run `bash grokbot-plugin/verify-split.sh` to check that every non-blank line of root `SKILL.md` appears in some file under `skills/`, that no line root has deleted since `SPLIT-BASE` survives here, and that relative links and backticked `references/` / `../` paths resolve.

`SPLIT-BASE` holds the git blob id of the root `SKILL.md` this split was last synced against; line numbers below refer to that blob. To sync again: run `verify-split.sh`, put each MISSING root line in the mode skill this map names, update or remove each STALE line, then run `bash grokbot-plugin/sync-copies.sh --apply`, which refreshes every `references/` and `scripts/` copy from its root file except the intentional edits listed in `DIVERGED-COPIES` (add a path there when the split must keep its own version of a root file). Finish with `git hash-object -w SKILL.md > grokbot-plugin/SPLIT-BASE` (`-w` stores the blob, so the stale check can read it before you commit) and rerun `verify-split.sh`. Line placement stays a human step: which mode skill owns new root text is a judgment about the split, and an automated attempt failed six verification rounds. The line numbers below are from the last full remap and drift as root changes.

## Placed (chunk 1)

| Root lines | Root heading | New location | Notes |
|---|---|---|---|
| 1-18 | YAML frontmatter (name, description, compatibility, metadata) | `reprompter/references/original-frontmatter.md` | Verbatim in a yaml fence. Trigger list also kept verbatim in `reprompter/SKILL.md` frontmatter `description`. |
| 20-22 | `# RePrompter v13.3.1` + tagline | `reprompter/SKILL.md` | Verbatim |
| 26-45 | `## Two intents` | `reprompter/SKILL.md` | Verbatim |
| 47-56 | `## Don't use when` | `reprompter/SKILL.md` | Verbatim |
| 360-370 | `## Intent: Improve (Single prompt)` / `### Shape decision (specifiability router)` | `reprompter-improve/SKILL.md` | Verbatim |
| 372-384 | `### Process` | `reprompter-improve/SKILL.md` | Verbatim |
| 386-404 | `#### Flywheel bias injection (v3 read-path)` | `reprompter-improve/references/flywheel-bias.md` | Verbatim; summary stub in `reprompter-improve/SKILL.md` |
| 406-417 | `#### Fleet sync (v12.14 privacy boundary)` | `reprompter-improve/references/flywheel-bias.md` | Verbatim |
| 419-430 | `### Generate after interview` | `reprompter-improve/SKILL.md` | Verbatim |
| 432-446 | `### Interview questions` | `reprompter-improve/SKILL.md` | Verbatim |
| 448-457 | `### Single mode pattern pack (Microsoft-inspired)` | `reprompter-improve/SKILL.md` | Verbatim |
| 459-470 | `### Auto-detect complexity` | `reprompter-improve/SKILL.md` | Verbatim |
| 472-500 | `### Quick mode` (+ `#### ⚠️ Force interview signals`, `#### Enable Quick Mode`) | `reprompter-improve/SKILL.md` | Verbatim |
| 502-533 | `### Task types & templates` | `reprompter-improve/SKILL.md` | Verbatim; all 20 templates (incl. `design-loop-template.md`) + `outcome-schema.md` + `patterns/` copied to `reprompter-improve/references/` so `references/{type}-template.md` resolves |
| 535-580 | `### Base XML structure` | `reprompter-improve/SKILL.md` | Verbatim |
| 582-588 | `### Project context detection` | `reprompter-improve/SKILL.md` | Verbatim |
| 590-593 | `### After the final prompt` | `reprompter-improve/SKILL.md` | Verbatim; pointer line added to `reprompter-goal-workflow/SKILL.md` for the headless-relay step |
| 1288-1324 | `## Intent: Build (One-Shot)` (+ `### When the thing is a page rather than a program`) | `reprompter-oneshot/SKILL.md` | Verbatim; `references/oneshot-template.md` and `references/design-loop-template.md` copied alongside (both also in `reprompter-improve/references/`: the specifiability router and the Task types table name them); `references/ui-template.md` copied alongside because the design-loop section names it |
| 1574-1599 | `## Quality scoring` | `reprompter-improve/SKILL.md` | Verbatim; brief summary in `reprompter/SKILL.md` |
| 1601-1603 | `### Emphasis calibration` | `reprompter-improve/SKILL.md` | Verbatim |
| 1605-1607 | `### Context altitude and budget` | `reprompter-improve/SKILL.md` | Verbatim |
| 1611-1618 | `## Closed-loop quality (v6.0+)` | `reprompter-improve/SKILL.md` | Verbatim; brief summary in `reprompter/SKILL.md` |
| 1622-1768 | `## Advanced features` (Reasoning-friendly prompting, Output format control, Context engineering, Capability policy routing, Budgeted layered context, Strict artifact gate, Runtime feature flags, Version self-check, Plugin migration nudge, Telemetry and observability, Prompt Flywheel (+ user guidance, A/B contract), Pattern library, Token budget, Uncertainty handling) | `reprompter/references/advanced-features.md` | Verbatim (shared by all modes) |
| 1770-1843 | `## Ambient Prompt Gate (Claude Code, Codex CLI, and Hermes Agent)` | `reprompter/references/ambient-prompt-gate.md` | Verbatim |
| 1941-1967 | `## Proven results` (Single prompt v6.0, Repromptverse E2E v6.1, Repromptverse vs raw Agent Teams v7.0) | `reprompter/references/proven-results-and-tips.md` | Verbatim |
| 1971-1977 | `## Tips` | `reprompter/references/proven-results-and-tips.md` | Verbatim |
| 1981-1983 | `## Test scenarios` | `reprompter/references/proven-results-and-tips.md` | Verbatim |
| 1987-2013 | `## Appendix: Extended XML tags` | `reprompter-improve/references/extended-xml-tags.md` | Verbatim |

## Placed (chunk 2)

| Root lines | Root heading | New location | Notes |
|---|---|---|---|
| 60-65 | `## Format: /goal command (Improve output)` | `reprompter-goal-workflow/SKILL.md` | Verbatim (60-358 copied as one block) |
| 66-90 | `### Detecting the target runtime` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 91-141 | `### Goal Command Card` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 142-166 | `### Runtime-specific operational notes` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 167-213 | `### Setup check` (/goal; includes the `# Expect ...` shell comments at 191-193, 202) | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 214-219 | `## Format: Workflow script (Improve output)` | `reprompter-goal-workflow/SKILL.md` | Verbatim; `references/workflow-template.md` + `references/runtime/claude-workflow-runtime.md` copied alongside |
| 220-223 | `### Compatibility` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 224-230 | `### Runtime detection` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 231-240 | `### Process` (Workflow) | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 241-345 | `### Workflow Command Card` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 346-349 | `### Schema-truth + parent-written mirror` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 350-358 | `### Setup check` (Workflow) | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 597-611 | `## Team execution: Repromptverse (Agent Teams)` / `### TL;DR` | `reprompter-team/SKILL.md` | Verbatim (597-843 copied as one block) |
| 612-634 | `### Repromptverse control plane (Microsoft-inspired)` | `reprompter-team/SKILL.md` | Verbatim; `repromptverse`, `swarm`, `team-brief`, `{engineering,marketing,ops,research}-swarm` templates + `outcome-schema.md` copied to `reprompter-team/references/` |
| 635-645 | `### Phase 1: Team plan (~45 seconds)` | `reprompter-team/SKILL.md` | Verbatim |
| 646-725 | `### Dimension Interview (Repromptverse only)` (Trigger logic, Dimension-to-question mapping, Skip/dismiss handling, Interview output; `#` comments at 655-659 are inside a code block) | `reprompter-team/SKILL.md` | Verbatim |
| 726-795 | `### Agent Cards (transparency layer)` (Plan Cards, Status Line, Result Cards, Token budget; `## Team:` 735 and `## Results` 772 are inside card code blocks) | `reprompter-team/SKILL.md` | Verbatim |
| 796-837 | `### Phase 2: Repromptverse prompt pack (~2 minutes)` (+ `#### Reprompt quality scorecard`; `## Reprompt Quality` 822 is inside a code block) | `reprompter-team/SKILL.md` | Verbatim |
| 838-843 | `### Phase 3: Execute` (intro + Status Line note) | `reprompter-team/SKILL.md` | Verbatim; followed by an added pointer to `references/runtime-options.md` |
| 844-870 | `#### Runtime auto-pick (default behaviour — do this first)` (incl. Grok Option F data-egress consent gate) | `reprompter-team/references/runtime-options.md` | Verbatim (844-959 copied as one block); moved out to keep `reprompter-team/SKILL.md` < 20 KB; auto-pick order + consent gate summarized in the pointer |
| 871-908 | `#### Tool-schema guard (all options)` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 909-945 | `#### Option A: tmux (Claude Code)` (`#` lines 912-942 are bash comments) | `reprompter-team/references/runtime-options.md` | Verbatim |
| 946-959 | `#### Critical tmux rules` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 960-986 | `### Phase 4: Evaluate + retry` | `reprompter-team/SKILL.md` | Verbatim (960-996 copied as one block) |
| 987-996 | `### Expected cost & time` | `reprompter-team/SKILL.md` | Verbatim |
| 997-1044 | `#### Option B: TeamCreate (Claude Code native)` (`#` lines 1002-1037 are code comments) | `reprompter-team/references/runtime-options.md` | Verbatim (997-1286 copied as one block, after 844-959) |
| 1045-1052 | `#### Option C: sessions_spawn (OpenClaw only)` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 1053-1185 | `#### Option D: Codex CLI` (`#` lines 1114-1156 are shell comments) | `reprompter-team/references/runtime-options.md` | Verbatim; `references/runtime/*.md` copied to `reprompter-team/references/runtime/` |
| 1186-1203 | `#### Option H: Claude dynamic Workflow tool` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 1204-1279 | `#### Option G: Hermes Agent` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 1280-1286 | `#### Option E: Sequential (any LLM)` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 1328-1342 | `## Advanced: Reverse Reprompter` / `### TL;DR` | `reprompter-reverse/SKILL.md` | Verbatim (1328-1493 copied as one block); `references/reverse-template.md` copied alongside |
| 1343-1351 | `### Trigger words` | `reprompter-reverse/SKILL.md` | Verbatim; also used for the skill's frontmatter `description` |
| 1352-1364 | `### Process` (Reverse) | `reprompter-reverse/SKILL.md` | Verbatim |
| 1365-1380 | `### Generate after analysis` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1381-1398 | `### Extraction Card (transparency layer)` (`## Reverse Extraction` at 1386 is the card's title inside its markdown code block, not a real section) | `reprompter-reverse/SKILL.md` | Verbatim |
| 1399-1426 | `### Criteria extraction from exemplars` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1427-1442 | `### Exemplar types supported` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1443-1464 | `### Flywheel integration` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1465-1476 | `### Inspiration: Extraktor pattern` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1477-1493 | `### Token budget` (Reverse) | `reprompter-reverse/SKILL.md` | Verbatim |
| 1495-1572 | `## Deliver via headless-relay (post-output step)` | `reprompter-goal-workflow/SKILL.md` | Verbatim, after a `---` separator |
| 1847-1871 | `## Settings (for Repromptverse mode)` | `reprompter-team/references/settings.md` | Verbatim (1847-1937 copied as one block) |
| 1872-1908 | `### Codex CLI` (`# ~/.codex/config.toml` at 1877 is a TOML comment) | `reprompter-team/references/settings.md` | Verbatim |
| 1909-1937 | `### Hermes Agent` | `reprompter-team/references/settings.md` | Verbatim |
| 2015-2046 | `## Hermes Agent Support (Additive Section — Zero Impact on Claude, Codex, OpenClaw, Grok)` | `reprompter-team/references/hermes-grok-support.md` | Verbatim (2015-2086 copied as one block) |
| 2047-2086 | `## Grok CLI Support (Additive Section — Zero Impact on Claude, Codex, OpenClaw, Hermes)` | `reprompter-team/references/hermes-grok-support.md` | Verbatim |

Extra copies made so in-file paths resolve:
- `reprompter-goal-workflow/references/runtime/claude-workflow-runtime.md` (named by the Workflow script section).
- `reprompter-improve/references/runtime/claude-workflow-runtime.md` (named by the `workflow-template.md` chunk 1 copied into `reprompter-improve/references/`).
- `reprompter-oneshot/references/ui-template.md` (named by the One-Shot design-loop section).

Copies that intentionally differ from their root file are listed in `DIVERGED-COPIES`, each with the edit to re-apply when its root file changes.

`scripts/...` paths named in the copied text (`scripts/intent-router.js`, `scripts/run-supervisor.js`, `scripts/validate-tool-refs.js`, ...) resolve to `reprompter/scripts/`, a copy of the Claude plugin's runtime bundle (`plugin/skills/reprompter/scripts/`: same files, tests excluded). Mode skills reach them as `../reprompter/scripts/<name>`; `verify-split.sh` checks every referenced script and local `require()` exists. `npm run` commands still need the full repo checkout.

Lines not listed (19, 23-25, 46, 57-59, 359, 371, 385, 405, 418, 431, 447, 458, 471, 501, 534, 581, 589, 594-596, 1287, 1325-1327, 1494, 1573, 1600, 1604, 1608-1610, 1619-1621, 1769, 1844-1846, 1938-1940, 1968-1970, 1978-1980, 1984-1986, 2014) are blank lines or `---` separators; `verify-split.sh` confirms every non-blank root line is present somewhere under `skills/`.
