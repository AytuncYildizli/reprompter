---
name: reprompter
description: |
  Transform messy prompts into well-structured, effective prompts — single or multi-agent.
  Use when: "reprompt", "reprompt this", "clean up this prompt", "structure my prompt", rough text needing XML tags and best practices, "reprompter teams", "repromptverse", "run with quality", "smart run", "smart agents", "multi-agent marketing", "campaign swarm", "engineering swarm", "ops swarm", "research swarm", multi-agent tasks, audits, parallel work, anything going to agent teams.
  Don't use when: simple Q&A, pure chat, immediate execution-only tasks. See "Don't Use When" section for details.
  Outputs: Structured XML/Markdown prompt, quality score (before/after), optional team brief + per-agent sub-prompts, agent team output files.
  Success criteria: Single mode quality score ≥ 7/10; Repromptverse per-agent prompt quality score 8+/10; all required sections present, actionable and specific.
compatibility: |
  Single mode works on Claude surfaces, OpenClaw, and Codex.
  Repromptverse mode supports Claude Code (tmux/TeamCreate), OpenClaw (sessions_spawn), and Codex (parallel sessions if available, sequential fallback otherwise).
  Sequential fallback works with any LLM runtime.
metadata:
  author: AytuncYildizli
  version: 8.2.0
---

# RePrompter v8.2

> **Your prompt sucks. Let's fix that.** Single prompts or full agent teams — one skill, two modes.

---

## Two modes

| Mode | Trigger | What happens |
|------|---------|-------------|
| **Single** | "reprompt this", "clean up this prompt" | Interview → structured prompt → score |
| **Repromptverse** | "reprompter teams", "repromptverse", "run with quality", "smart run", "smart agents", "campaign swarm", "engineering swarm", "ops swarm", "research swarm" | Plan team → reprompt each agent → execute (tmux/TeamCreate/sessions_spawn/Codex/sequential) → evaluate → retry |

Auto-detection: if task mentions 2+ systems, "audit", or "parallel" → ask: "This looks like a multi-agent task. Want to use Repromptverse mode?"

Definition — **2+ systems** means at least two distinct technical domains that can be worked independently. Examples: frontend + backend, API + database, mobile app + backend, infrastructure + application code, security audit + cost audit.

## Don't use when

- User wants a simple direct answer (no prompt generation needed)
- User wants casual chat/conversation
- Task is immediate execution-only with no reprompting step
- Scope does not involve prompt design, structure, or orchestration

> Clarification: RePrompter **does** support code-related tasks (feature, bugfix, API, refactor) by generating better prompts. It does **not** directly apply code changes in Single mode. Direct code execution belongs to coding-agent unless Repromptverse execution mode is explicitly requested.

---

## Mode 1: Single prompt

### Process

1. **Receive raw input**
2. **Input guard** — if input is empty, a single word with no verb, or clearly not a task → ask the user to describe what they want to accomplish
   - Reject examples: "hi", "thanks", "lol", "what's up", "good morning", random emoji-only input
   - Accept examples: "fix login bug", "write API tests", "improve this prompt"
3. **Quick Mode gate** — under 20 words, single action, no complexity indicators → generate immediately
4. **Smart Interview** — use `AskUserQuestion` with clickable options (2-5 questions max)
5. **Generate + Score** — apply template, show before/after quality metrics
6. **Single-pass evaluator** — run self-eval rubric and do one delta rewrite if score < 7

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

<success_criteria>
- {Testable condition 1}
- {Measurable outcome 2}
</success_criteria>
```

### Project context detection

Auto-detect tech stack from current working directory ONLY:
- Scan `package.json`, `tsconfig.json`, `prisma/schema.prisma`, etc.
- Session-scoped — different directory = fresh context
- Opt out with "no context", "generic", or "manual context"
- Never scan parent directories or carry context between sessions

---

## Mode 2: Repromptverse (Agent Teams)

### TL;DR

```
Raw task in → quality output out. Every agent gets a reprompted prompt.

Phase 1: Score raw prompt, plan team, define roles (YOU do this, ~30s)
Phase 2: Write XML-structured prompt per agent (YOU do this, ~2min)
Phase 3: Launch agents (tmux, TeamCreate, sessions_spawn, Codex, or sequential) (AUTOMATED)
Phase 4: Read results, score, retry if needed (YOU do this)
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

### Phase 1: Team plan (~30 seconds)

1. **Score raw prompt** (1-10): Clarity, Specificity, Structure, Constraints, Decomposition
   - Phase 1 uses 5 quick-assessment dimensions. The full 6-dimension scoring (adding Verifiability) is used in Phase 4 evaluation.
2. **Pick mode:** parallel (independent agents) or sequential (pipeline with dependencies)
3. **Define team:** 2-5 agents max, each owns ONE domain, no overlap
4. **Write team brief** to `/tmp/rpt-brief-{taskname}.md` (use unique tasknames to avoid collisions between concurrent runs)

### Phase 2: Repromptverse prompt pack (~2 minutes)

For EACH agent:
1. Pick the best-matching template from `references/` (or use base XML structure)
2. Read it, then apply these **per-agent adaptations**:

- `<role>`: Specific expert title for THIS agent's domain
- `<context>`: Add exact file paths (verified with `ls`), what OTHER agents handle (boundary awareness)
- `<requirements>`: At least 5 specific, independently verifiable requirements
- `<constraints>`: Scope boundary with other agents, read-only vs write, file/directory boundaries
- `<output_format>`: Exact path `/tmp/rpt-{taskname}-{agent-domain}.md`, required sections
- `<success_criteria>`: Minimum N findings, file:line references, no hallucinated paths

**Score each prompt — target 8+/10.** If under 8, add more context/constraints.

Write all to `/tmp/rpt-agent-prompts-{taskname}.md`

### Phase 3: Execute

Phase 3 has platform-specific execution methods. Pick the one that matches your environment. The reprompted prompts from Phase 2 work with any method.

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

# 4. Monitor (poll every 15-30s)
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
4. Deliver final report to user

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

# 3. Spawn teammates (MUST specify model=opus)
Task(subagent_type="general-purpose", team_name="rpt-{taskname}", name="agent-1", model="opus",
     prompt="You are {role} on the rpt-{taskname} team. Your task is Task #1. [full prompt]",
     run_in_background=true)
Task(subagent_type="general-purpose", team_name="rpt-{taskname}", name="agent-2", model="opus",
     prompt="You are {role} on the rpt-{taskname} team. Your task is Task #2. [full prompt]",
     run_in_background=true)

# 4. Wait for teammates to complete (messages arrive automatically)
# 5. Compile synthesis from teammate reports
# 6. Shutdown teammates and delete team
SendMessage(type="shutdown_request", recipient="agent-1")
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

#### Option D: Codex parallel sessions (Codex runtime)

When running in Codex:
1. Create one session per agent role (or use native subagents if available).
2. Send each session the corresponding prompt from `/tmp/rpt-agent-prompts-{taskname}.md`.
3. Require each session to write exactly one artifact to `/tmp/rpt-{taskname}-{agent-domain}.md`.
4. Poll for artifact completion every 15-30s with a hard cap (max 40 polls total).
5. Run Phase 4 evaluator loop and merge to `/tmp/rpt-{taskname}-final.md`.

If Codex parallel sessions are not available, immediately fall back to Option E.

#### Option E: Sequential (any LLM)

No parallel execution tools available? Run each agent's reprompted prompt one at a time in the same session. Works with any LLM (Claude, GPT, Gemini, Codex, etc.). Slower but fully platform-agnostic.

The reprompted prompts from Phase 2 are pure text. They work regardless of execution method.

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
Generated prompts should COMPLEMENT runtime context (CLAUDE.md, skills, MCP tools), not duplicate it. Before generating:
1. Check what context is already loaded (project files, skills, MCP servers)
2. Reference existing context: "Using the project structure from CLAUDE.md..."
3. Add ONLY what's missing — avoid restating what the model already knows

### Token budget
Keep generated prompts under ~2K tokens for single mode, ~1K per agent for Repromptverse. Longer prompts waste context window without improving quality. If a prompt exceeds budget, split into phases or move detail into constraints.

### Uncertainty handling
Always include explicit permission for the model to express uncertainty rather than fabricate:
- Add to constraints: "If unsure about any requirement, ask for clarification rather than assuming"
- For research tasks: "Clearly label confidence levels (high/medium/low) for each finding"
- For code tasks: "Flag any assumptions about the codebase with TODO comments"

---

## Settings (for Repromptverse mode)

> Note: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is an experimental flag that may change in future Claude Code versions. Check [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) for current status.

In `~/.claude/settings.json`:
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

See [TESTING.md](TESTING.md) for 20 verification scenarios + anti-pattern examples.

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
