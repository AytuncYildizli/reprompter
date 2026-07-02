---
name: reprompter
description: |
  Transform rough prompts into structured, high-scoring prompts for coding agents.
  Use when: "reprompt", "clean up this prompt", "before /goal", "Codex /goal", "Claude Code /goal", "Hermes /goal", "repromptverse", "reprompter teams", "smart run", "engineering/ops/research/marketing swarm", "compile to workflow", "workflow preflight", "dynamic workflow", multi-agent tasks, audits, parallel work, "reverse reprompt", "prompt dna", "extract prompt from".
  Don't use for simple Q&A, casual chat, or execution-only tasks.
  Outputs: structured XML/Markdown prompt + before/after score; /goal command card (Codex/Claude Code/Hermes); optional team brief + per-agent prompts + Agent Cards; Reverse Extraction Card; Workflow Command Card + runnable .workflow.js (Workflow preflight lane / Option H).
  Target score: Single and Goal preflight >= 7/10; Repromptverse per-agent >= 8/10; Reverse >= 7/10.
compatibility: |
  Single mode works on Claude surfaces, OpenClaw, Codex, Grok CLI, and Hermes Agent.
  `/goal` preflight mode works on Codex CLI (any version exposing the `goals` feature), Claude Code CLI v2.1.139+, and Hermes Agent; all three runtimes accept the same `/goal <objective>` shape. Disabled on Claude surfaces without `/goal` support, OpenClaw, and Grok CLI.
  Repromptverse mode supports Claude Code (TeamCreate or tmux → Option B/A), OpenClaw (sessions_spawn → Option C), Codex CLI (native subagents or `codex exec` → Option D), Grok CLI 4.3+ (spawn_subagent F1 or `grok -p` F2 → Option F), and Hermes Agent (delegate_task G1, shell-level G2, Kanban G3 → Option G). Sequential fallback (Option E) works with any LLM runtime.
  Workflow preflight lane + Repromptverse Option H target Claude Code's dynamic `Workflow` tool (JS-scripted background fan-out with schema-validated returns and resume); additive, detected by tool presence, with first-class ultracode.
metadata:
  author: AytuncYildizli
  version: 12.9.0
---

# RePrompter v12.9.0

> **Your prompt sucks. Let's fix that.** Single prompts, `/goal` preflight, full agent teams, reverse-engineer from great outputs, or compile to a Claude dynamic Workflow — one skill, five output lanes. **v12.6.0 added the Workflow preflight lane + Repromptverse Option H (Claude dynamic Workflow tool) with first-class ultracode; v12.7.0 adds a fail-soft version self-check that warns when copy-based installs are behind; v12.8.0 adds an ambient prompt gate for Claude Code UserPromptSubmit hooks; v12.9.0 ships RePrompter as a Claude Code plugin with skill + hook auto-registration. All prior Claude Code, Codex, OpenClaw, Grok CLI, and Hermes behavior is preserved.**

---

## Five output lanes

| Lane | Trigger | What happens |
|------|---------|-------------|
| **Single** | "reprompt this", "clean up this prompt" | Interview → structured prompt → score |
| **`/goal` preflight** | "before /goal", "for /goal", "Codex /goal", "Claude Code /goal", "Hermes /goal", "/goal preflight", "Codex goal prompt" | Codex CLI, Claude Code CLI v2.1.139+, or Hermes Agent: infer user intent → build expanded prompt → compress into exact `/goal <summary of expanded prompt>` command |
| **Repromptverse** | "reprompter teams", "repromptverse", "run with quality", "smart run", "smart agents", "campaign swarm", "engineering swarm", "ops swarm", "research swarm" | Dimension Interview → Plan team → Agent Cards → reprompt each agent → execute → Result Cards → evaluate → retry |
| **Reverse** | "reverse reprompt", "reprompt from example", "learn from this", "extract prompt from", "prompt dna", "prompt genome" | Analyze exemplar → classify → extract prompt DNA → generate XML prompt → score → inject into flywheel |
| **Workflow preflight** | "workflow preflight", "compile to workflow", "build a workflow script", "dynamic workflow", "run via workflow tool", "make a workflow" | Reprompt task → build expanded prompt → compile to a runnable `.workflow.js` (pure-literal `meta`, schema returns, bounded retry; ultracode adds adversarial verify + completeness critic) → emit Workflow Command Card. Also Repromptverse Phase-3 **Option H**. |

Auto-detection: if task mentions 2+ systems, "audit", or "parallel" → ask: "This looks like a multi-agent task. Want to use Repromptverse mode?"

Definition — **2+ systems** means at least two distinct technical domains that can be worked independently. Examples: frontend + backend, API + database, mobile app + backend, infrastructure + application code, security audit + cost audit.

## Don't use when

- User wants a simple direct answer (no prompt generation needed)
- User wants casual chat/conversation
- Task is immediate execution-only with no reprompting step
- Scope does not involve prompt design, structure, or orchestration

> Clarification: RePrompter **does** support code-related tasks (feature, bugfix, API, refactor) by generating better prompts. It does **not** directly apply code changes in Single mode. Direct code execution belongs to coding-agent unless Repromptverse execution mode is explicitly requested.

---

## Lane: `/goal` preflight

When the user mentions `/goal`, `before /goal`, `for /goal`, "Codex /goal", "Claude Code /goal", "Hermes /goal", or asks to improve a goal prompt, run RePrompter before the goal is submitted.

This lane works on **Codex CLI** (any version exposing the `goals` feature), **Claude Code CLI v2.1.139+** (the release that shipped a native `/goal` slash command on 2026-05-11), and **Hermes Agent** (persistent goals documented in the v0.13.0 / 2026.5.7 release). These runtimes accept the same `/goal <objective>` shape, so the compression flow is identical; only the setup check and a few runtime-specific operational notes differ. If the target runtime is Claude surfaces without `/goal` support, OpenClaw, Grok CLI, Gemini, or another LLM, use Single mode or Repromptverse instead; do not emit a `/goal` command for runtimes that have no `/goal` surface.

### Detecting the target runtime

Pick the runtime once, at the start of the lane, and pass it through to the Card:

| User signal | Runtime |
|-------------|---------|
| "Codex /goal", "for Codex /goal", explicit `codex` mention | **Codex CLI** |
| "Claude Code /goal", "/goal in Claude Code", explicit `claude` / `claude-code` mention | **Claude Code CLI (≥ v2.1.139)** |
| "Hermes /goal", "/goal in Hermes", explicit `hermes` / `hermes-agent` mention | **Hermes Agent** |
| Bare "/goal" or "before /goal" with no runtime marker | **ASK** which runtime, with the three options as buttons; default to the user's primary CLI if known from session context |

Process:

1. Treat the input as **Single prompt mode** unless it clearly needs Repromptverse.
2. Detect the target runtime (table above). Carry the runtime label through the rest of the lane.
3. Render the **Goal Command Card** first, with `Runtime` populated from step 2.
4. Infer the user's real intent from the rough prompt: desired outcome, hidden constraint, success signal, and likely risk.
5. Build the rich expanded prompt first, using the normal RePrompter structure: goal/task, context, requirements, constraints, execution notes, and success criteria.
6. Compress that expanded prompt into a dense one-line goal summary. This should feel like a summary of a long XML prompt, not a slightly polished copy of the user's rough sentence. The compression rule is identical across runtimes — both Codex's alpha `/goal` and Claude Code's v2.1.139+ `/goal` consume `<objective>` as a single argument.
7. Generate an exact copy-paste command: `/goal <summary of expanded prompt>`.
8. Do not put the full XML or Markdown document after `/goal`; only the compressed summary belongs in the command.
9. Include the expanded prompt basis after the command so the user can inspect what was compressed or send it as a follow-up normal message after the goal is set.
10. Tell the user to run the exact `/goal <summary of expanded prompt>` command in the runtime chosen at step 2.
11. Do not claim RePrompter can automatically intercept `/goal`; slash commands are user-invoked in both Codex and Claude Code unless the local runtime adds a separate hook.

### Goal Command Card

Both runtimes shape the slash command as `/goal <objective>`. Render this card before the generated command:

| Field | Content |
|-------|---------|
| Goal Command | Exact one-line `/goal <summary of expanded prompt>` command |
| Compressed From | `Expanded RePrompter prompt` |
| Objective | One sentence naming the reprompted intent the runtime should pursue |
| Runtime | `Codex CLI`, `Claude Code CLI (≥ v2.1.139)`, or `Hermes Agent` — whichever was detected in step 2 above |
| Mode | `/goal preflight` |
| Paste Into | Codex TUI prompt, Claude Code TUI prompt, or Hermes TUI prompt, as-is |
| Risk Level | `low` / `medium` / `high`, based on blast radius |
| Missing Inputs | Up to 3 unknowns; write `none` if the prompt is ready |
| Verification | 2-4 checks the agent should run while pursuing the goal |
| Quality | Before score → after score, with the weakest remaining dimension |

Then output:

```text
/goal {dense single-line summary of the expanded prompt}
```

Then show the expanded prompt basis:

```xml
<goal>{specific outcome}</goal>
<context>
- {known repo/runtime/user context}
</context>
<requirements>
- {measurable requirement}
</requirements>
<constraints>
- {boundary or non-goal}
</constraints>
<execution_notes>
- Start with discovery before edits.
- Keep changes scoped and reversible.
- Run the verification checks listed in the Goal Command Card.
</execution_notes>
<success_criteria schema_version="1">
  <criterion id="{kebab-case-id}" verification_method="manual">
    <description>{testable pass condition}</description>
  </criterion>
</success_criteria>
```

### Runtime-specific operational notes

The compression flow is shared, but the two `/goal` surfaces have small behavioral differences worth surfacing in the expanded prompt's `<execution_notes>` block:

**Claude Code CLI (≥ v2.1.139)**:
- `/goal` sets a **thread-level persistent objective** that survives `/resume`, terminal close, and context compaction. Only one goal per session — setting a new `/goal` replaces the previous one.
- After each turn a separate fast evaluator model (Haiku) checks the completion condition against the transcript. If not met, the runtime triggers another turn without user input.
- The evaluator only judges what Claude **surfaces in the transcript**, so the expanded prompt should require the agent to print artifact paths, file contents, or test results — proof must be visible.
- Pause / resume controls: `/goal pause` and `/goal resume` (handy for long-running goals interrupted by ad-hoc work).
- Optional budget constraints (token or wall-clock) prevent runaway costs.
- **`/goal` requires hooks.** When `disableAllHooks` or `allowManagedHooksOnly` is set in `settings.json`, `/goal` is unavailable. v2.1.139 silently hung in this case; v2.1.140 changed the failure mode to a clear error message but did **not** make `/goal` work under those settings. If you operate in a managed environment that blocks hooks, the `/goal` preflight lane cannot run on Claude Code until hooks are permitted — use Single mode in that case.

**Codex CLI**:
- `/goal` is an experimental alpha feature gated by `features.goals = true` in `Codex config file`. The local alpha binary exposes `Usage: /goal <objective>`, `ThreadGoal.objective`, `tokenBudget`, `/goal pause`, `/goal resume`, and `/goal clear`.
- Codex's `/goal` is invoked the same way (`/goal <objective>`), but config-gated — a fresh session is required after enabling.

**Hermes Agent**:
- `/goal` sets a persistent objective that continues across turns until the runtime's goal judge considers it complete, the user pauses/clears it, or the configured turn budget is reached.
- Goal state survives `/resume`, and user messages preempt the continuation loop.
- Useful controls: `/goal status`, `/goal pause`, `/goal resume`, and `/goal clear`.
- Default continuation budget is bounded (`goals.max_turns`, documented default 20), so the expanded prompt should make success criteria and verification visible.
- Hermes supports `/goal` in both CLI and messaging-command surfaces; RePrompter still only emits the copy-paste command and does not intercept slash commands.

The Card's `Risk Level` and `Verification` fields apply equally to all supported `/goal` runtimes.

### Setup check

Pick the block matching the detected runtime.

**Codex CLI**:

```bash
Install or update Codex CLI using the official package manager instructions.
codex features list | grep '^goals'
```

If the feature exists but is disabled, configure:

```toml
[features]
goals = true
```

Then start a fresh Codex session so the slash-command surface reloads.

**Claude Code CLI**:

```bash
claude --version
# Expect "2.1.139" or later. If older, upgrade:
#   Use the official Claude Code installer for your platform.
# or follow the install path you used originally.
```

No config flag is required — `/goal` is enabled by default once Claude Code is at v2.1.139 or later. However, `/goal` depends on Claude Code's hooks layer: if `disableAllHooks` or `allowManagedHooksOnly` is set in `Claude Code settings file`, the command is unavailable on any version. v2.1.139 silently hung in that case; v2.1.140 surfaces a clear error message instead. Upgrading does **not** re-enable `/goal` under hook-blocking settings — permitting hooks is the only way to use `/goal` on Claude Code. Managed environments that block hooks should use Single mode for goal-shaped work.

**Hermes Agent**:

```bash
hermes --version
# Expect a release with persistent goals support (v0.13.0 / 2026.5.7 or later).
```

No feature flag is required for normal `/goal` use. Optional tuning lives in Hermes config:

```toml
[goals]
max_turns = 20
```

---

## Lane: Workflow preflight

When the user says "compile to workflow", "build a workflow script", "workflow preflight", "make a workflow", "run via workflow tool", or "dynamic workflow", reprompt the task and compile it into a runnable Claude dynamic Workflow script. This is the execution-compilation sibling of the `/goal` preflight lane: RePrompter builds the expanded prompt first, then emits a `.workflow.js` the user runs via the `Workflow` tool — RePrompter does not run it.

This lane is the same surface as Repromptverse **Option H**; use this lane when the user wants the compiled script directly, and Option H when Phase 3 auto-picks the Workflow tool during a Repromptverse run.

### Compatibility

Single Claude-native surface: requires the `Workflow` tool in the current toolset. There is no `/goal`-style command — the output is a `Workflow({ scriptPath, args })` invocation. Other runtimes (Codex, Grok, Hermes, OpenClaw) use their own Repromptverse options (D/F/G/C) and the `/goal` preflight lane instead.

### Runtime detection

| Signal | Runtime |
|---|---|
| A tool named `Workflow` is present in the current toolset | **Claude dynamic Workflow tool** — proceed with this lane |
| No `Workflow` tool | Fall back to Repromptverse (Option B/A/etc.) or `/goal` preflight |

### Process

1. Treat the input as a team task. Run `routeIntent` — a workflow-lane trigger returns `mode: "workflow"`.
2. Infer the real intent and build the rich expanded prompt (the XML basis below) with all eight base tags + `<success_criteria>`.
3. Reprompt one prompt per role (each owns ONE domain, no overlap), exactly as Repromptverse Phase 2.
4. Compile to a `.workflow.js` via `the root repository workflow compiler` (`buildWorkflowCommand`): pure-literal `meta`, schema-validated `agent()` returns, `parallel()`/`pipeline()` per the H1/H2 heuristic, `runId`/`taskname` from `args`, `model` omitted, `filter(Boolean)`, bounded delta-retry (max 2/role).
5. Render the **Workflow Command Card** first, then the emitted script, then the expanded-prompt basis.
6. High-risk forbidden surfaces (prod/auth/secret/...) block emission — set `blocked: true`, `script: null`. There is **no in-tool override**; rescope the task (remove the high-risk surface) to compile a script. Same block-gate as `/goal`.
7. Tell the user to run `Workflow({ scriptPath, args })`; resume an interrupted run with `resumeFromRunId` (cached `agent()` prefix short-circuits).

### Workflow Command Card

| Field | Content |
|---|---|
| Workflow Command | Exact `Workflow({ scriptPath, args: { taskname, runId } })` invocation |
| Compiled From | `Expanded RePrompter prompt` |
| Objective | One sentence naming the reprompted intent |
| Runtime | `Claude dynamic Workflow tool` |
| Mode | `Workflow preflight` |
| Paste Into | `Workflow tool (scriptPath + args), as-is` |
| Script Path | `/tmp/reprompter-workflow/rpt-{taskname}.workflow.js` |
| Execution Pattern | `parallel fan-out + bounded delta-retry` (ultracode: `+ adversarial verify + completeness critic`) |
| Budget | directive total / `inherit` / `none` |
| Risk Level | `low` / `medium` / `high` |
| Missing Inputs | Up to 3 unknowns, or `none` |
| Verification | 2-4 checks the run should surface (per-role scores, missing roles) |
| Quality | Before score → after score |

Then output the emitted script:

```js
export const meta = {
  name: "rpt-{taskname}",
  description: "{one-line objective}",
  phases: [
    { title: "Plan" },
    { title: "Execute" },
    { title: "Evaluate" },
  ],
}

const taskname = (args && args.taskname) || "{taskname}"   // bare fallback == command args; only meta.name is prefixed (resume id stability)
const runId = (args && args.runId) || taskname

const FINDINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["role", "findings", "self_score"],
  properties: {
    role: { type: "string" },
    findings: { type: "array", items: { type: "string" } },
    self_score: { type: "integer", minimum: 1, maximum: 10 },
  },
}

const AGENTS = [ /* one reprompted prompt per role; model omitted */ ]

phase("Plan")
log(`Workflow ${runId}: dispatching ${AGENTS.length} reprompted agents`)

phase("Execute")
const results = (await parallel(
  AGENTS.map((a) => () => agent(a.prompt, { label: a.label, phase: "Execute", schema: FINDINGS_SCHEMA }))
)).filter(Boolean)

phase("Evaluate")
const ACCEPT = 8
const final = []
for (const r of results) {
  let current = r, attempts = 0
  while (current && current.self_score < ACCEPT && attempts < 2) {
    attempts += 1
    current = await agent(`Previous ${current.role} attempt scored ${current.self_score}/10 (need ${ACCEPT}). Fix the gaps; return the improved structured result.`,
      { label: `retry:${current.role}`, phase: "Evaluate", schema: FINDINGS_SCHEMA })
  }
  if (current) final.push(current)
}

return {
  schema_version: "reprompter.workflow_outcome.v1",
  runId, taskname,
  results: final,
  missing: AGENTS.length - final.length,
  scores: final.map((f) => ({ role: f.role, score: f.self_score })),
}
```

Then the expanded-prompt basis (the reprompted XML that authors the workflow):

```xml
<role>{Workflow architect for this domain}</role>
<context>
- Raw operator request, target = Claude dynamic Workflow tool, route mode/profile
</context>
<task>{Compile the request into a runnable .workflow.js fan-out.}</task>
<motivation>{Why this matters}</motivation>
<requirements>
- One reprompted agent per role; schema returns are the source of truth.
- meta pure-literal; runId/taskname from args; bounded retry.
</requirements>
<constraints>
- No wall-clock/randomness in-script; model omitted; filter(Boolean).
- High-risk forbidden surfaces block emission (no in-tool override; rescope to proceed).
</constraints>
<output_format>A .workflow.js script + a Workflow Command Card.</output_format>
<success_criteria schema_version="1">
  <criterion id="schema-returns-source-of-truth" verification_method="manual">
    <description>In-run data flows through schema-validated agent() returns; tmp files are never read back as a handoff.</description>
  </criterion>
</success_criteria>
```

### Schema-truth + parent-written mirror

The emitted script returns a `reprompter.workflow_outcome.v1` payload; it never reads `/tmp/rpt-{taskname}-{role}.md` back. The **parent** writes those tmp artifacts from the returned objects after the run completes, so the existing Status Line count, Phase-4 evaluation, and `outcome-record.js --role` flywheel path keep working unchanged — and the throwing wall-clock/randomness calls stay out of the sandbox.

### Setup check

Confirm the `Workflow` tool is present in the current toolset (Claude dynamic Workflow runtime). If absent, use Repromptverse Option B/A or the `/goal` preflight lane instead.

Compile with the workflow compiler (`the root repository workflow compiler`) on the rough task with an `--out-dir`: it writes `workflow-command.json`, the runnable `rpt-{taskname}.workflow.js`, `workflow-command-card.json`, and `reprompter-expanded-prompt.md`. Add `--ultracode` / `--no-ultracode` to force the emission tier.

See `references/workflow-template.md` and `references/runtime/claude-workflow-runtime.md` for the full template and runtime contract.

---

## Lane: Single prompt

### Process

1. **Receive raw input**
2. **Input guard** — if input is empty, a single word with no verb, or clearly not a task → ask the user to describe what they want to accomplish
   - Reject examples: "hi", "thanks", "lol", "what's up", "good morning", random emoji-only input
   - Accept examples: "fix login bug", "write API tests", "improve this prompt"
3. **Quick Mode gate** — under 20 words, single action, no complexity indicators → generate immediately
4. **Smart Interview** — use `AskUserQuestion` with clickable options (2-5 questions max)
5. **Flywheel bias check (optional, read-only)** — if `REPROMPTER_FLYWHEEL_BIAS=1` is set in the environment, consult past outcomes before choosing a template. See "Flywheel bias injection" below.
6. **Generate + Score** — apply template, show before/after quality metrics. The generated prompt MUST include a `<success_criteria schema_version="1">` block with 3-6 `<criterion>` entries. Each criterion has `id` (kebab-case slug, unique in block), `verification_method` (`rule` | `llm_judge` | `manual`), a one-sentence `<description>`, and — depending on method — an inline `<rule type="regex|predicate">` or `<judge_prompt>` (neither for `manual`). Schema of record: `references/outcome-schema.md`.
7. **Single-pass evaluator** — run self-eval rubric and do one delta rewrite if score < 7

**Why criteria are emitted:** so every prompt carries its own testable assertions; outcome records produced by `the root repository outcome recording helper` (added in the same PR) join criteria to results for flywheel learning.

#### Flywheel bias injection (v3 read-path)

Default: off. Enable explicitly with `REPROMPTER_FLYWHEEL_BIAS=1` so runs with and without bias can be compared apples-to-apples until it earns the default.

When the flag is set, between the interview and the template pick:

1. Run `npm run flywheel:query -- --task-type <slug>` where `<slug>` is the task type identified from the interview (e.g. `fix_bug`, `write_code`).
2. Read the command's stdout. It's either `null` (cold start / low N) or a single JSON object with `recipe`, `confidence`, `sampleCount`.
3. **Only bias on `confidence ∈ {"medium", "high"}` AND `sampleCount >= 3`.** Low-confidence recommendations add noise without signal; treat them as cold start.
4. When biasing:
   - Prefer `recipe.vector.templateId` over the default intent-routed template.
   - Adopt `recipe.vector.patterns` alongside anything you would have picked from `references/patterns/`.
   - Match `recipe.vector.capabilityTier` in your reasoning about downstream execution.
5. Announce the decision in one line before the generate step so the user sees what happened:
   > Flywheel: preferring `<template>` + `[patterns]` based on N past runs (score X/10, <confidence> confidence)
   Or, if no bias applied:
   > Flywheel: no bias (cold start / low confidence)
6. The bias changes **which template/patterns you start from.** The rest of the pipeline (interview content, generated prompt's XML structure, criteria emission) is unchanged. The flywheel never rewrites Claude's output.
7. **Attribution (v3 part 3).** When bias is applied, remember the chosen recipe's `hash`, `confidence`, and `sampleCount` until the outcome is recorded for this run. Then stamp them onto the record via `the root repository outcome recording helper --applied-recommendation '{"recipe_hash":"<hash>","confidence":"<low|medium|high>","sample_count":<N>,"applied_at":"prompt_gen"}'`. Use `applied_at="phase_2"` for Repromptverse team-wide bias. **If no bias was applied (flag off, query returned null, or low confidence) OMIT the flag entirely** — the *absence* of `applied_recommendation` on a record is what marks it as the bias-off control group for `npm run flywheel:ab` analysis. Never stamp a zero/placeholder block; absence is the signal.

### ⚠️ MUST GENERATE AFTER INTERVIEW

After interview completes, IMMEDIATELY:
1. Select template based on task type
2. Generate the full polished prompt
3. Show quality score (before/after table)
4. Ask if user wants to execute or copy

```
❌ WRONG: Ask interview questions → stop
✅ RIGHT: Ask interview questions → generate prompt → show score → offer to execute
```

### Interview questions

Ask via `AskUserQuestion`. **Max 5 questions total.**

**Standard questions** (priority order — drop lower ones if task-specific questions are needed):
1. Task type: Build Feature / Fix Bug / Refactor / Write Tests / API Work / UI / Security / Docs / Content / Research / Multi-Agent
   - If user selects **Multi-Agent** while currently in **Single mode**, immediately transition to **Repromptverse Phase 1 (Team Plan)** and confirm team execution mode (Parallel vs Sequential).
2. Execution mode: Single Agent / Team (Parallel) / Team (Sequential) / Let RePrompter decide
3. Motivation: User-facing / Internal tooling / Bug fix / Exploration / Skip *(drop first if space needed)*
4. Output format: XML Tags / Markdown / Plain Text / JSON *(drop first if space needed)*

**Task-specific questions** (MANDATORY for compound prompts — replace lower-priority standard questions):
- Extract keywords from prompt → generate relevant follow-up options
- Example: prompt mentions "telegram" → ask about alert type, interactivity, delivery
- **Vague prompt fallback:** if input has no extractable keywords (e.g., "make it better"), ask open-ended: "What are you working on?" and "What's the goal?" before proceeding

### Single mode pattern pack (Microsoft-inspired)

Apply these patterns even without multi-agent execution:

1. **Intent router** — map task to template with explicit priority rules
2. **Constraint normalizer** — convert vague goals into measurable requirements/limits
3. **Spec contract** — enforce role/context/task/requirements/constraints/output/success structure
4. **Evaluator loop** — score clarity/specificity/structure/constraints/verifiability/decomposition; if score < 7, produce one delta rewrite

This keeps Single mode deterministic and compatible across Claude, OpenClaw, and Codex runtimes.

### Auto-detect complexity

| Signal | Suggested mode |
|--------|---------------|
| 2+ distinct systems (e.g., frontend + backend, API + DB, mobile + backend) | Team (Parallel) |
| Pipeline (fetch → transform → deploy) | Team (Sequential) |
| Single file/component | Single Agent |
| "audit", "review", "analyze" across areas | Team (Parallel) |
| "campaign", "launch", "growth", "SEO", "content calendar", "funnel" | Team (Parallel, Marketing Swarm) |
| "architecture", "feature delivery", "refactor", "migration", "test coverage" | Team (Parallel, Engineering Swarm) |
| "incident", "uptime", "gateway", "latency", "cron", "SLO", "health" | Team (Parallel, Ops Swarm) |
| "benchmark", "compare", "tradeoff", "options", "analysis", "research" | Team (Parallel, Research Swarm) |

### Quick mode

#### ⚠️ Force interview signals (check first)

**If ANY of the following signals are present, SKIP Quick Mode and go directly to interview — no exceptions:**

| Signal category | Keywords / patterns |
|----------------|---------------------|
| **Scope keywords** | system, platform, service, pipeline, dashboard, module, suite, management |
| **Ownership / existing state** | our, existing, the current, fresh, updated |
| **Integration verbs** | integrate, merge, connect, combine, sync |
| **Compound tasks** | "and", "plus", "also", "as well as" |
| **State management** | track, sync, manage |
| **Vague modifiers** | better, improved, some, maybe, kind of |
| **Ambiguous pronouns** | "it", "this", "that" without a clear referent in the same sentence |
| **Comprehensiveness** | comprehensive, complete, full, end-to-end, overall |

**Clause detection:** Treat any prompt with two or more independent clauses (comma-separated actions, semicolon-joined tasks, or consecutive imperative verbs) as a compound task — force interview.

**Broad-scope noun enforcement (`count_distinct_systems()`):** Count the number of distinct systems/modules implied by broad-scope nouns (system, module, suite, platform, pipeline, dashboard, management). If count >= 1 AND the prompt does not name a single, specific identifier — force interview.

#### Enable Quick Mode (only when NO force-interview signals are present)

Enable when ALL true:
- < 20 words (excluding code blocks)
- Exactly 1 action verb from: add, fix, remove, rename, move, delete, update, create
- Single target (one specific, named file, component, or identifier — NOT a broad-scope noun such as system, module, suite, or management)
- No conjunctions (and, or, plus, also)
- No vague modifiers (better, improved, some, maybe, kind of)

### Task types & templates

Detect task type from input. Each type has a dedicated template in `references/`:

| Type | Template | Use when |
|------|----------|----------|
| Feature | `feature-template.md` | New functionality (default fallback) |
| Bugfix | `bugfix-template.md` | Debug + fix |
| Refactor | `refactor-template.md` | Structural cleanup |
| Testing | `testing-template.md` | Test writing |
| API | `api-template.md` | Endpoint/API work |
| UI | `ui-template.md` | UI components |
| Security | `security-template.md` | Security audit/hardening |
| Docs | `docs-template.md` | Documentation |
| Content | `content-template.md` | Blog posts, articles, marketing copy |
| Research | `research-template.md` | Analysis/exploration |
| Marketing Swarm | `marketing-swarm-template.md` | Marketing-first multi-agent orchestration |
| Engineering Swarm | `engineering-swarm-template.md` | Engineering-first multi-agent orchestration |
| Ops Swarm | `ops-swarm-template.md` | Reliability/infra multi-agent orchestration |
| Research Swarm | `research-swarm-template.md` | Analysis/benchmark multi-agent orchestration |
| Repromptverse | `repromptverse-template.md` | Multi-agent routing + termination + evaluator loop |
| Multi-Agent | `swarm-template.md` | Basic multi-agent coordination |
| Reverse | `reverse-template.md` | Reverse-engineered prompt from exemplar output |
| Team Brief | `team-brief-template.md` | Team orchestration brief |

**Priority** (most specific wins): marketing-swarm > engineering-swarm > ops-swarm > research-swarm > repromptverse > api > security > ui > testing > bugfix > refactor > content > docs > research > feature. For multi-agent tasks, use the best-fit swarm template + `repromptverse-template` + `team-brief-template`, then type-specific templates for each agent sub-prompt.

**How it works:** Read the matching template from `references/{type}-template.md`, then fill it with task-specific context. Templates are NOT loaded into context by default — only read on demand when generating a prompt. If the template file is not found, fall back to the Base XML Structure below.

> To add a new task type: create `references/{type}-template.md` following the XML structure below, then add it to the table above.

### Base XML structure

All templates follow this core structure (8 required tags). Use as fallback if no specific template matches:

Exception: `team-brief-template.md` uses Markdown format for orchestration briefs. This is intentional — see template header for rationale.

```xml
<role>{Expert role matching task type and domain}</role>

<context>
- Working environment, frameworks, tools
- Available resources, current state
</context>

<task>{Clear, unambiguous single-sentence task}</task>

<motivation>{Why this matters — priority, impact}</motivation>

<requirements>
- {Specific, measurable requirement 1}
- {At least 3-5 requirements}
</requirements>

<constraints>
- {What NOT to do}
- {Boundaries and limits}
</constraints>

<output_format>{Expected format, structure, length}</output_format>

<success_criteria schema_version="1">
  <criterion id="no-regression" verification_method="rule">
    <description>Output does not reintroduce the original error signature.</description>
    <rule type="regex"><![CDATA[^(?!.*TypeError: cannot read property 'id' of undefined).*$]]></rule>
  </criterion>
  <criterion id="guards-null-user" verification_method="llm_judge">
    <description>Fix guards against the null-user edge case from the bug report.</description>
    <judge_prompt><![CDATA[Does the diff check that `user` is non-null before reading `user.id`? Reply pass or fail.]]></judge_prompt>
  </criterion>
  <criterion id="regression-test-added" verification_method="manual">
    <description>At least one regression test covers the previously failing scenario.</description>
  </criterion>
</success_criteria>
```

(The Base XML `<success_criteria>` example above matches the v1 schema in `references/outcome-schema.md`; real generated prompts should adapt the `id`s, descriptions, and rules to the task at hand.)

### Project context detection

Auto-detect tech stack from current working directory ONLY:
- Scan `package.json`, `tsconfig.json`, `prisma/schema.prisma`, etc.
- Session-scoped — different directory = fresh context
- Opt out with "no context", "generic", or "manual context"
- Never scan parent directories or carry context between sessions

---

## Lane: Repromptverse (Agent Teams)

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

Canonical implementation for deterministic routing lives in `the root repository intent routing helper`.
If docs and code ever diverge, the script is the source of truth for benchmark/testing paths.

### Phase 1: Team plan (~45 seconds)

1. **Score raw prompt** (1-10): Clarity, Specificity, Structure, Constraints, Decomposition
   - Phase 1 uses 5 quick-assessment dimensions. The full 6-dimension scoring (adding Verifiability) is used in Phase 4 evaluation.
2. **Dimension Interview gate** — check which askable dimensions scored < 5 (see Dimension Interview section below)
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
- MUST appear before any agent is launched
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
- MUST appear before synthesis is written
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
- `<success_criteria>`: **MUST** use the v1 structured shape (same as Mode 1) — see `references/outcome-schema.md`. Include 3–6 `<criterion>` entries scoped to **this agent's artifact** (not the whole team's output). Each criterion has `id`, `verification_method` (`rule` | `llm_judge` | `manual`), a one-sentence `<description>`, and an inline `<rule>` or `<judge_prompt>` per the method. Bullet-list placeholders in the template files are acceptable scaffolding but the generated per-agent prompt **must** upgrade them to the structured form.

**Score each prompt — target 8+/10.** If under 8, add more context/constraints.

Write all to `/tmp/rpt-agent-prompts-{taskname}.md`

**Flywheel hook (per-agent):** after Phase 3 execution, each agent's artifact at `/tmp/rpt-{taskname}-{agent-domain}.md` can be recorded separately with `the root repository outcome recording helper --role <agent-name>` (one record per agent, `mode="repromptverse"`, and `--role` set to the teammate's name so the flywheel bridge uses it as the `domain` when building the recipe fingerprint). Score each record with `the root repository outcome evaluation helper`. Without `--role`, all agents on the same `task_type` collapse into the same recipe bucket and the strategy learner can't tell which roles consistently win vs struggle — so always pass it for Repromptverse records.

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
- MUST appear after Phase 2 prompt generation, before Phase 3 execution
- Shows the user exactly how much reprompter improved their input
- If any agent prompt scores < 8, note which ones and what was added to fix them

### Phase 3: Execute

Phase 3 has platform-specific execution methods. The reprompted prompts from Phase 2 work with any method — you just need to pick which one to run. In most runs you should not ask the user; auto-pick below and announce the decision so they can redirect if they want.

**Status Line (all platforms):** During polling, show compact agent status with each cycle. See Agent Cards section for format.

#### Runtime auto-pick (default behaviour — do this first)

If the user explicitly named an option in their request (e.g. "use tmux", "run it sequentially", "via sessions_spawn"), honour that and skip the detection. Otherwise run the decision tree below top-to-bottom and use the first option whose capability is available.

| Order | Capability check | If true, use |
|-------|-----------------|--------------|
| 1 | `spawn_subagent` is present **and** at least two of `run_command`, `todo_write`, `ask_user_question` are in the current toolset (unambiguous Grok 4.3+ signature). | **Option F** — Grok CLI native parallel (F1: `spawn_subagent` with `fork_context=true`, `persona`, `capability_mode`; F2: shell-level `grok -p "..." --yolo --sandbox workspace &` then `wait`). Full contract and gotchas in `references/runtime/grok-cli-runtime.md`. |
| 2 | `delegate_task` is present **and** at least two of `terminal`, `process`, `read_file`, `write_file`, `patch`, `search_files`, `todo`, `skills_list`, or `skill_view` are in the current toolset (Hermes Agent signature). | **Option G** — Hermes Agent native parallel (G1: `delegate_task` batch; G2: shell-level `hermes -z` / `hermes chat -q` then `wait`; G3: Kanban only for durable workflows). Full contract and gotchas in `references/runtime/hermes-agent-runtime.md`. |
| 3 | **All four** of `TeamCreate`, `Agent`, `SendMessage`, and `TeamDelete` are listed in your current toolset. (Gating on `TeamCreate` alone is not enough — Option B's spawn/shutdown path needs the whole set; without it the run fails mid-execution rather than falling through to another option.) | **Option B** — native Claude Code teams; teammates can message each other; no tmux init or send-keys timing risk |
| 4 | A tool named `Workflow` is present in the current toolset (Claude dynamic Workflow runtime) — JS-scripted background orchestration with `agent()`/`parallel()`/`pipeline()` and schema-validated returns. Sits **below** Option B because the Workflow tool has **no** mid-run cross-agent messaging. | **Option H** — Claude dynamic Workflow tool; deterministic background fan-out via `pipeline`/`parallel` with schema-return handoffs and resumable runs; no mid-run cross-agent messaging. Full contract in `references/runtime/claude-workflow-runtime.md`. |
| 5 | `sessions_spawn` tool is listed in your current toolset | **Option C** — OpenClaw |
| 6 | `bash -c 'command -v tmux && { claude --version 2>/dev/null \| awk "{print \$1}" \| grep -Eq "^(2\.[1-9]\|[3-9])"; }'` exits 0. (Binary presence alone is insufficient — Option A needs `claude` ≥ 2.1 so `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is honoured; older CLIs accept the env var but don't enable team mode.) | **Option A** — tmux + child `claude --model opus`, visible panes |
| 7 | Running inside Codex (parallel sessions available) | **Option D** |
| 8 | None of the above | **Option E** — sequential fallback (works with any LLM) |

After picking, announce the selected option in one short line before starting Phase 3 work, so the user can redirect. Use this shape with the actual option and runtime you selected:

> Auto-picked **Option {letter}** ({runtime}) — {short detection reason}. Override by saying "use Option B", "use Option H (Workflow)", "use Option A (tmux)", "use Option D", "use Option G (Hermes)", or "use Option E" (sequential).

Why F is first for Grok: when an unambiguous Grok signature is detected (`spawn_subagent` + at least two of the supporting tools), Repromptverse must use Grok-native execution (Option F) to honour the "full Grok runtime support" claim. This check is intentionally strict to prevent false positives on other runtimes. Option B (Claude native teams with cross-agent `SendMessage`) is preferred on Claude Code surfaces because it offers richer inter-agent messaging than Grok subagents currently provide. The rest of the priority order is unchanged.

Why G is next for Hermes: `delegate_task` is a Hermes-specific fork/join primitive. When that tool appears with Hermes' file, terminal, skills, or todo tools, Repromptverse should use the native Hermes path instead of falling through to OpenClaw, tmux, Codex, or sequential mode. Hermes workers receive fresh context, so the parent must pass the full per-agent prompt and artifact path in each task's `context`.

Why H sits just below B on Claude surfaces: both are Claude-native, but the dynamic Workflow tool has **no mid-run cross-agent messaging** — workers cannot talk; data flows only through `pipeline()`/`parallel()` return values. So Option B stays the default when teammates must negotiate during the run (review/audit teams), and Option H wins when you want deterministic background fan-out, schema-validated return handoffs, and resumable runs (the script's `agent()` prefix is cached on `resumeFromRunId`). Full contract in `references/runtime/claude-workflow-runtime.md`.

#### Tool-schema guard (all options)

Before invoking any tool named in Options A–H, verify it appears in your current toolset and that the call signature matches the schema loaded for the current runtime. Modern CLI runtimes reject calls against an unknown tool or a non-matching signature instead of inferring intent. If a named tool is unfamiliar, halt and report back rather than substituting a similar-looking one.

Known pitfalls captured from 4.6 → 4.7 drift in this skill:

- **`Task` → `Agent`.** The legacy spawn tool was named `Task` and took `subagent_type` as a keyword argument. It has been split into `Agent(...)` for spawn and `TaskCreate` / `TaskUpdate` / `TaskList` for todos. Any example still calling the old spawn name is broken under 4.7.
- **`SendMessage` signature.** Current shape is `SendMessage(to=<name-or-"*">, message=<str-or-obj>)`. Legacy `type=` and `recipient=` kwargs do not exist on the current tool.
- **Broadcast restriction.** `SendMessage(to="*", ...)` accepts **plain strings only.** Structured payloads such as `{"type": "shutdown_request"}` must be sent per-agent by name; the runtime rejects structured broadcasts.
- **`TeamDelete` ordering.** `TeamDelete()` fails if any teammate is still active. Shutdown is async; in-process teammates need a turn yield to approve each `shutdown_request` before cleanup succeeds.
- **`TeamCreate` precedence.** `Agent(team_name=...)` errors if that team was not created first. Always call `TeamCreate` before any `Agent` with a `team_name` argument.

Canonical signatures Option B depends on. **These are reference documentation, not a schema enforced by the validator.** `npm run validate:tool-refs` is a blocklist — it catches known-bad shapes from this repo's history (obsolete tool names, reordered broadcast calls, hardcoded model pins) but does not positively verify that every call here matches its schema. If you change a signature below, update the linter's check set in `the root repository tool-reference validator` in the same PR (and also any Option B flow that relies on the old shape).

```text
TeamCreate(team_name=<string>, description=<string>)

TaskCreate(subject=<string>, description=<string>)

Agent(
  description=<string>,           # required
  prompt=<string>,                 # required
  subagent_type=<string>,          # optional, e.g. "general-purpose"
  team_name=<string>,              # optional — requires prior TeamCreate
  name=<string>,                   # optional — used as SendMessage target
  model=<string>,                  # optional — "opus" / "sonnet" / "haiku"
  run_in_background=<bool>,        # optional — default false
)

SendMessage(to=<name-or-"*">, message=<str-or-obj>)

TaskList()  # used during polling; returns current task statuses

TeamDelete()
```

Never hardcode a specific model version string of the form `claude-<family>-<major>-<minor>` — use the bare alias (`opus`, `sonnet`, `haiku`) so the CLI resolves to the current latest automatically. The linter also enforces this.

#### Option A: tmux (Claude Code)

```bash
# 1. Start Claude Code with Agent Teams
tmux new-session -d -s {session} "cd /path/to/workdir && CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --model opus"
# placeholders:
# - {session}: unique tmux session name (example: rpt-auth-audit)
# - /path/to/workdir: absolute repository path for the target project (example: /tmp/reprompter-check)

# 2. Wait for startup
sleep 12

# 3. Send prompt — MUST use -l (literal), Enter SEPARATE
# IMPORTANT: Include POLLING RULES to prevent lead TaskList loop bug
tmux send-keys -t {session} -l 'Create an agent team with N teammates. CRITICAL: Use model opus for ALL tasks.

POLLING RULES — YOU MUST FOLLOW THESE:
- After sending tasks, poll TaskList at most 10 times
- If ALL tasks show "done" status, IMMEDIATELY stop polling
- After 3 consecutive TaskList calls showing the same status, STOP polling regardless
- Once you stop polling: read the output files, then write synthesis
- DO NOT call TaskList more than 20 times total under any circumstances

Teammate 1 (ROLE): TASK. Write output to /tmp/rpt-{taskname}-{domain}.md. ... After all complete, synthesize into /tmp/rpt-{taskname}-final.md'
sleep 0.5
tmux send-keys -t {session} Enter

# 4. Monitor (poll every 15-30s) — show Status Line: Agents: ✅ N/T ⏳ N/T 🔄 N/T
tmux capture-pane -t {session} -p -S -100

# 5. Verify outputs
ls -la /tmp/rpt-{taskname}-*.md

# 6. Cleanup
tmux kill-session -t {session}
```

#### Critical tmux rules

⚠️ **WARNING: Default teammate model is HAIKU unless explicitly overridden. Always set `--model opus` in both CLI launch command and team prompt.**

| Rule | Why |
|------|-----|
| Always `send-keys -l` (literal flag) | Without it, special chars break |
| Enter sent SEPARATELY | Combined fails for multiline |
| sleep 0.5 between text and Enter | Buffer processing time |
| sleep 12 after session start | Claude Code init time |
| `--model opus` in CLI AND prompt | Default teammate = HAIKU |
| Each agent writes own file | Prevents file conflicts |
| Unique taskname per run | Prevents collisions between concurrent sessions |

### Phase 4: Evaluate + retry

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

#### Option B: TeamCreate (Claude Code native)

When using Claude Code with TeamCreate/SendMessage tools (native agent teams, no tmux needed):

```text
# 1. Create team
TeamCreate(team_name="rpt-{taskname}", description="Repromptverse: {task summary}")

# 2. Create tasks (one per agent)
TaskCreate(subject="Agent 1 task", description="Full reprompted prompt from Phase 2")
TaskCreate(subject="Agent 2 task", description="Full reprompted prompt from Phase 2")

# 3. Spawn teammates with the Agent tool (MUST specify model=opus)
#    Note: In Claude Code ≥2.1, the tool is `Agent`. The old `Task` name referred
#    to the same spawn primitive but no longer exists as a callable tool. Using
#    `Task(...)` here causes the model to either fail the call or skip the spawn.
Agent(description="Agent 1 on rpt-{taskname}", subagent_type="general-purpose",
      team_name="rpt-{taskname}", name="agent-1", model="opus",
      prompt="You are {role} on the rpt-{taskname} team. Your task is Task #1. [full prompt]",
      run_in_background=true)
Agent(description="Agent 2 on rpt-{taskname}", subagent_type="general-purpose",
      team_name="rpt-{taskname}", name="agent-2", model="opus",
      prompt="You are {role} on the rpt-{taskname} team. Your task is Task #2. [full prompt]",
      run_in_background=true)

# 4. Wait for teammates to complete — show Status Line per poll cycle
# Status Line: Agents: ✅ N/T ⏳ N/T 🔄 N/T (derived from TaskList status)
# 5. Compile synthesis from teammate reports
# 6. Shutdown teammates and delete team
#    Two hard rules on the current runtime (verified on Claude Code 2.1+):
#    - SendMessage(to="*") ONLY accepts plain-string messages. Structured
#      payloads like {"type": "shutdown_request"} are rejected on broadcast,
#      so shutdown MUST be sent per-agent by name.
#    - TeamDelete() errors if any teammate is still active. shutdown is
#      asynchronous (each teammate needs a turn to approve the request and
#      terminate), so wait for each agent to acknowledge before calling it.
#      Retry TeamDelete with a small backoff if needed.
SendMessage(to="agent-1", message={"type": "shutdown_request"})
SendMessage(to="agent-2", message={"type": "shutdown_request"})
# ... one SendMessage per spawned teammate
# (wait for each shutdown_response — in-process teammates need a turn yield)
TeamDelete()
```

**Advantages over tmux:** Teammates can message each other (cross-agent flags), shared TaskList for progress tracking, no tmux/terminal dependency, built-in idle/shutdown protocol.

**When to use TeamCreate vs tmux:** Use TeamCreate when agents need to communicate (review teams, audit teams). Use tmux when agents are fully independent and you want visible terminal panes.

#### Option C: sessions_spawn (OpenClaw only)

When tmux/Claude Code is unavailable but running inside OpenClaw:
```
sessions_spawn(task: "<per-agent prompt>", model: "opus", label: "rpt-{role}")
```
Note: `sessions_spawn` is an OpenClaw-specific tool. Not available in standalone Claude Code.

#### Option D: Codex CLI

Codex CLI 0.121.0+ offers two valid patterns for Repromptverse fan-out. Pick based on whether orchestration happens inside or outside the Codex session.

| Pattern | When to use | Mechanism |
|---|---|---|
| **D1: Native subagents** | In-session orchestration, shared context, single synthesis, per-agent TOML role definitions | `[agents]` config + prompt-driven spawn |
| **D2: Shell-level `codex exec`** | External orchestration, per-agent model/profile, structured stdout/stderr logs, total isolation | `codex exec --ephemeral --sandbox <mode> ... &` + `wait` |
| _Neither — cross-agent messaging required mid-run_ | Agents must talk while running | Use Option B (TeamCreate in Claude Code) — Codex has no cross-agent messaging primitive |

See `references/runtime/codex-runtime.md` for the full runtime contract (invocation, artifacts, retries, known gotchas).

**D1 — Native subagents (Codex 0.121.0+; `multi_agent` feature flag stabilized in 0.115.0 on 2026-03-16)**

Enable in `Codex config file`:

```toml
[features]
multi_agent = true

[agents]
max_threads = 6       # concurrent workers (default)
max_depth = 1         # no sub-subagents by default
job_max_runtime_seconds = 1800
```

Define each repromptverse role once as `Codex agents directory/<name>.toml`:

```toml
name = "rpt_audit_explorer"
description = "Read-only exploration for Repromptverse audit fan-out."
model = "gpt-5.4"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
developer_instructions = """
You are one of N parallel audit workers. Write your findings to the
artifact path specified by the orchestrator. Cite file:line for every
claim. Do not speculate. Finish by going idle; the orchestrator reads
the artifact file, not a tool call.
"""
```

**Note:** `report_agent_job_result` is a Codex tool required only by `spawn_agents_on_csv` batch workers, not by ordinary prompt-spawned subagents. Do not add it to the normal D1 `developer_instructions` above — the tool is not registered for standard subagent roles.

Subagents are prompt-driven in Codex (not flag-driven). The orchestrator prompt fans out in natural language:

```
Spawn one rpt_audit_explorer subagent per audit dimension
(methodology, code, stats, narrative, attack-surface, claims).
Each subagent writes to /tmp/rpt-{taskname}-{dimension}.md.
After all six complete, read their artifacts and synthesize
the final report to /tmp/rpt-{taskname}-final.md.
```

The `[agents] max_threads` cap is enforced natively — no FIFO semaphore needed. Note: normal `spawn_agent` calls past the cap fail with an `AgentLimitReached` error rather than queueing, so keep the orchestrator's fan-out size ≤ `max_threads`. Known gotchas: issue #14866 (stuck "awaiting instruction", closed with linked fix) and issue #15177 (still open: model override metadata may leak back to parent model — prefer the `default` role when override fidelity matters).

**D2 — Shell-level `codex exec` (portable shell-level path, any Codex version with `codex exec` + `--ephemeral`)**

Shell-level parallelism works on any POSIX shell. `codex exec` is one-shot, so backgrounding each agent and waiting is the portable pattern:

```bash
# 0. Materialize per-agent prompt files (Phase 2 split).
#    Convention: /tmp/rpt-{taskname}-{agent}.prompt.md
ls /tmp/rpt-{taskname}-*.prompt.md

# 1. Launch each agent in the background. Workers must write their
#    artifact to /tmp/rpt-{taskname}-{agent}.md, so they need write
#    access to /tmp. --sandbox workspace-write permits this. In
#    `codex exec`, --full-auto is an alias for the same sandbox and
#    approval stays at `never` either way (verified in codex 0.121.0
#    source: exec/src/cli.rs + exec/src/lib.rs). Pick whichever flag
#    reads cleaner in your scripts.
#    Switch to --sandbox read-only ONLY if your workers are pure
#    analysis that captures findings via --output-last-message instead
#    of writing the .md artifact themselves (rename the .log to .md
#    after `wait`).
#    `--ephemeral` skips on-disk session state; recommended for
#    isolated parallel runs (historical reference: closed issue #11435).
MODEL="gpt-5.4"
for agent in planner critic synthesizer; do
  codex exec \
    --model "$MODEL" \
    --ephemeral \
    --sandbox workspace-write \
    --output-last-message "/tmp/rpt-{taskname}-${agent}.log" \
    "`cat /tmp/rpt-{taskname}-${agent}.prompt.md`" \
    > "/tmp/rpt-{taskname}-${agent}.stdout" 2>&1 &
done

# 2. Wait for all background sessions.
wait

# 3. Verify each agent wrote its artifact (exclude .prompt.md inputs).
ls /tmp/rpt-{taskname}-*.md 2>/dev/null | grep -v '\.prompt\.md$'

# 4. Run Phase 4 evaluator loop.
```

Status Line during execution: Codex CLI has no built-in TaskList. Derive status from artifact presence — crucially, **exclude the `.prompt.md` input files** or the counter will report "done" before any agent writes output:

```bash
# Zero-match-safe, POSIX-compatible loop. Does not abort under
# `set -euo pipefail` when no artifacts exist yet or only .prompt.md
# inputs are present, and runs in dash (/bin/sh) as well as bash/zsh.
done=0
for f in /tmp/rpt-{taskname}-*.md; do
  [ -e "$f" ] || continue             # glob returned literal (no matches)
  case "$f" in *.prompt.md) continue ;; esac
  done=`expr "$done" + 1`
done
total=3
echo "Agents: ✅ $done/$total  ⏳ `expr "$total" - "$done"`/$total"
```

**Retries:** Re-run `codex exec` for the failing agent with the delta prompt (Phase 4). Do NOT re-run the whole fleet.

**Concurrency cap (D2):** Default to 4 or the CPU count, whichever is lower. On Linux use `nproc`; on macOS use `sysctl -n hw.ncpu`. More than 4 concurrent Codex sessions against the same account can hit rate limits.

**If `wait` hangs (D2):** one agent stalled. Inspect `/tmp/rpt-{taskname}-*.stdout`, kill that PID, retry just that agent.

**Single-session fallback:** if the environment doesn't allow backgrounding or subagents (sandboxed shells, notebook runners), use Option E — the reprompted prompts are plain text and run identically in one session, just slower.

**When to pick D1 vs D2:**

| Situation | Pick |
|---|---|
| Agents coordinate from the same task brief; one summary output expected | D1 |
| Need per-agent log files or model/profile overrides | D2 |
| Orchestrating from CI or shell script outside Codex | D2 |
| You want fresh context per worker without re-ingesting the codebase | D1 |
| Codex < 0.121.0 or `multi_agent` feature disabled | D2 |
| Cross-agent messaging required mid-run | Neither — use Option B (TeamCreate in Claude Code) |

#### Option H: Claude dynamic Workflow tool

When a tool named `Workflow` is present in the current toolset (Claude dynamic Workflow runtime), Phase 3 can compile the Phase-2 per-agent prompts into a single runnable `.workflow.js` and run it via `Workflow({ scriptPath, args })`. Picked at Order 4 — **below Option B**, because the Workflow tool has **no mid-run cross-agent messaging**; data flows only through `pipeline()`/`parallel()` return values.

Each Phase-2 reprompted prompt becomes an `agent(prompt, { schema })` call. Three emission patterns:

| Pattern | When | Shape |
|---|---|---|
| **H1: `pipeline()` default** | Sequential dependencies (fetch → transform → deploy); each item independent, no barrier | `pipeline(items, stage1, stage2)` |
| **H2: `parallel()` barrier** | Independent-domain agents whose results are synthesized/evaluated together (the common Repromptverse shape) | `(await parallel(roles.map(r => () => agent(r.prompt, { schema })))).filter(Boolean)` then synthesize |
| **H3: budget-aware depth** | A `+Nk` budget directive | **As the compiler emits it:** a fixed roster + agent-count caps (`maxItems: 20`, `VERIFY_CAP: 24`) and a completeness critic gated on `!budget.total \|\| budget.remaining() > 30000` — depth dials off near the ceiling, no roster scaling. (A literal `while (budget.remaining() > N) { … }` loop-until-budget is a valid *hand-authored* shape, but the compiler does not emit one.) |

Hard rules for the emitted script (full contract: `references/runtime/claude-workflow-runtime.md`): `meta` is a pure literal with `phase()` titles matching `meta.phases`; `runId`/`taskname` come from `args` (never generated in-script — wall-clock and randomness throw and break resume); `model` is omitted so agents inherit the main-loop model; `filter(Boolean)` after every `parallel()`/`pipeline()`. **Schema-validated returns are the single source of truth** — the script never reads the `/tmp/rpt-*.md` files back; the parent writes that compatibility mirror **after** the run returns (so Status Line / Phase-4 / flywheel keep working). High-risk forbidden surfaces (prod/auth/secret/...) block script emission (`blocked: true`, `script: null`); there is no in-tool override, so rescope the task to proceed.

**Ultracode:** when ultracode is on, the emitted script defaults to the thorough body — adversarial / perspective-diverse verify (3 distinct lenses: correctness/completeness/risk, a finding kept only on ≥2/3 non-refutation) plus a completeness critic. **Agent-count caps** keep it under the Workflow 1000-agent lifetime cap: `maxItems: 20` findings per role and `VERIFY_CAP = 24` (≤72 verify agents), with truncation logged. **Budget scaling (H3, as shipped):** the critic is gated on `!budget.total || budget.remaining() > 30000` so the extra pass dials off near the token ceiling — the roster itself is *not* budget-scaled. A budget directive (`+Nk` / `budget:` only — clamped to 100M; a bare `Nk tokens` is ambiguous with exfiltration and is **not** a cue) rides the command as `args.budget`, while the script prefers the live `budget` global. Lean off-ramp (`REPROMPTER_ULTRACODE=0` / `--no-ultracode`) keeps trivial reprompts cheap. Compiler: `the root repository workflow compiler`.

#### Option G: Hermes Agent

Hermes Agent supports three valid Repromptverse execution patterns. Pick G1 by default for normal interactive runs.

| Pattern | When to use | Mechanism |
|---|---|---|
| **G1: `delegate_task` batch** | In-session parallel Repromptverse; parent needs final summaries before synthesis | `delegate_task(tasks=[...])` with one task per role |
| **G2: Shell-level Hermes** | External orchestration, per-worker logs, CI/headless scripts | Write prompt files with single-quoted heredocs, then run `hermes -z "$prompt_text"` or `hermes chat -q "$prompt_text"` in the background, then `wait` |
| **G3: Kanban** | Durable, restart-surviving, multi-profile, human-in-loop workflows | `kanban_create` + worker agents pulling/listing/completing cards |

See `references/runtime/hermes-agent-runtime.md` for the full runtime contract (invocation, artifacts, retries, `/goal`, Kanban, and known gotchas).

**G1 — Native delegation via `delegate_task` (recommended)**

Hermes child agents start with fresh conversation context. The parent must pass all relevant context in each task's `goal` and `context`; do not assume the child can see the parent's full transcript.

```text
delegate_task(tasks=[
  {
    "goal": "Repromptverse researcher worker for {taskname}",
    "context": "You are the researcher agent on rpt-{taskname}.\n\n[PASTE THE FULL PHASE-2 REPROMPTED XML PROMPT HERE]\n\nWrite your complete findings to /tmp/rpt-{taskname}-researcher.md. Use file:line citations. Do not speculate.",
    "toolsets": ["terminal", "file", "web", "skills"]
  },
  {
    "goal": "Repromptverse reviewer worker for {taskname}",
    "context": "You are the reviewer agent on rpt-{taskname}.\n\n[PASTE THE FULL PHASE-2 REPROMPTED XML PROMPT HERE]\n\nWrite your complete findings to /tmp/rpt-{taskname}-reviewer.md. Use file:line citations. Do not speculate.",
    "toolsets": ["terminal", "file", "web", "skills"]
  }
])
```

Default Hermes concurrency is bounded by `delegation.max_concurrent_children` (documented default 3). If the planned team is larger than the limit, split into batches or use G2/G3. Oversized batches return an error rather than silently queueing.

Status Line during G1: track the parent plan with Hermes `todo`, then combine returned child summaries with artifact checks (`ls /tmp/rpt-{taskname}-*.md`, excluding `.prompt.md` and `.stdout`) before Phase 4 synthesis.

**G2 — Shell-level `hermes -z` / `hermes chat -q`**

Use this when the parent is orchestrating from a shell script or needs separate stdout/stderr logs:

```bash
TASKNAME="audit-2026-05"
AGENTS=(researcher implementer reviewer)

for role in "${AGENTS[@]}"; do
  prompt_file="/tmp/rpt-${TASKNAME}-${role}.prompt.md"
  {
    printf 'You are the %s agent on the rpt-%s team.\n\n' "$role" "$TASKNAME"
    cat <<'REPROMPTER_PROMPT'
[PASTE THE FULL PHASE-2 REPROMPTED XML PROMPT FOR THIS ROLE]
REPROMPTER_PROMPT
    printf '\n\nWrite your complete findings to the exact file /tmp/rpt-%s-%s.md.\n' "$TASKNAME" "$role"
    printf 'Use file:line citations. Do not speculate.\n'
  } > "$prompt_file"

  prompt_text=`cat "$prompt_file"`
  hermes -z "$prompt_text" \
    --toolsets terminal,file,web,skills \
    > "/tmp/rpt-${TASKNAME}-${role}.stdout" 2>&1 &
done

wait
```

Use `hermes chat -q "$prompt_text"` instead of `hermes -z "$prompt_text"` when you want the normal chat one-shot path rather than pure final text. Workers must still write `/tmp/rpt-{taskname}-{role}.md`.

**G3 — Hermes Kanban (explicit opt-in only)**

Do not auto-select Kanban for normal Repromptverse. Use it only when the user wants durable work that survives restarts, spans multiple Hermes profiles, needs human-in-loop checkpoints, or should be visible as a board. Kanban agents use the `kanban_*` toolset directly: task workers normally use lifecycle tools such as `kanban_show`, `kanban_complete`, `kanban_block`, `kanban_heartbeat`, and `kanban_comment`, while profiles that explicitly enable the Kanban toolset and are not scoped to one dispatcher task can also use orchestration tools such as `kanban_list`, `kanban_create`, `kanban_link`, and `kanban_unblock`.

**Known Hermes gotchas:**

- `delegate_task` is synchronous from the parent's perspective; the parent waits for child summaries before continuing.
- Child summaries are the only child state automatically returned to the parent. Intermediate tool outputs do not enter the parent context unless the child writes artifacts or summarizes them.
- Normal child agents cannot themselves use `delegate_task`, `clarify`, `memory`, `send_message`, or `execute_code` unless Hermes is configured for orchestrator/nested roles.
- Cross-agent messaging during a running G1 batch is not the default coordination surface. Use artifact files and parent synthesis, or use G3 Kanban for durable coordination.

#### Option E: Sequential (any LLM)

No parallel execution tools available? Run each agent's reprompted prompt one at a time in the same session. Works with any LLM (Claude, GPT, Gemini, Codex, etc.). Slower but fully platform-agnostic.

The reprompted prompts from Phase 2 are pure text. They work regardless of execution method.

---

## Lane: Reverse Reprompter

### TL;DR

```
Great output in → optimal prompt out. Extract the DNA that produced excellence.

Phase 1: EXTRACT — structural analysis of the exemplar (~5s)
Phase 2: ANALYZE — classify task type, domain, tone, quality (~5s)
Phase 3: SYNTHESIZE — generate full XML prompt matching the exemplar's pattern (~10s)
Phase 4: INJECT — seed flywheel with pre-graded exemplar outcome (optional, ~2s)
```

**Key insight:** Users encounter great outputs constantly but can't reproduce the quality. Reverse Reprompter closes that gap by extracting the prompt that would have produced it.

### Trigger words

- "reverse reprompt", "reverse reprompter"
- "reprompt from example", "reprompt from this"
- "learn from this"
- "extract prompt from"
- "reverse engineer prompt"
- "prompt from output", "prompt dna", "prompt genome"

### Process

1. **Receive exemplar** — user provides text (paste, file path, or points to an existing output)
2. **Input guard** — must be substantial output (>50 chars, has structure). Reject raw prompts (use Single mode instead), empty text, or single-word inputs
3. **Quick interview** (max 2 questions via AskUserQuestion):
   - "What do you love about this output?" (with options: Structure / Depth / Tone / Coverage / Everything)
   - "What context produced it?" (with options: Code review / Architecture / API work / Research / Other) — skip if task type is detectable with high confidence
4. **Analyze** — extract structure, classify type, detect domain and tone
5. **Extract criteria** — derive a v1 `<success_criteria schema_version="1">` block from the exemplar's observable features (see "Criteria extraction from exemplars" below). The exemplar *is* the target, so the criteria encode "future outputs should match this exemplar's distinguishing properties."
6. **Generate** — produce full XML prompt using reverse template + best-fit task template; embed the extracted `<success_criteria>` block.
7. **Score** — show quality dimensions of the generated prompt
8. **Flywheel injection** — offer to save as pre-graded exemplar outcome

### ⚠️ MUST GENERATE AFTER ANALYSIS

After analysis completes, IMMEDIATELY:
1. Extract `<success_criteria>` from the exemplar (see "Criteria extraction from exemplars" below — 3–6 criteria anchored to observable features of the exemplar)
2. Generate the full reverse-engineered prompt, embedding the extracted `<success_criteria>` block
3. Show the Extraction Card (see below)
4. Show the generated prompt in XML format
5. Show quality score
6. Ask: "Save to flywheel? / Execute with this prompt? / Copy?"

```
❌ WRONG: Analyze exemplar → stop
❌ WRONG: Analyze exemplar → generate prompt → stop (skipping criteria extraction)
✅ RIGHT: Analyze exemplar → extract criteria → generate prompt with criteria → show Extraction Card → show score → offer actions
```

### Extraction Card (transparency layer)

Rendered after analysis, before the generated prompt. Use this exact format:

```markdown
## Reverse Extraction

| Dimension | Detected | Confidence |
|-----------|----------|------------|
| Task type | {code-review, architecture-doc, etc.} | {high/medium/low} |
| Domain | {primary domain} | - |
| Tone | {formal/neutral/casual} | - |
| Structure | {N sections, M bullets, K code blocks} | - |
| Quality | Clarity {N}/10, Specificity {N}/10, Coverage {N}/10 | - |

Template match: `{template-id}` | Flywheel injection: {ready/skipped}
```

### Criteria extraction from exemplars

Reverse Reprompter converts the exemplar into criteria by examining three layers of its structure and encoding the distinguishing features as v1 `<criterion>` entries. Aim for 3–6 total, mix of methods.

**Structural layer** (produces `rule` / `predicate` criteria):

- Section/header count: `len(output_text) > N` bounded by the exemplar's length ±20%
- Presence of specific section names the exemplar uses (e.g. "## Summary", "## Trade-offs") → `rule` / `regex` matching those headers
- Minimum number of bulleted items, code blocks, or table rows if the exemplar has them → predicate

**Content layer** (produces `rule` / `regex` or `llm_judge` criteria):

- Required domain terminology that the exemplar uses distinctively (e.g. "CVE-", "SLO", "RFC 7231") → `rule` / `regex`
- Presence of quantitative claims (numbers + units) when the exemplar has them → regex like `\d+\s*(ms|MB|%|seconds)`
- Judgement calls that can't be regex-checked (e.g. "argues from concrete evidence") → `llm_judge` with a judge_prompt that references the exemplar's reasoning style

**Style layer** (produces `llm_judge` or `manual` criteria):

- Tone match to exemplar → `llm_judge` with an explicit "matches the tone of this reference passage: {first 200 chars}" prompt
- Voice (active vs passive, first-person vs third-person) → `llm_judge` or `manual`
- Citation style or formatting conventions unique to the exemplar → `manual`

Rules of thumb:

- **No more than 2 `llm_judge` criteria per reverse prompt** — they're expensive to evaluate and easy to over-rely on. Prefer `rule` when the exemplar exposes an observable pattern.
- **At least one `manual` criterion for any deeply stylistic property** — those are the ones humans actually care about on review and shouldn't be auto-approved.
- **Anchor criteria to exemplar-specific features**, not generic ones. "Output uses headers" is useless; "Output has exactly the sections Summary / Trade-offs / Recommendation in that order" is useful.

### Exemplar types supported

| Exemplar type | Detected via | Template match |
|---------------|-------------|----------------|
| Code review | "critical issues", "suggestions", file:line refs | bugfix-template |
| Security audit | "vulnerability", severity levels, CVE refs | security-template |
| Architecture doc | "components", "tradeoffs", "decision" headings | research-template |
| API specification | HTTP methods, status codes, endpoint paths | api-template |
| Test plan | "test cases", "coverage", assertion patterns | testing-template |
| Bug report | "steps to reproduce", "expected", "actual" | bugfix-template |
| PR description | "what changed", "fixes #N", "breaking changes" | feature-template |
| Documentation | "installation", "usage", "configuration" | docs-template |
| Blog/content | "introduction", "key takeaways", "in this article" | content-template |
| Research/analysis | "methodology", "findings", "recommendations" | research-template |
| Ops report | "timeline", "root cause", "action items" | refactor-template |

### Flywheel integration

Reverse Reprompter is the **data pump** for the flywheel. Each reverse-engineered prompt creates a pre-graded outcome entry:

```
exemplar (known-good output) + generated prompt = high-confidence recipe
→ injected into .reprompter/flywheel/outcomes.ndjson
→ strategy learner can recommend this recipe for similar future tasks
→ solves cold-start problem (no need to accumulate data from scratch)
```

**Injection rules:**
- Only inject with explicit user consent ("Save to flywheel?")
- Exemplar outcomes get a +0.5 effectiveness bonus (user curated = high quality)
- Source field marked as `reverse-exemplar` to distinguish from execution outcomes
- User verdict defaults to `accept` (they chose the exemplar because it's good)

**When NOT to inject:**
- User says "just show me the prompt" or "don't save"
- Exemplar is too short or low quality (analysis quality score < 5)
- Flywheel is disabled (`REPROMPTER_FLYWHEEL=0`)

### Inspiration: Extraktor pattern

Reverse Reprompter follows the same architectural pattern as [Extraktor](https://github.com/AytuncYildizli/extraktor) (design system reverse-engineering from websites):

| Phase | Extraktor | Reverse Reprompter |
|-------|-----------|-------------------|
| **EXTRACT** | Scrape DOM, computed styles, assets | Parse structure, sections, patterns, tone |
| **ANALYZE** | Vision AI identifies components, layout | Classify task type, detect template match, infer constraints |
| **SYNTHESIZE** | Generate React components + genome.json | Generate XML prompt + flywheel entry |

The key borrowed insight is **dual-signal analysis**: Extraktor sends Claude both the screenshot AND the DOM for better results. Reverse Reprompter uses both structural analysis (heading count, bullet density, code blocks) AND content analysis (keywords, tone markers, domain signals) for classification.

### Token budget

| Phase | Tokens | Source |
|-------|--------|--------|
| Interview | 50-200 | AskUserQuestion (0-2 questions) |
| Analysis | 0 | Deterministic (no AI calls) |
| Prompt generation | ~500-1000 | XML prompt output |
| Extraction Card | ~100 | Summary table |
| **Total** | **~650-1300** | **Lighter than Single mode** |

Canonical implementation for structural analysis and classification lives in `the root repository reverse-engineering helper`. If docs and code ever diverge, the script is the source of truth.

---

## Quality scoring

**Always show before/after metrics:**

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| Clarity | 20% | Task unambiguous? |
| Specificity | 20% | Requirements concrete? |
| Structure | 15% | Proper sections, logical flow? |
| Constraints | 15% | Boundaries defined? |
| Verifiability | 15% | Success measurable? |
| Decomposition | 15% | Work split cleanly? (Score 10 if task is correctly atomic) |

```markdown
| Dimension | Before | After | Change |
|-----------|--------|-------|--------|
| Clarity | 3/10 | 9/10 | +200% |
| Specificity | 2/10 | 8/10 | +300% |
| Structure | 1/10 | 10/10 | +900% |
| Constraints | 0/10 | 7/10 | new |
| Verifiability | 2/10 | 8/10 | +300% |
| Decomposition | 0/10 | 8/10 | new |
| **Overall** | **1.45/10** | **8.35/10** | **+476%** |
```

> **Bias note:** Scores are self-assessed. Treat as directional indicators, not absolutes.

---

## Closed-loop quality (v6.0+)

For both modes, RePrompter supports post-execution evaluation:

1. **IMPROVE** — Score raw → generate structured prompt
2. **EXECUTE** — **Repromptverse mode only**: route to agent(s), collect output. **Single mode does not execute code/commands; it only generates prompts.**
3. **EVALUATE** — Score output/prompt against success criteria (0-10)
4. **RETRY** — Thresholds: Single mode retry if score < 7; Repromptverse retry if score < 8. Max 2 retries.

---

## Advanced features

### Reasoning-friendly prompting (Claude 4.x)
Prompts should be less prescriptive about HOW. Focus on WHAT — clear task, requirements, constraints, success criteria. Let the model's own reasoning handle execution strategy.

**Example:** Instead of "Step 1: read the file, Step 2: extract the function" → "Extract the authentication logic from auth.ts into a reusable middleware. Requirements: ..."

### Response prefilling (API only)
Prefill assistant response start to enforce format:
- `{` → forces JSON output
- `## Analysis` → skips preamble, starts with content
- `| Column |` → forces table format

### Context engineering
Generated prompts should COMPLEMENT runtime context (project memory file, skills, MCP tools), not duplicate it. Before generating:
1. Check what context is already loaded (project files, skills, MCP servers)
2. Reference existing context: "Using the project structure from project memory file..."
3. Add ONLY what's missing — avoid restating what the model already knows

### Capability policy routing (OpenClaw + multi-LLM)
When multiple providers/models are available, route each agent by capability tier:
- `reasoning_high`: audits, synthesis, high-risk tasks
- `long_context`: very large context windows or broad codebase scans
- `cost_optimized` / `latency_optimized`: low-risk triage and bulk tasks
- Always emit fallback chain with provider diversity (avoid single-provider hard dependency)

### Budgeted layered context
Build per-agent context in layers with explicit budgets:
1. Task contract (always preserved)
2. Local code facts
3. Selected references
4. Prior artifacts/handoffs

Emit a context manifest (used tokens, truncation flags, dropped entries) so retries are reproducible and debuggable.

### Strict artifact gate
Before synthesis, evaluate each artifact for:
- Required section coverage
- Verifiability (file:line refs when required)
- Boundary compliance (forbidden-pattern checks)
- Overall weighted score threshold

If gate fails, retry only with delta prompts (max 2 retries).

Implementation note: combine routing + patterns + model policy + context + adapter + evaluator through a single orchestration contract (`the root repository Repromptverse runtime helper`) to keep behavior deterministic across runtimes.

### Runtime feature flags
Repromptverse runtime supports deterministic toggles for rollout and troubleshooting:
- `REPROMPTER_POLICY_ENGINE=0|1` — disable/enable capability-based model routing
- `REPROMPTER_LAYERED_CONTEXT=0|1` — disable/enable layered context assembly
- `REPROMPTER_STRICT_EVAL=0|1` — disable/enable strict artifact evaluator defaults
- `REPROMPTER_PATTERN_LIBRARY=0|1` — disable/enable pattern selector activation
- `REPROMPTER_TELEMETRY=0|1` — disable/enable runtime telemetry emission for observability reports
- `REPROMPTER_FLYWHEEL=0|1` — disable/enable Prompt Flywheel outcome learning (v9.0+). Controls whether outcome records are **written** to `.reprompter/flywheel/outcomes.ndjson` after a run.
- `REPROMPTER_FLYWHEEL_BIAS=0|1` — disable/enable Prompt Flywheel bias injection at generation time (v3 read-path). Default **off**. When on, Mode 1 and Mode 2 consult `npm run flywheel:query` for a recommendation before picking a template and apply the bias only when confidence is medium/high with `sampleCount >= 3`. See "Flywheel bias injection" under Mode 1 for the full decision rule.
- `REPROMPTER_VERSION_CHECK=0|1` — disable/enable the version self-check (default **on**). See "Version self-check" below.

### Version self-check
RePrompter is distributed copy-based (no package manager tracks the installed version), so it can't auto-update — but it can tell the user when their copy is stale. On Hermes this version self-check does not run — the install package ships no `scripts/` helpers. To update, run `hermes skills install AytuncYildizli/reprompter/skills/reprompter` and start a new session.
- The check prints **only when behind** — an up-to-date (or undeterminable) install produces no output, so a session hook stays quiet. Use `--json` for the explicit `{local, latest, behind, notice}` status.
- It is **fail-soft**: offline, rate-limited, or unparseable responses produce no output and exit 0. It compares the local `SKILL.md` `metadata.version` against the latest GitHub release and caches the result ~24h under `XDG_CACHE_HOME` (keyed by repo), so repeat runs add no latency; the first uncached check waits up to ~3s for GitHub before giving up, and a *failed* lookup is cached ~1h so offline sessions don't repeat the timeout.
- Because the skill is **cached per session**, the notice tells the user to update *and start a new session* — an in-place file update does not apply to a running session.
- Hermes / non-Claude runtimes that don't ship the `scripts/` helpers can skip this; it is an operator convenience, not part of any output lane.

### Plugin migration nudge (Claude Code copy installs only)
This applies ONLY when the runtime is Claude Code and this skill is running from a copy-based install (personal `~/.claude/skills` or project `skills/`), NOT from a plugin install. A plugin install has `.claude-plugin/plugin.json` two directory levels above the skill root. On the FIRST reprompter invocation of a session in that situation, append ONE sentence to the end of the response: RePrompter is now installable as a Claude Code plugin with auto-updates and automatic ambient-gate setup (`/plugin marketplace add AytuncYildizli/reprompter`, then `/plugin install reprompter@reprompter`); remove the copy after migrating so it does not shadow the plugin skill. Never repeat it later in the session, and never mention it in plugin installs or on non-Claude-Code runtimes (Codex, OpenClaw, Grok, Hermes).

### Telemetry and observability
Every Repromptverse run should emit stage-level telemetry events with `runId`, `taskId`, stage name, status, latency, and provider/model where applicable.
- Event stages: `route_intent`, `select_patterns`, `resolve_model`, `build_context`, `plan_ready`, `spawn_agent`, `poll_artifacts`, `evaluate_artifact`, `retry_artifact`, `finalize_run`, `fingerprint_recipe`, `collect_outcome`, `gate_prompt`, `learn_strategy`
- Storage: `.reprompter/telemetry/events.ndjson`; `gate_prompt` events are written under `$XDG_CACHE_HOME/reprompter/telemetry` instead.
- Report command: `npm run telemetry:report`

### Prompt Flywheel (v9.0+)
Closed-loop outcome learning system. Every prompt reprompter generates carries a **recipe fingerprint** — a deterministic hash of the strategy decisions (template, patterns, capability tier, domain, context layers, quality bucket). After execution, **outcome signals** are passively collected and linked back to the fingerprint.

#### Flywheel user guidance
When the flywheel has enough historical data to influence a recommendation, the AI agent should communicate this to the user concisely:

**When to show flywheel info:**
- Show a brief one-liner when flywheel bias is applied to a plan (e.g., "Flywheel: using constraint-first pattern based on 8 past runs (score 8.7, high confidence)")
- Show when the recommended strategy differs from what would have been selected without historical data
- If the flywheel recommends a different template (via `flywheelBias.template`), prefer that template for prompt generation in Phase 2 unless the user explicitly overrides

**Template bias:** When `flywheelBias.template` is set, use that template ID for prompt generation instead of the default intent-routed template. This is the most impactful flywheel signal — template choice shapes the entire prompt structure. Log the override: "Flywheel: using {template} (historically {score}/10 over {N} runs)"

**When NOT to show flywheel info:**
- No outcome data exists yet (cold start) — do not mention the flywheel at all
- Confidence is `insufficient` (<2 samples) or `low` (<5 samples) — silently skip, no user-facing note
- Bias lookup found data but no changes were applied — nothing to report

**Format:** Always a single inline note, never a table or multi-line block. Example:
> Flywheel: preferring `security-template` + `self-critique-checkpoint` pattern (9 runs, score 8.3/10, high confidence)

**Privacy:** All flywheel data is local (`.reprompter/flywheel/`). Never reference specific past prompts, tasks, or user content in flywheel messages — only aggregate statistics (run count, score, confidence level).

**All data is stored locally.** Nothing is transmitted anywhere. Storage: `.reprompter/flywheel/outcomes.ndjson`.

#### Bias-on vs bias-off A/B contract (v3 part 3)

The attribution mechanism (records carrying `applied_recommendation`) and the flag (`REPROMPTER_FLYWHEEL_BIAS=0|1`) exist so that bias can be measured, not just described. The contract:

- **Bias-on record** = an outcome whose run consulted the flywheel AND applied a recommendation. The record MUST carry `applied_recommendation = { recipe_hash, confidence, sample_count, applied_at }`.
- **Bias-off record** = every other outcome: `REPROMPTER_FLYWHEEL_BIAS=0` runs, flag-on runs where the query returned `null`, and flag-on runs where the query returned low-confidence (below the medium/high threshold). These records MUST NOT carry `applied_recommendation` at all. **Absence is the control-group signal.** Never stamp a null/placeholder block "to be tidy" — that collapses the A/B partition.

Read the A/B report with `npm run flywheel:ab` (optionally `-- --task-type <slug>` to scope). It returns `{ with_bias: {count, mean, median}, without_bias: {count, mean, median}, delta_mean_effectiveness, notes }`. Notes flag low-sample groups (<5 per side) so you don't over-read noise. A positive `delta_mean_effectiveness` means bias-on outcomes averaged higher than bias-off outcomes for this task type; negative means the opposite. Only consider flipping `REPROMPTER_FLYWHEEL_BIAS` to default-on after both groups pass the 5-sample bar and the delta is consistent across multiple task types.

**How it works:**
1. **Fingerprint** — At `plan_ready`, the recipe vector (template + patterns + tier + domain + layers + quality bucket) is hashed into a 16-char fingerprint
2. **Outcome collection** — At `finalize_run`, passive signals are captured: artifact evaluator score/pass, retry count, execution time. Linked to the recipe fingerprint.
3. **Strategy learning** — On future runs, the learner queries the outcome ledger for similar past tasks, scores each recipe group (time-decay weighted), and recommends the historically best-performing strategy

**Effectiveness scoring:**
- Base: artifact evaluator score
- Penalties: retries (-0.5 each), post-corrections (-0.3 each, capped at -2.0)
- Bonus: first-attempt pass (+0.5)
- Overrides: explicit user reject (caps at 3.0), explicit user accept (floors at 7.0)

**Time decay:** 7-day half-life. Recent outcomes weigh more. Month-old outcomes have <10% influence.

**Confidence levels:** high (10+ samples), medium (5-9), low (2-4), insufficient (<2, no recommendation made).

Report command: `npm run flywheel:report`
Benchmark command: `npm run benchmark:flywheel`

### Pattern library (pluggable)
Treat prompt/context engineering advancements as toggleable patterns (not fixed doctrine):
- Constraint-first framing
- Uncertainty labeling
- Self-critique checkpoint
- Delta retry scaffold
- Evidence-strength labeling
- Context-manifest transparency

Activate by task/domain/outcome profile and validate via benchmark fixtures.

### Token budget
Keep generated prompts under ~2K tokens for single mode, ~1K per agent for Repromptverse. Longer prompts waste context window without improving quality. If a prompt exceeds budget, split into phases or move detail into constraints.

### Uncertainty handling
Always include explicit permission for the model to express uncertainty rather than fabricate:
- Add to constraints: "If unsure about any requirement, ask for clarification rather than assuming"
- For research tasks: "Clearly label confidence levels (high/medium/low) for each finding"
- For code tasks: "Flag any assumptions about the codebase with TODO comments"

---

## Ambient Prompt Gate (Claude Code plugin/UserPromptSubmit hook)

The Ambient Prompt Gate is a Claude Code `UserPromptSubmit` hook that scores every incoming prompt with the same six RePrompter quality dimensions (clarity, specificity, structure, constraints, verifiability, decomposition). It stays silent for slash commands, acknowledgements, short prompts, non-task prompts, concise direct atomic tasks, prompts that already mention reprompting, and prompts above the configured threshold. For task-shaped prompts below threshold, it injects one line of model-facing context suggesting a one-time offer to structure the request via RePrompter before proceeding.

It NEVER blocks a prompt. The hook is fail-soft: malformed stdin, unreadable state, telemetry errors, or any internal failure produce empty stdout and exit 0. It never writes prompt text to telemetry or state; telemetry contains only score, weakest dimensions, whether it nudged, the reason, and a hashed session correlation id.

Recommended Claude Code install: install the plugin. The plugin registers both the `/reprompter:reprompter` skill namespace and the Ambient Prompt Gate hook automatically:

```text
/plugin marketplace add AytuncYildizli/reprompter
/plugin install reprompter@reprompter
```

For copy-based installs only, add the `UserPromptSubmit` hook in `Claude Code settings file`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node /absolute/path/to/skills/reprompter/scripts/prompt-gate.js" } ] }
    ]
  }
}
```

Plugin hooks can still be globally disabled by Claude Code's `disableAllHooks`; use `REPROMPTER_AMBIENT=0` for the granular per-feature off switch while keeping the plugin skill installed. Hermes installs ship no `scripts/` helpers, so use the Claude Code plugin, a git clone, or a copy-based Claude Code install if you want to run this gate.

| Env flag | Values | Effect |
|----------|--------|--------|
| `REPROMPTER_AMBIENT` | `"0"` / unset | Kill switch. `"0"` disables all nudges. |
| `REPROMPTER_AMBIENT_THRESHOLD` | number | Overall score threshold for nudging. Default `5`. |
| `REPROMPTER_AMBIENT_COOLDOWN_MIN` | number | Per-session cooldown after a nudge. Default `15`. |
| `REPROMPTER_TELEMETRY` | `"0"` / unset | `"0"` disables the privacy-safe `gate_prompt` telemetry event. |

State lives under the user's cache directory (`$XDG_CACHE_HOME/reprompter/ambient-gate.json`, or `~/.cache/reprompter/ambient-gate.json`) and stores only session ids plus last-nudge timestamps. Telemetry, when enabled, is written under that same cache root, never into the user's project cwd.

Other runtimes (Codex hooks, Hermes) are a documented follow-up; v12.8.0 is Claude Code-only.

---

## Settings (for Repromptverse mode)

> Note: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is an experimental flag that may change in future Claude Code versions. Check [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) for current status.

In `Claude Code settings file`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "preferences": {
    "teammateMode": "tmux",
    "model": "opus"
  }
}
```

| Setting | Values | Effect |
|---------|--------|--------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `"1"` | Enables agent team spawning |
| `teammateMode` | `"tmux"` / `"default"` | `tmux`: each teammate gets a visible split pane. `default`: teammates run in background |
| `model` | `"opus"` / `"sonnet"` | Teammates default to Haiku. Always set `model: opus` explicitly in your prompt — do not rely on runtime defaults. |

`/goal` preflight on Claude Code requires CLI v2.1.139+ (no config flag needed). `/goal` depends on Claude Code's hooks layer: if `disableAllHooks` or `allowManagedHooksOnly` is set in `settings.json`, `/goal` is unavailable on any version. v2.1.139 silently hung in that case; v2.1.140 surfaces a clear error message instead, but neither version runs `/goal` under hook-blocking settings — you must permit hooks for the lane to work. See the `/goal` preflight lane near the top of this skill for the full Card + command flow.

### Codex CLI

Install the skill under `Codex skills directory/reprompter/` (same structure as `Claude Code skills directory/`). Codex reads config from `Codex config file`:

```toml
# Codex config file
model = "gpt-5.4"          # default model for agent runs
approval_policy = "never"  # for interactive Codex TUI only; `codex exec` already defaults to never in headless

[features]
multi_agent = true         # enables native subagents (Option D1, Codex 0.121.0+)
goals = true               # enables /goal preflight flow when the CLI release gates it
codex_hooks = false        # experimental; leave off unless you need hook events

[agents]
max_threads = 6            # concurrent subagent workers (default)
max_depth = 1              # no sub-subagents by default
job_max_runtime_seconds = 1800

[reprompter]
default_mode = "parallel"  # parallel | sequential — Phase 1 picks Option D vs E
artifact_root = "/tmp"     # override if your runtime sandboxes /tmp
```

| Setting | Values | Effect |
|---------|--------|--------|
| `model` | any Codex-supported id | Default model when `--model` is omitted from `codex exec`. |
| `approval_policy` | `"untrusted"` / `"on-request"` / `"never"` | Applies to the interactive Codex TUI. `codex exec` runs headless and defaults to `never`, so Option D2 workers never need this key set. |
| `features.multi_agent` | `true` / `false` | Enables native subagents (Option D1). Default-enabled in current Codex releases (0.121.0+); set explicitly only if your config disabled it. |
| `features.goals` | `true` / `false` | Enables Codex `/goal` when the installed CLI exposes the experimental goals feature. Use RePrompter first, then run its exact `/goal <summary of expanded prompt>` command. Claude Code CLI v2.1.139+ and Hermes Agent expose the same `/goal` surface natively, without a Codex feature flag — see the `/goal` preflight lane near the top of this skill for supported runtimes. |
| `agents.max_threads` | integer, default `6` | Concurrent subagent worker cap. |
| `agents.max_depth` | integer, default `1` | Spawn nesting depth (1 = subagents only, no grandchildren). |
| `reprompter.default_mode` | `"parallel"` / `"sequential"` | Skill-defined hint consumed by Phase 1. |
| `reprompter.artifact_root` | absolute path | Override `/tmp` when needed. |

If Codex CLI is the only runtime available, skip the Claude Code block above — Single and Repromptverse modes do not require Claude Code to be installed.

### Hermes Agent

Install the skill under Hermes' default skill directory. Run this from the parent directory that contains the RePrompter checkout as `reprompter/`:

```bash
mkdir -p Hermes skills directory
cp -R reprompter Hermes skills directory/
```

Hermes also supports external skill directories through its skills configuration. RePrompter only needs the skill directory to be visible to Hermes; no JS adapter or npm dependency is required.

Useful Hermes config knobs for Repromptverse and `/goal`:

```toml
[delegation]
max_concurrent_children = 3
max_spawn_depth = 1

[goals]
max_turns = 20
```

| Setting | Values | Effect |
|---------|--------|--------|
| `delegation.max_concurrent_children` | integer, default `3` | Max concurrent children for `delegate_task` batch runs (Option G1). Larger teams should split batches or use G2/G3. |
| `delegation.max_spawn_depth` | integer, default `1` | Spawn nesting depth. Keep at 1 for normal Repromptverse so workers do not create uncontrolled subteams. |
| `goals.max_turns` | integer, default `20` | Bounded continuation budget for Hermes `/goal` runs. |

Hermes `/goal` accepts the same `/goal <objective>` command shape used by Codex CLI and Claude Code CLI. For Repromptverse, the native path is Option G: G1 `delegate_task`, G2 shell-level `hermes -z` / `hermes chat -q`, or G3 Kanban when durable orchestration is explicitly requested. See `references/runtime/hermes-agent-runtime.md`.

---

## Proven results

### Single prompt (v6.0)
Rough crypto dashboard prompt: **1.6/10 → 9.0/10** (+462%)

### Repromptverse E2E (v6.1)
3 Opus agents, sequential pipeline (PromptAnalyzer → PromptEngineer → QualityAuditor):

| Metric | Value |
|--------|-------|
| Original score | 2.15/10 |
| After Repromptverse | **9.15/10** (+326%) |
| Quality audit | PASS (99.1%) |
| Weaknesses found → fixed | 24/24 (100%) |
| Cost | $1.39 |
| Time | ~8 minutes |

### Repromptverse vs raw Agent Teams (v7.0)
Same audit task, 4 Opus agents:

| Metric | Raw | Repromptverse | Delta |
|--------|-----|----------------|-------|
| CRITICAL findings | 7 | 14 | +100% |
| Total findings | ~40 | 104 | +160% |
| Cost savings identified | $377/mo | $490/mo | +30% |
| Token bloat found | 45K | 113K | +151% |
| Cross-validated findings | 0 | 5 | — |

---

## Tips

- **More context = fewer questions** — mention tech stack, files
- **"expand"** — if Quick Mode gave too simple a result, re-run with full interview
- **"quick"** — skip interview for simple tasks
- **"no context"** — skip auto-detection
- Context is per-project — switching directories = fresh detection

---

## Test scenarios

See the root repository TESTING.md for the full verification scenarios and anti-pattern examples.

---

## Appendix: Extended XML tags

Templates may add domain-specific tags beyond the 8 required base tags. Always include all base tags first.

| Extended Tag | Used In | Purpose |
|-------------|---------|---------|
| `<symptoms>` | bugfix | What the user sees, error messages |
| `<investigation_steps>` | bugfix | Systematic debugging steps |
| `<endpoints>` | api | Endpoint specifications |
| `<component_spec>` | ui | Component props, states, layout |
| `<agents>` | swarm | Agent role definitions |
| `<task_decomposition>` | swarm | Work split per agent |
| `<coordination>` | swarm | Inter-agent handoff rules |
| `<routing_policy>` | repromptverse | Speaker and router policy |
| `<termination_policy>` | repromptverse | Max turn/time and stop conditions |
| `<artifact_contract>` | repromptverse | Output schema and ownership |
| `<evaluation_loop>` | repromptverse | Score thresholds and retry policy |
| `<research_questions>` | research | Specific questions to answer |
| `<methodology>` | research | Research approach and methods |
| `<reasoning>` | research | Reasoning notes space (non-sensitive, concise) |
| `<current_state>` | refactor | Before state of the code |
| `<target_state>` | refactor | Desired after state |
| `<coverage_requirements>` | testing | What needs test coverage |
| `<threat_model>` | security | Threat landscape and vectors |
| `<structure>` | docs | Document organization |
| `<reference>` | docs | Source material to reference |

## Hermes Agent Support (Additive Section — Zero Impact on Claude, Codex, OpenClaw, Grok)

When the current toolset includes `delegate_task` together with at least two of `terminal`, `process`, `read_file`, `write_file`, `patch`, `search_files`, `todo`, `skills_list`, or `skill_view`, you are executing under Hermes Agent.

In this environment:

- Single mode, Smart Interview, Dimension Interview, pattern library usage, prompt generation (Phases 1–2), quality scoring, evaluation loop, flywheel, Reverse Reprompter, and all template logic remain identical to other runtimes. No change in behavior or output format.

- `/goal` preflight is supported. Hermes accepts `/goal <objective>`, exposes `/goal status`, `/goal pause`, `/goal resume`, and `/goal clear`, and runs a bounded continuation loop until success, pause/clear, or budget exhaustion. The Goal Command Card should use:
  - `Runtime`: `Hermes Agent`
  - `Paste Into`: `Hermes TUI prompt, as-is`
  - `Mode`: `/goal preflight`

- For Repromptverse Phase 3 execution, treat this as **Option G** (Hermes-native parallel):
  - Use `delegate_task(tasks=[...])` for in-session parallel workers (G1 — recommended for most interactive runs).
  - Or shell-level external orchestration: write each prompt with a single-quoted heredoc, load it into `prompt_text`, then run `hermes -z "$prompt_text" --toolsets terminal,file,web,skills &` and `wait` (G2).
  - Use Hermes Kanban only when the user explicitly asks for durable, restart-surviving, multi-profile, or human-in-loop orchestration (G3).
  - Every worker **must** be explicitly instructed in its prompt/context to write its final output to the exact path `/tmp/rpt-{taskname}-{role}.md` (identical artifact contract used by all other runtimes).
  - Hermes `delegate_task` children start from fresh context. The parent must pass the full per-agent XML prompt, interviewContext, artifact path, and success criteria through each task's `goal` / `context`.

- Full invocation examples, `delegate_task` batch shape, `hermes -z` and `hermes chat -q` shell-level usage, Kanban boundaries, concurrency recommendations, retry patterns, `/goal` behavior, and the complete list of Hermes gotchas are documented in:

  `references/runtime/hermes-agent-runtime.md`

Read that file the first time you detect Hermes-native tools in the current environment.

This section is purely additive. The Phase 3 "Runtime auto-pick" decision tree (see above) contains an explicit Order-2 check for the Hermes tool surface (`delegate_task` plus at least two supporting Hermes tools). When this signature is detected, Repromptverse **automatically selects Option G** and uses the Hermes-native execution path documented in `references/runtime/hermes-agent-runtime.md`. No manual override is required for normal Repromptverse runs on Hermes Agent.

The rest of the skill remains unchanged for every other runtime. Non-Hermes users (Claude Code, Codex, OpenClaw, Grok CLI) see zero difference in behaviour or output.

Hermes users can install this skill by copying the directory to `Hermes skills directory/reprompter/` or by adding the repo path to Hermes' external skill directories.

## Grok CLI Support (Additive Section — Zero Impact on Claude, Codex, OpenClaw, Hermes)

When the current toolset includes `spawn_subagent` together with at least two of `run_command`, `todo_write`, `ask_user_question`, you are executing under Grok CLI (xAI Grok 4.3+). A normal Grok session will usually also expose `read_file`, `search_replace`, and `write`.

In this environment:

- Single mode, Smart Interview, Dimension Interview, pattern library usage, prompt generation (Phases 1–2), quality scoring, evaluation loop, flywheel, Reverse Reprompter, and all template logic remain 100% identical to other runtimes. No change in behavior or output format.

- For Repromptverse Phase 3 execution, treat this as **Option F** (Grok-native parallel):
  - Use `spawn_subagent` for in-session parallel workers (F1 — recommended for most interactive runs).
  - Or shell-level (external orchestration): `grok -p "..." --yolo --sandbox workspace &` then `wait` (F2). Example:
    ```bash
    grok -p "..." --yolo --sandbox workspace &
    wait
    ```
  - Recommended parameters for `spawn_subagent`:
    - `subagent_type`: "general-purpose" (full capability) or "explore" / "plan" for specialized workers
    - `persona`: "implementer", "researcher", "reviewer", "security-auditor", or a custom persona defined in `Grok personas directory/*.toml`
    - `fork_context`: true (strongly recommended — the worker receives the original user task, Smart/Dimension Interview answers, team plan, and interviewContext without repetition)
    - `capability_mode`: "execute" (default for general-purpose) or "read-only" / "read-write"
    - `prompt`: the full per-agent reprompted XML document produced in Phase 2
  - Every worker **must** be explicitly instructed in its prompt to write its final output to the exact path `/tmp/rpt-{taskname}-{role}.md` (identical artifact contract used by all other runtimes).
  - Status Line during Phase 3: combine `todo_write` (for orchestrator tracking) with `run_command` + `ls /tmp/rpt-*.md` (exclude any `.prompt.md` or `.stdout` files) and render the compact line:
    ```
    Agents: ✅ 3/5  ⏳ 1/5  🔄 1/5 (retry 1)
    ```

- Full invocation examples, `Grok config file` [subagents] settings, sandbox profile interaction, model-compatible headless flags, concurrency recommendations, retry patterns, and the complete list of "What Grok CLI does NOT provide" (no native TeamCreate/SendMessage/TeamDelete cross-messaging between workers, no /goal surface, no automatically shared TaskList across subagents, only partial hook matcher aliases for Claude tool names, etc.) are documented in:

  `references/runtime/grok-cli-runtime.md`

Read that file the first time you detect Grok-native tools in the current environment.

This section is purely additive. The Phase 3 "Runtime auto-pick" decision tree (see above) contains an explicit Order-1 check for the Grok tool surface (`spawn_subagent` must be present together with at least two of `run_command`, `todo_write`, `ask_user_question`). When this signature is detected, Repromptverse **automatically selects Option F** and uses the Grok-native execution path documented in `references/runtime/grok-cli-runtime.md`. No manual override is required for normal Repromptverse runs on Grok CLI.

The rest of the skill (Single, `/goal` preflight, Reverse, all templates, scoring, flywheel, etc.) is completely unchanged for every other runtime. Non-Grok users (Claude Code, Codex, OpenClaw, Hermes Agent) see zero difference in behaviour or output.

Grok users can install this skill by copying the directory to `Grok skills directory/reprompter/` (or continue using the existing `Claude Code skills directory/reprompter/` location — Grok automatically loads skills from the Claude compatibility path).
