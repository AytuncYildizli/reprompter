---
name: reprompter-improve
description: |
  RePrompter Improve intent — turn a rough prompt into a scored, structured spec prompt (or an outcome-prose build brief when the ask is a whole product).
  Use when: "reprompt", "reprompt this", "clean up this prompt", "improve this prompt", "make my prompt better", "fix my prompt", "before /goal", "compile to workflow", "workflow preflight", or when the reprompter entry skill routes an Improve ask here.
  Don't use for simple Q&A, casual chat, or execution-only tasks.
  Outputs: XML/Markdown prompt with <success_criteria schema_version="1"> + before/after quality score table. Target score: >= 7/10.
---

# RePrompter — Improve (Single prompt)

> Mode skill of the `reprompter` plugin. Entry/routing: `../reprompter/SKILL.md`. Output formats beyond paste (`/goal` card, `.workflow.js`, headless-relay delivery): `../reprompter-goal-workflow/SKILL.md`. Whole-product builds: `../reprompter-oneshot/SKILL.md`. Multi-agent: `../reprompter-team/SKILL.md`. `scripts/<name>` paths resolve to the bundled `../reprompter/scripts/<name>` (e.g. `../reprompter/scripts/outcome-record.js`).
>
> **Required reading:** `../reprompter/references/advanced-features.md` (context engineering, uncertainty handling, token budget, Flywheel, pattern library). The always-on rules in `../reprompter/SKILL.md` → "Core shared rules" (context check, uncertainty permission, WHAT not HOW) apply to every generated prompt.
> Every template named below lives in `references/` next to this file. Content below is verbatim from root SKILL.md (lines 358-591, 1560-1606) except where marked _Moved_.

## Intent: Improve (Single prompt)

### Shape decision (specifiability router)

Before the template pick, decide the OUTPUT SHAPE from the interview:

**Default is spec-XML.** Only switch to outcome-prose on a STRONG whole-product signal, and when in doubt, stay spec-XML — a scored structured prompt is never the wrong answer for a coding task, and it is what "reprompt this" has always produced.

- **Spec-XML (default)** — any bounded change (bugfix, endpoint, refactor, a feature in named files), anything with an enumerable done-state, and anything ambiguous. Scored on the six dimensions, exactly as always.
- **Outcome-prose (only on a strong signal)** — the ask is to build a WHOLE product or artifact from near-zero (a whole app/game/site/deck), OR it names a real product as the quality bar for a from-scratch build ("build me X like Linear"). Then emit the One-Shot three-paragraph shape (`references/oneshot-template.md`), including its constraints sentence for load-bearing negatives ("never touch auth"). **Announce and offer the exit:** "This looks like a whole-product build — I'll write an autonomous build prompt; say 'spec' for the structured, scored version instead." The user's override always wins. Outcome-prose is not scored on the six dimensions. **This is the same artifact the Build intent produces** — an Improve ask that is really a whole-product build and the Build intent converge on one prose brief, deliberately; there is no separate Improve-only build shape to disambiguate.
- **Mixed asks** (a *bounded* change described with a reference, e.g. "add a settings page like Linear's to our app") are spec-XML: the reference informs the requirements, it does not trigger a from-scratch build. When genuinely unsure which one an ask is, ask one discriminator question — "a fresh build, or a change to something that exists?" — and default to spec-XML on a fresh session with no answer.

### Process

1. **Receive raw input**
2. **Input guard** — if input is empty, a single word with no verb, or clearly not a task → ask the user to describe what they want to accomplish
   - Reject examples: "hi", "thanks", "lol", "what's up", "good morning", random emoji-only input
   - Accept examples: "fix login bug", "write API tests", "improve this prompt"
3. **Quick Mode gate** — under 20 words, single action, no complexity indicators → generate immediately. A quick-mode task is bounded by definition, so it is always spec-XML; the shape decision does not run on this path (there is nothing whole-product about a sub-20-word atomic task).
4. **Smart Interview** — use `AskUserQuestion` with clickable options (2-5 questions max) for interactive Single mode. For prompts destined for autonomous execution (goal/workflow/team lanes), skip questions with reasonable defaults and emit an `<assumptions>` block the user can veto before running.
5. **Flywheel bias check (optional, read-only)** — if `REPROMPTER_FLYWHEEL_BIAS=1` is set in the environment, consult past outcomes before choosing a template. See "Flywheel bias injection" below.
6. **Generate + Score** — **if the shape decision above chose outcome-prose, skip this step's scoring**: emit the One-Shot prose brief (`references/oneshot-template.md`) and stop — outcome-prose is not scored on the six dimensions. Otherwise (spec-XML) apply the template and show before/after quality metrics. Generated prompts include a `<success_criteria schema_version="1">` block with 3-6 `<criterion>` entries. Each criterion has `id` (kebab-case slug, unique in block), `verification_method` (`rule` | `llm_judge` | `manual`), a one-sentence `<description>`, and — depending on method — an inline `<rule type="regex|predicate">` or `<judge_prompt>` (neither for `manual`). Schema of record: `references/outcome-schema.md`.
7. **Single-pass evaluator** — run self-eval rubric and do one delta rewrite if score < 7

**Why criteria are emitted:** so every prompt carries its own testable assertions; outcome records produced by `scripts/outcome-record.js` (added in the same PR) join criteria to results for flywheel learning.

#### Flywheel bias injection (v3 read-path)

_Moved:_ the full rules for step 5 (flywheel bias injection and attribution) and **Fleet sync (v12.14 privacy boundary)** are in `references/flywheel-bias.md`. Default is off (`REPROMPTER_FLYWHEEL_BIAS=1` enables it); only bias on `confidence ∈ {"medium", "high"}` AND `sampleCount >= 3`.

### Generate after interview

After interview completes, immediately:
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

**Task-specific questions** (required for compound prompts — replace lower-priority standard questions):
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
| One-Shot | `oneshot-template.md` | One prompt that builds a whole app/game/site - finishes in one session by default |
| Reverse | `reverse-template.md` | Reverse-engineered prompt from exemplar output |
| Team Brief | `team-brief-template.md` | Team orchestration brief |

**Priority** (most specific wins): marketing-swarm > engineering-swarm > ops-swarm > research-swarm > repromptverse > api > security > ui > testing > bugfix > refactor > content > docs > research > feature. For multi-agent tasks, use the best-fit swarm template + `repromptverse-template` + `team-brief-template`, then type-specific templates for each agent sub-prompt.

**How it works:** Read the matching template from `references/{type}-template.md`, then fill it with task-specific context. Templates are NOT loaded into context by default — only read on demand when generating a prompt. If the template file is not found, fall back to the Base XML Structure below.

> To add a new task type: create `references/{type}-template.md` following the XML structure below, then add it to the table above.

### Base XML structure

All templates follow this core section structure (8 required fields). XML is the default emitted format; Markdown headers are equally valid when requested by the user or runtime. Use as fallback if no specific template matches:

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
- {Load-bearing boundary or limit}
- {What to do instead of an unsafe or out-of-scope action}
</constraints>

<output_format>{Expected format, structure, length. If the target runtime supports structured-output APIs, name the shape here and enforce it through the API; embed full schemas only as fallback.}</output_format>

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

### After the final prompt

Apply **Deliver via headless-relay (post-output step)**: offer delivery once,
only when that skill is installed; otherwise stay completely silent about it.

## Quality scoring

**Always show before/after metrics:**

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| Clarity | 20% | Task unambiguous? |
| Specificity | 20% | Requirements concrete? |
| Structure | 15% | Proper sections, logical flow? |
| Constraints | 15% | Load-bearing boundaries at the right altitude? |
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

### Emphasis calibration

Generated prompts use plain imperative phrasing. Reserve capitalized emphasis (`MUST`, `NEVER`, `CRITICAL`) for safety-critical or protocol-critical boundaries such as privacy guarantees, destructive-action gates, runtime call contracts, and schema/version invariants. Current Anthropic/OpenAI guidance notes that aggressive emphasis can cause frontier models to over-comply, loop on tools, or overweight a local instruction beyond its intended importance.

### Context altitude and budget

Context is a finite resource that degrades as it grows. Generated prompts should curate the minimal sufficient context at the right altitude: include facts that change the decision, prefer references or paths over pasted long material, and keep token budgets visible. More context is not automatically better when it buries the objective, constraints, or verification criteria.

---

## Closed-loop quality (v6.0+)

For both modes, RePrompter supports post-execution evaluation:

1. **IMPROVE** — Score raw → generate structured prompt
2. **EXECUTE** — **Repromptverse mode only**: route to agent(s), collect output. **Single mode does not execute code/commands; it only generates prompts.**
3. **EVALUATE** — Score output/prompt against success criteria (0-10)
4. **RETRY** — Thresholds: Single mode retry if score < 7; Repromptverse retry if score < 8. Max 2 retries.

---

> The **Deliver via headless-relay (post-output step)** section referenced in "After the final prompt" lives in `../reprompter-goal-workflow/references/headless-relay.md`.

## More (moved to references)

- `references/extended-xml-tags.md` — Appendix: Extended XML tags (domain tags beyond the 8 base tags).
- `references/flywheel-bias.md` — Flywheel bias injection + Fleet sync.
- `../reprompter/references/advanced-features.md` — reasoning-friendly prompting, context engineering, token budget, uncertainty handling, Prompt Flywheel, runtime feature flags.
