---
name: reprompter-team
description: |
  RePrompter team execution (Repromptverse / Agent Teams) — score the raw task, plan a 2-5 agent team, write a reprompted prompt per agent, run it on the detected runtime (Grok CLI, Hermes, Claude Code TeamCreate/Workflow/tmux, OpenClaw, Codex, or sequential), then evaluate and retry.
  Use when: "repromptverse", "reprompter teams", "smart run", "smart agents", "run with quality", "engineering/ops/research/marketing swarm", multi-agent tasks, audits, "parallel", tasks spanning 2+ systems; or a Build (One-Shot) brief the user wants "split across a team".
  Don't use for single-prompt improvement (use reprompter-improve), simple Q&A, or casual chat.
  Outputs: optional team brief + per-agent prompts + Agent Cards (Plan/Status/Result) + reprompt quality scorecard + final synthesis.
  Target score: per-agent >= 8/10.
---

# RePrompter — Team execution (Repromptverse)

> Mode skill of the `reprompter` plugin. Entry/routing: `../reprompter/SKILL.md`. Content below is verbatim from root SKILL.md lines 594-840 and 957-993. Phase 3 runtime detail (root lines 841-956 and 994-1283: runtime auto-pick, tool-schema guard, Options A-H) is in `references/runtime-options.md`; Settings (root 1832-1922) is in `references/settings.md`; Hermes Agent and Grok CLI support (root 2000-2071) is in `references/hermes-grok-support.md`. Templates (`repromptverse`, `swarm`, `team-brief`, `*-swarm`), `outcome-schema.md` and `references/runtime/*.md` are copied alongside. `scripts/<name>` paths resolve to the bundled `../reprompter/scripts/<name>` (e.g. `node ../reprompter/scripts/run-supervisor.js`).
>
> **Required reading:** `../reprompter/references/advanced-features.md` (capability routing, layered context, artifact gate, flags, telemetry, Flywheel). The always-on rules in `../reprompter/SKILL.md` → "Core shared rules" (context check, uncertainty permission, WHAT not HOW) apply to every per-agent prompt.

## Team execution: Repromptverse (Agent Teams)

### TL;DR

```
Raw task in → quality output out. Every agent gets a reprompted prompt.

Phase 1: Score raw prompt, dimension interview if needed, plan team, show Agent Cards (YOU do this, ~45s)
Phase 2: Write XML-structured prompt per agent (YOU do this, ~2min)
Phase 3: Launch agents (tmux, TeamCreate, Workflow tool, sessions_spawn, Codex, or sequential) (AUTOMATED)
Phase 4: Show Result Cards, score, retry if needed (YOU do this)
```

**Key insight:** The reprompt phase costs ZERO extra tokens — YOU write the prompts, not another AI.

### Repromptverse control plane (Microsoft-inspired)

Every multi-agent run must include:

1. **Routing policy** — who speaks next and why (selector-style routing for non-trivial teams)
2. **Termination policy** — max turns, max wall time, and no-progress stop condition
3. **Artifact contract** — one writer per output file, fixed schema for handoffs
4. **Evaluator loop** — score each artifact, retry only with delta prompts (max 2 retries)

Use `references/repromptverse-template.md` to enforce this contract.

Domain profile auto-load rules (lazy-load, on demand):

- Marketing intent (`campaign`, `launch`, `growth`, `seo`, `content calendar`, `funnel`) -> `references/marketing-swarm-template.md`
- Engineering intent (`architecture`, `feature delivery`, `refactor`, `migration`, `test coverage`) -> `references/engineering-swarm-template.md`
- Ops intent (`incident`, `uptime`, `gateway`, `latency`, `cron`, `slo`, `health`) -> `references/ops-swarm-template.md`
- Research intent (`benchmark`, `compare`, `tradeoff`, `analysis`, `research`) -> `references/research-swarm-template.md`

Then merge with `references/repromptverse-template.md` for routing/termination/evaluation contract and add task-specific constraints.

Canonical implementation for deterministic routing lives in `scripts/intent-router.js`.
If docs and code ever diverge, the script is the source of truth for benchmark/testing paths.

### Phase 1: Team plan (~45 seconds)

1. **Score raw prompt** (1-10): Clarity, Specificity, Structure, Constraints, Decomposition
   - Phase 1 uses 5 quick-assessment dimensions. The full 6-dimension scoring (adding Verifiability) is used in Phase 4 evaluation.
2. **Dimension Interview gate** — check which askable dimensions scored < 5 (see Dimension Interview section below). In autonomous or batch-destined runs, prefer documented assumptions over blocking questions when a reasonable default exists.
3. **Pick mode:** parallel (independent agents) or sequential (pipeline with dependencies)
4. **Define team:** 2-5 agents max, each owns ONE domain, no overlap (informed by interviewContext if interview ran)
5. **Show Plan Cards** (see Agent Cards section below)
6. **User confirmation gate** — "Team plan ready. Proceed to execution?" User can approve, adjust, or cancel. In automated/batch runs, auto-proceed.
7. **Write team brief** to `/tmp/rpt-brief-{taskname}.md` (use unique tasknames to avoid collisions; includes interviewContext section if interview ran)

### Dimension Interview (Repromptverse only)

Score-driven interview for Repromptverse mode. Distinct from Single mode's "Smart Interview" (which uses a standard question list). The Dimension Interview derives questions from low-scoring raw prompt dimensions.

#### Trigger logic

```
scores = score_raw_prompt(rawInput)  # 5 dimensions from step 1

# Structure is EXCLUDED — reprompter fixes structure via templates.
# Only 4 dimensions are interview-eligible:
askable = [d for d in scores if d.name != "Structure" and d.value <= 5]

# Threshold: less-than-or-equal. Scores of 5 ARE borderline and trigger questions.
if len(askable) == 0:
    SKIP interview → proceed to step 3 (pick mode)
elif len(askable) <= 2:
    ASK 1-2 questions (one per low dimension)
else:
    ASK 3-4 questions (max 4, prioritized by lowest score first)
```

#### Dimension-to-question mapping

| Dimension | Score < 5 triggers | Question approach |
|-----------|-------------------|-------------------|
| **Clarity** | Task is ambiguous or multi-interpretable | Open-ended with dynamic options extracted from prompt keywords |
| **Specificity** | Scope is vague, no concrete targets | Dynamic options from prompt keywords + top-level directory names |
| **Constraints** | No boundaries defined | "Any areas to exclude?" with context-aware options |
| **Decomposition** | Unclear work split | "How many independent streams?" with suggested splits |

**Question rules:**
- Use `AskUserQuestion` with clickable options (consistent with Single mode)
- Options are **dynamic**: extracted from prompt keywords + codebase context (config files + top-level dirs only — no deep analysis)
- Every question includes a free-text escape hatch option
- Priority order: lowest scoring dimension first
- Language follows user's input language

#### Skip/dismiss handling

- User skips all questions → proceed with empty interviewContext. Plan Cards note: "Interview: skipped by user"
- User answers some, skips others → populate only answered fields

#### Interview output (interviewContext)

Responses merge into an interviewContext written to the team brief file:

```
interviewContext = {
  scope: [from Specificity answer],
  excludes: [from Constraints answer],
  successCriteria: [from answers, or omitted — Phase 2 derives from requirements],
  taskClarification: [from Clarity answer, if asked]
}
```

When `successCriteria` is not gathered (question not asked or user skipped), omit the field. Phase 2 derives success criteria from requirements as it does today.

For autonomous execution lanes, record safe defaults in the generated prompt instead of asking low-value clarification questions:

```xml
<assumptions>
- Scope defaults to the files and systems named or strongly implied by the request.
- Excludes default to unrelated refactors, new dependencies, and destructive production changes.
- Verification defaults to the smallest local checks that prove the requested outcome.
</assumptions>
```

The user can veto or edit these assumptions before execution. Interactive Single mode still asks when ambiguity changes the requested outcome.

**How interviewContext feeds into later phases:**
- **Agent count and roles** — scope determines which agents are created
- **Per-agent `<constraints>`** — excludes injected into each agent's prompt
- **Per-agent `<success_criteria>`** — user expectations propagated
- **Template selection** — clarified task type may route to a different swarm profile

**Precedence:** Interview responses override auto-detected codebase context. Conflicts noted in Plan Cards.

**Flywheel:** interviewContext is excluded from recipe fingerprint hash. The fingerprint captures strategy (template + patterns + tier), not user scope answers.

### Agent Cards (transparency layer)

Three fixed-format card types rendered at different phases. Templates are exact — do not invent new formats.

#### Plan Cards — rendered at end of Phase 1 (step 5)

After team plan is complete, before Phase 2 prompt writing. Use this exact table format:

```markdown
## Team: {N} Opus Agents ({Parallel|Sequential})

| # | Agent | Scope | Excludes | Output |
|---|-------|-------|----------|--------|
| 1 | {role} | {scope} | {excludes or "-"} | {output path} |
| 2 | {role} | {scope} | {excludes or "-"} | {output path} |

Interview context applied: {summary of influence, including override conflicts, or "No interview (high-quality prompt)", or "Interview: skipped by user"}
```

**Rules:**
- Render before any agent is launched
- If interview ran, show which constraints came from interview vs auto-detected
- If user requests agent adjustments at confirmation gate, re-render Plan Cards with updated team
- Single-agent runs: table renders with one row (valid)

#### Status Line — rendered during Phase 3 polling

Compact one-line status with each poll cycle:

```
Agents: ✅ 2/4  ⏳ 1/4  🔄 1/4 (retry 1)
```

**Emoji mapping:** ✅ = completed, ⏳ = in-progress, 🔄 = retrying

**Rules:**
- Replace verbose poll output with this compact format
- Platform-dependent: TeamCreate uses TaskList status; tmux uses best-effort pane parsing; sequential is trivial
- Show retry count for retrying agents
- Each poll cycle MAY consult `node scripts/run-supervisor.js --advise --run-id {runId} --json` and fold its verdict into the Status Line. On `stalled`, follow the current Option's stall runbook; on `failing-evals`, begin drafting Phase-4 delta prompts early. The supervisor is advisory and read-only.

#### Result Cards — rendered at start of Phase 4

After reading all agent outputs, before synthesis. Use this exact table format:

```markdown
## Results

| Agent | Score | Findings | Key Insight |
|-------|-------|----------|-------------|
| {role} | {score}/10 {pass/retry emoji} | {count} findings | {one-sentence top finding} |

Total: {N} findings | {accepted}/{total} accepted | {retry_count} retries
```

**Rules:**
- Render before synthesis is written
- "Key Insight" = single most important finding per agent (forces prioritization)
- Retry agents show retry reason in findings column

#### Token budget (Agent Cards + Dimension Interview)

| Phase | Extra tokens | Source |
|-------|-------------|--------|
| Phase 1 (interview) | 100-400 | AskUserQuestion calls (0-4 questions) + option generation from config/directory scan |
| Phase 1 (plan cards) | 100-300 | Table render (varies by team size) |
| Phase 3 (status) | ~20/poll | Compact status line |
| Phase 4 (result cards) | 150-250 | Summary table |
| **Total** | **~400-1000** | **0.5-2% of typical 50K-200K run** |

### Phase 2: Repromptverse prompt pack (~2 minutes)

**Flywheel bias check (optional, read-only):** Same rules as Mode 1 (see "Flywheel bias injection" in Mode 1). When `REPROMPTER_FLYWHEEL_BIAS=1`, run `npm run flywheel:query -- --task-type <team-task-slug>` once for the overall team task before per-agent adaptation. If `confidence ∈ {"medium", "high"}` with `sampleCount >= 3`, prefer the recommended `templateId`/`patterns` as the team-wide starting point; each agent still picks its own role-specific template on top. Announce the bias decision once at the start of Phase 2, not per agent, to keep the output readable. Per-role bias queries are a v3 follow-up once enough role-stamped records exist.

For EACH agent:
1. Pick the best-matching template from `references/` (or use base XML structure)
2. Read it, then apply these **per-agent adaptations**:

- `<role>`: Specific expert title for THIS agent's domain
- `<context>`: Add exact file paths (verified with `ls`), what OTHER agents handle (boundary awareness)
- `<requirements>`: At least 5 specific, independently verifiable requirements
- `<constraints>`: Scope boundary with other agents, read-only vs write, file/directory boundaries
- `<output_format>`: Exact path `/tmp/rpt-{taskname}-{agent-domain}.md`, required sections
- `<success_criteria>`: use the v1 structured shape (same as Mode 1) — see `references/outcome-schema.md`. Include 3–6 `<criterion>` entries scoped to **this agent's artifact** (not the whole team's output). Each criterion has `id`, `verification_method` (`rule` | `llm_judge` | `manual`), a one-sentence `<description>`, and an inline `<rule>` or `<judge_prompt>` per the method. Bullet-list placeholders in the template files are acceptable scaffolding but the generated per-agent prompt upgrades them to the structured form.

**Score each prompt — target 8+/10.** If under 8, add more context/constraints.

Write all to `/tmp/rpt-agent-prompts-{taskname}.md`

**Flywheel hook (per-agent):** after Phase 3 execution, each agent's artifact at `/tmp/rpt-{taskname}-{agent-domain}.md` can be recorded separately with `scripts/outcome-record.js --role <agent-name>` (one record per agent, `mode="repromptverse"`, and `--role` set to the teammate's name so the flywheel bridge uses it as the `domain` when building the recipe fingerprint). Score each record with `scripts/evaluate-outcome.js`. Without `--role`, all agents on the same `task_type` collapse into the same recipe bucket and the strategy learner can't tell which roles consistently win vs struggle — so always pass it for Repromptverse records.

#### Reprompt quality scorecard (mandatory)

After writing all agent prompts, show the before/after comparison so the user sees the improvement:

```markdown
## Reprompt Quality

| Metric | Raw prompt | After reprompt | Change |
|--------|-----------|----------------|--------|
| Overall | {raw}/10 | {after}/10 | +{pct}% |
| Per-agent avg | - | {avg}/10 | - |
| Agents | - | {N} | - |

Raw prompt scored {raw}/10. After reprompting, each agent prompt scores {min}-{max}/10 (avg {avg}/10).
```

**Rules:**
- Render after Phase 2 prompt generation, before Phase 3 execution
- Shows the user exactly how much reprompter improved their input
- If any agent prompt scores < 8, note which ones and what was added to fix them

### Phase 3: Execute

Phase 3 has platform-specific execution methods. The reprompted prompts from Phase 2 work with any method — you just need to pick which one to run. In most runs you should not ask the user; auto-pick below and announce the decision so they can redirect if they want. (One exception: **Grok Option F inside a git repo** — get the user's explicit consent first, per the data-egress consent gate under the table below.)

**Status Line (all platforms):** During polling, show compact agent status with each cycle. See Agent Cards section for format.

**Runtime auto-pick, tool-schema guard, and Options A-H:** read `references/runtime-options.md` before launching. Auto-pick order: F Grok CLI → G Hermes → B TeamCreate → H Workflow tool → C OpenClaw → A tmux → D Codex → E sequential; it also holds the Grok Option F data-egress consent gate (get explicit consent before running Option F inside a git repo).

### Phase 4: Evaluate + retry

Before deciding retries, MAY consult `node scripts/run-supervisor.js --advise --run-id {runId} --json`; use its advisory verdict as context, not as actuation.

1. Read each agent's report
2. Score against success criteria from Phase 2:
   - 8+/10 → ACCEPT
   - 4-6/10 → RETRY with delta prompt (tell them what's missing)
   - < 4/10 → RETRY with full rewrite
   
   **Accept checklist** (use alongside score — all must pass):
   - [ ] All required output sections present
   - [ ] Requirements from Phase 2 independently verifiable
   - [ ] No hallucinated file paths or line numbers
   - [ ] Scope boundaries respected (no overlap with other agents)
3. Max 2 retries (3 total attempts)
4. **Show Result Cards** — render summary table before synthesis (see Agent Cards section for format)
5. Deliver final report to user

**Delta prompt pattern:**
```
Previous attempt scored 5/10.
✅ Good: Sections 1-3 complete
❌ Missing: Section 4 empty, line references wrong
This retry: Focus on gaps. Verify all line numbers.
```

### Expected cost & time

| Team size | Time | Cost |
|-----------|------|------|
| 2 agents | ~5-8 min | ~$1-2 |
| 3 agents | ~8-12 min | ~$2-3 |
| 4 agents | ~10-15 min | ~$2-4 |

Estimates cover Phase 3 (execution) only. Add ~3 minutes for Phases 1-2 and ~5-8 minutes per retry. Each agent uses ~25-70% of their 200K token context window.

