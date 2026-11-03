---
name: reprompter-goal-workflow
description: |
  RePrompter Improve output formats — compress a finished spec-XML prompt to a `/goal <objective>` command (Codex CLI, Claude Code v2.1.139+, Hermes), compile it to a runnable `.workflow.js` for Claude's dynamic Workflow tool, or deliver it to another model via headless-relay.
  Use when: "before /goal", "for /goal", "Codex /goal", "Claude Code /goal", "Hermes /goal", improve a goal prompt, "compile to workflow", "workflow preflight", "dynamic workflow"; or the headless-relay delivery step after a finished Single/Reverse prompt.
  Don't use for outcome-prose / One-Shot build briefs (delivered as-is), simple Q&A, or execution-only tasks.
  Outputs: /goal command card (Codex/Claude Code/Hermes); Workflow Command Card + runnable .workflow.js (Workflow preflight lane / Option H); optional relay delivery offer.
  Target score: spec >= 7/10.
---

# RePrompter — `/goal`, Workflow script, and headless-relay delivery

> Mode skill of the `reprompter` plugin. Entry/routing: `../reprompter/SKILL.md`. Generate the spec prompt with `../reprompter-improve/SKILL.md`, then apply the format below. Content below is verbatim from root SKILL.md lines 58-211 (`/goal`), 212-356 (Workflow script) and 1481-1558 (headless-relay). `references/workflow-template.md` and `references/runtime/claude-workflow-runtime.md` are copied alongside; Repromptverse Option H is in `../reprompter-team/references/runtime-options.md`. `scripts/<name>` paths resolve to the bundled `../reprompter/scripts/<name>` (e.g. `node ../reprompter/scripts/workflow-command.js --help`).
>
> **Required reading:** `../reprompter/references/advanced-features.md`. The always-on rules in `../reprompter/SKILL.md` → "Core shared rules" (context check, uncertainty permission, WHAT not HOW) apply before any `/goal` compression or workflow compile.

## Format: `/goal` command (Improve output)

When the user mentions `/goal`, `before /goal`, `for /goal`, "Codex /goal", "Claude Code /goal", "Hermes /goal", or asks to improve a goal prompt, run RePrompter before the goal is submitted.

This lane works on **Codex CLI** (any version exposing the `goals` feature), **Claude Code CLI v2.1.139+** (the release that shipped a native `/goal` slash command on 2026-05-11), and **Hermes Agent** (persistent goals documented in the v0.13.0 / 2026.5.7 release). These runtimes accept the same `/goal <objective>` shape, so the compression flow is identical; only the setup check and a few runtime-specific operational notes differ. If the target runtime is Claude surfaces without `/goal` support, OpenClaw, Grok CLI, Gemini, or another LLM, use Improve (spec-XML) or Repromptverse instead; do not emit a `/goal` command for runtimes that have no `/goal` surface.

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
5. Build the rich expanded prompt first, using the normal RePrompter structure: goal/task, context, assumptions, requirements, constraints, execution notes, and success criteria.
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
| Missing Inputs | Up to 3 unresolved unknowns; use documented assumptions for reasonable defaults and write `none` when the prompt is ready |
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
<assumptions>
- {reasonable default applied because this autonomous goal should not block on a low-value question}
</assumptions>
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
- `/goal` is an experimental alpha feature gated by `features.goals = true` in `~/.codex/config.toml`. The local alpha binary exposes `Usage: /goal <objective>`, `ThreadGoal.objective`, `tokenBudget`, `/goal pause`, `/goal resume`, and `/goal clear`.
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
npm install -g @openai/codex@latest
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
#   curl -sL https://claude.ai/install.sh | bash
# or follow the install path you used originally.
```

No config flag is required — `/goal` is enabled by default once Claude Code is at v2.1.139 or later. However, `/goal` depends on Claude Code's hooks layer: if `disableAllHooks` or `allowManagedHooksOnly` is set in `~/.claude/settings.json`, the command is unavailable on any version. v2.1.139 silently hung in that case; v2.1.140 surfaces a clear error message instead. Upgrading does **not** re-enable `/goal` under hook-blocking settings — permitting hooks is the only way to use `/goal` on Claude Code. Managed environments that block hooks should use Single mode for goal-shaped work.

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

## Format: Workflow script (Improve output)

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
2. Infer the real intent and build the rich expanded prompt (the XML basis below) with all eight base tags + `<assumptions>` + `<success_criteria>`. Because Workflow preflight is autonomous execution, skip clarification questions when a reasonable default exists and document the default in `<assumptions>`.
3. Reprompt one prompt per role (each owns ONE domain, no overlap), exactly as Repromptverse Phase 2.
4. Compile to a `.workflow.js` via `scripts/workflow-command.js` (`buildWorkflowCommand`): pure-literal `meta`, schema-validated `agent()` returns, `parallel()`/`pipeline()` per the H1/H2 heuristic, `runId`/`taskname` from `args`, `model` omitted, `filter(Boolean)`, bounded delta-retry (max 2/role).
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
| Missing Inputs | Up to 3 unresolved unknowns; use documented assumptions for reasonable defaults, or `none` |
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
<assumptions>
- {Documented default used instead of blocking workflow compilation on a low-value question}
</assumptions>
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

Compile with the workflow compiler (`scripts/workflow-command.js`) on the rough task with an `--out-dir`: it writes `workflow-command.json`, the runnable `rpt-{taskname}.workflow.js`, `workflow-command-card.json`, and `reprompter-expanded-prompt.md`. Add `--ultracode` / `--no-ultracode` to force the emission tier.

See `references/workflow-template.md` and `references/runtime/claude-workflow-runtime.md` for the full template and runtime contract.

---


## Deliver via headless-relay (post-output step)

The full headless-relay delivery step (offer once after a finished Single/Reverse prompt; relay to another model) lives in `references/headless-relay.md`. **Read it whenever a prompt is finished and relay delivery may be offered.**
