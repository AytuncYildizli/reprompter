# SPLIT-MAP — root `SKILL.md` (v13.1.0, 2071 lines) → `grokbot-plugin/`

Each row maps a root `SKILL.md` heading (line number) to where its text now lives. Paths are relative to `grokbot-plugin/skills/`. "Verbatim" means the line range was copied unchanged with `sed -n 'A,Bp'`. The only edits are added pointer lines and plugin-local headers.

Status: every root heading is placed (chunk 1 + chunk 2). Run `bash grokbot-plugin/verify-split.sh` to check that every non-blank body line of root `SKILL.md` appears in some file under `skills/` and that relative links and backticked `references/` / `../` paths resolve.

## Placed (chunk 1)

| Root lines | Root heading | New location | Notes |
|---|---|---|---|
| 1-18 | YAML frontmatter (name, description, compatibility, metadata) | `reprompter/references/original-frontmatter.md` | Verbatim in a yaml fence. Trigger list also kept verbatim in `reprompter/SKILL.md` frontmatter `description`. |
| 20-22 | `# RePrompter v13.1.0` + tagline | `reprompter/SKILL.md` | Verbatim |
| 26-45 | `## Two intents` | `reprompter/SKILL.md` | Verbatim |
| 47-54 | `## Don't use when` | `reprompter/SKILL.md` | Verbatim |
| 358-368 | `## Intent: Improve (Single prompt)` / `### Shape decision (specifiability router)` | `reprompter-improve/SKILL.md` | Verbatim |
| 370-382 | `### Process` | `reprompter-improve/SKILL.md` | Verbatim |
| 384-402 | `#### Flywheel bias injection (v3 read-path)` | `reprompter-improve/references/flywheel-bias.md` | Verbatim; summary stub in `reprompter-improve/SKILL.md` |
| 404-415 | `#### Fleet sync (v12.14 privacy boundary)` | `reprompter-improve/references/flywheel-bias.md` | Verbatim |
| 417-428 | `### Generate after interview` | `reprompter-improve/SKILL.md` | Verbatim |
| 430-444 | `### Interview questions` | `reprompter-improve/SKILL.md` | Verbatim |
| 446-455 | `### Single mode pattern pack (Microsoft-inspired)` | `reprompter-improve/SKILL.md` | Verbatim |
| 457-468 | `### Auto-detect complexity` | `reprompter-improve/SKILL.md` | Verbatim |
| 470-498 | `### Quick mode` (+ `#### ⚠️ Force interview signals`, `#### Enable Quick Mode`) | `reprompter-improve/SKILL.md` | Verbatim |
| 500-530 | `### Task types & templates` | `reprompter-improve/SKILL.md` | Verbatim; all 19 templates + `outcome-schema.md` + `patterns/` copied to `reprompter-improve/references/` so `references/{type}-template.md` resolves |
| 532-577 | `### Base XML structure` | `reprompter-improve/SKILL.md` | Verbatim |
| 579-585 | `### Project context detection` | `reprompter-improve/SKILL.md` | Verbatim |
| 587-590 | `### After the final prompt` | `reprompter-improve/SKILL.md` | Verbatim; pointer line added to `reprompter-goal-workflow/SKILL.md` for the headless-relay step |
| 1285-1310 | `## Intent: Build (One-Shot)` | `reprompter-oneshot/SKILL.md` | Verbatim; `references/oneshot-template.md` copied alongside (also in `reprompter-improve/references/`, used by the specifiability router) |
| 1560-1585 | `## Quality scoring` | `reprompter-improve/SKILL.md` | Verbatim; brief summary in `reprompter/SKILL.md` |
| 1587-1589 | `### Emphasis calibration` | `reprompter-improve/SKILL.md` | Verbatim |
| 1591-1593 | `### Context altitude and budget` | `reprompter-improve/SKILL.md` | Verbatim |
| 1597-1604 | `## Closed-loop quality (v6.0+)` | `reprompter-improve/SKILL.md` | Verbatim; brief summary in `reprompter/SKILL.md` |
| 1608-1754 | `## Advanced features` (Reasoning-friendly prompting, Response prefilling, Context engineering, Capability policy routing, Budgeted layered context, Strict artifact gate, Runtime feature flags, Version self-check, Plugin migration nudge, Telemetry and observability, Prompt Flywheel (+ user guidance, A/B contract), Pattern library, Token budget, Uncertainty handling) | `reprompter/references/advanced-features.md` | Verbatim (shared by all modes) |
| 1756-1828 | `## Ambient Prompt Gate (Claude Code, Codex CLI, and Hermes Agent)` | `reprompter/references/ambient-prompt-gate.md` | Verbatim |
| 1926-1952 | `## Proven results` (Single prompt v6.0, Repromptverse E2E v6.1, Repromptverse vs raw Agent Teams v7.0) | `reprompter/references/proven-results-and-tips.md` | Verbatim |
| 1956-1962 | `## Tips` | `reprompter/references/proven-results-and-tips.md` | Verbatim |
| 1966-1968 | `## Test scenarios` | `reprompter/references/proven-results-and-tips.md` | Verbatim |
| 1972-1998 | `## Appendix: Extended XML tags` | `reprompter-improve/references/extended-xml-tags.md` | Verbatim |

## Placed (chunk 2)

| Root lines | Root heading | New location | Notes |
|---|---|---|---|
| 58-63 | `## Format: /goal command (Improve output)` | `reprompter-goal-workflow/SKILL.md` | Verbatim (58-356 copied as one block) |
| 64-88 | `### Detecting the target runtime` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 89-139 | `### Goal Command Card` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 140-164 | `### Runtime-specific operational notes` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 165-211 | `### Setup check` (/goal; includes the `# Expect ...` shell comments at 189-191, 200) | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 212-217 | `## Format: Workflow script (Improve output)` | `reprompter-goal-workflow/SKILL.md` | Verbatim; `references/workflow-template.md` + `references/runtime/claude-workflow-runtime.md` copied alongside |
| 218-221 | `### Compatibility` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 222-228 | `### Runtime detection` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 229-238 | `### Process` (Workflow) | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 239-343 | `### Workflow Command Card` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 344-347 | `### Schema-truth + parent-written mirror` | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 348-356 | `### Setup check` (Workflow) | `reprompter-goal-workflow/SKILL.md` | Verbatim |
| 594-608 | `## Team execution: Repromptverse (Agent Teams)` / `### TL;DR` | `reprompter-team/SKILL.md` | Verbatim (594-840 copied as one block) |
| 609-631 | `### Repromptverse control plane (Microsoft-inspired)` | `reprompter-team/SKILL.md` | Verbatim; `repromptverse`, `swarm`, `team-brief`, `{engineering,marketing,ops,research}-swarm` templates + `outcome-schema.md` copied to `reprompter-team/references/` |
| 632-642 | `### Phase 1: Team plan (~45 seconds)` | `reprompter-team/SKILL.md` | Verbatim |
| 643-722 | `### Dimension Interview (Repromptverse only)` (Trigger logic, Dimension-to-question mapping, Skip/dismiss handling, Interview output; `#` comments at 652-656 are inside a code block) | `reprompter-team/SKILL.md` | Verbatim |
| 723-792 | `### Agent Cards (transparency layer)` (Plan Cards, Status Line, Result Cards, Token budget; `## Team:` 732 and `## Results` 769 are inside card code blocks) | `reprompter-team/SKILL.md` | Verbatim |
| 793-834 | `### Phase 2: Repromptverse prompt pack (~2 minutes)` (+ `#### Reprompt quality scorecard`; `## Reprompt Quality` 819 is inside a code block) | `reprompter-team/SKILL.md` | Verbatim |
| 835-840 | `### Phase 3: Execute` (intro + Status Line note) | `reprompter-team/SKILL.md` | Verbatim; followed by an added pointer to `references/runtime-options.md` |
| 841-867 | `#### Runtime auto-pick (default behaviour — do this first)` (incl. Grok Option F data-egress consent gate) | `reprompter-team/references/runtime-options.md` | Verbatim (841-956 copied as one block); moved out to keep `reprompter-team/SKILL.md` < 20 KB; auto-pick order + consent gate summarized in the pointer |
| 868-905 | `#### Tool-schema guard (all options)` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 906-942 | `#### Option A: tmux (Claude Code)` (`#` lines 909-939 are bash comments) | `reprompter-team/references/runtime-options.md` | Verbatim |
| 943-956 | `#### Critical tmux rules` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 957-983 | `### Phase 4: Evaluate + retry` | `reprompter-team/SKILL.md` | Verbatim (957-993 copied as one block) |
| 984-993 | `### Expected cost & time` | `reprompter-team/SKILL.md` | Verbatim |
| 994-1041 | `#### Option B: TeamCreate (Claude Code native)` (`#` lines 999-1034 are code comments) | `reprompter-team/references/runtime-options.md` | Verbatim (994-1283 copied as one block, after 841-956) |
| 1042-1049 | `#### Option C: sessions_spawn (OpenClaw only)` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 1050-1182 | `#### Option D: Codex CLI` (`#` lines 1111-1153 are shell comments) | `reprompter-team/references/runtime-options.md` | Verbatim; `references/runtime/*.md` copied to `reprompter-team/references/runtime/` |
| 1183-1200 | `#### Option H: Claude dynamic Workflow tool` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 1201-1276 | `#### Option G: Hermes Agent` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 1277-1283 | `#### Option E: Sequential (any LLM)` | `reprompter-team/references/runtime-options.md` | Verbatim |
| 1314-1328 | `## Advanced: Reverse Reprompter` / `### TL;DR` | `reprompter-reverse/SKILL.md` | Verbatim (1314-1479 copied as one block); `references/reverse-template.md` copied alongside |
| 1329-1337 | `### Trigger words` | `reprompter-reverse/SKILL.md` | Verbatim; also used for the skill's frontmatter `description` |
| 1338-1350 | `### Process` (Reverse) | `reprompter-reverse/SKILL.md` | Verbatim |
| 1351-1366 | `### Generate after analysis` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1367-1384 | `### Extraction Card (transparency layer)` (`## Reverse Extraction` at 1372 is the card's title inside its markdown code block, not a real section) | `reprompter-reverse/SKILL.md` | Verbatim |
| 1385-1412 | `### Criteria extraction from exemplars` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1413-1428 | `### Exemplar types supported` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1429-1450 | `### Flywheel integration` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1451-1462 | `### Inspiration: Extraktor pattern` | `reprompter-reverse/SKILL.md` | Verbatim |
| 1463-1479 | `### Token budget` (Reverse) | `reprompter-reverse/SKILL.md` | Verbatim |
| 1481-1558 | `## Deliver via headless-relay (post-output step)` | `reprompter-goal-workflow/SKILL.md` | Verbatim, after a `---` separator |
| 1832-1856 | `## Settings (for Repromptverse mode)` | `reprompter-team/references/settings.md` | Verbatim (1832-1922 copied as one block) |
| 1857-1893 | `### Codex CLI` (`# ~/.codex/config.toml` at 1862 is a TOML comment) | `reprompter-team/references/settings.md` | Verbatim |
| 1894-1922 | `### Hermes Agent` | `reprompter-team/references/settings.md` | Verbatim |
| 2000-2031 | `## Hermes Agent Support (Additive Section — Zero Impact on Claude, Codex, OpenClaw, Grok)` | `reprompter-team/references/hermes-grok-support.md` | Verbatim (2000-2071 copied as one block) |
| 2032-2071 | `## Grok CLI Support (Additive Section — Zero Impact on Claude, Codex, OpenClaw, Hermes)` | `reprompter-team/references/hermes-grok-support.md` | Verbatim |

Extra copies made so in-file paths resolve:
- `reprompter-goal-workflow/references/runtime/claude-workflow-runtime.md` (named by the Workflow script section).
- `reprompter-improve/references/runtime/claude-workflow-runtime.md` (named by the `workflow-template.md` chunk 1 copied into `reprompter-improve/references/`).

`scripts/...` paths named in the copied text (`scripts/intent-router.js`, `scripts/run-supervisor.js`, `scripts/validate-tool-refs.js`, ...) resolve to `reprompter/scripts/`, a copy of the Claude plugin's runtime bundle (`plugin/skills/reprompter/scripts/`: same files, tests excluded). Mode skills reach them as `../reprompter/scripts/<name>`; `verify-split.sh` checks every referenced script and local `require()` exists. `npm run` commands still need the full repo checkout.

Lines not listed (19, 23-25, 46, 55-57, 357, 369, 383, 403, 416, 429, 445, 456, 469, 499, 531, 578, 586, 591-593, 1284, 1311-1313, 1480, 1559, 1586, 1590, 1594-1596, 1605-1607, 1755, 1829-1831, 1923-1925, 1953-1955, 1963-1965, 1969-1971, 1999) are blank lines or `---` separators; `verify-split.sh` confirms every non-blank body line is present somewhere under `skills/`.
