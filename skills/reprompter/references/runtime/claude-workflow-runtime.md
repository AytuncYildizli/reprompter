# Claude Dynamic Workflow Runtime Contract

Canonical reference for running RePrompter Repromptverse fan-out on Claude Code's **dynamic Workflow tool**. Used by Phase 3 **Option H** and by the **Workflow preflight** lane (Lane 5), which compiles a reprompted task into a runnable `.workflow.js` script.

**Target:** any Claude Code surface that exposes the `Workflow` tool (a JS-scripted, background, deterministic subagent orchestrator with `agent()`/`parallel()`/`pipeline()`/`phase()`/`log()` hooks, schema-validated returns, budget control, and resume). No version pin — detect by tool presence.

> Option H is **additive**. It does not change Option A (tmux) or Option B (TeamCreate); it is a third Claude-Code-surface execution path, chosen when you want deterministic background fan-out, schema-validated returns, and resumable runs rather than live cross-agent messaging.

---

## When to pick Option H vs A vs B

| Situation | Pick |
|---|---|
| Deterministic background fan-out; data flows through schema-validated returns; you want a resumable run | **Option H** Workflow tool |
| Agents must message each other continuously mid-run (review/audit teams that negotiate) | **Option B** TeamCreate (native cross-agent `SendMessage`) |
| Fully independent agents and you want visible terminal panes | **Option A** tmux |
| No Claude parallel surface available | Option E sequential |

Option H sits **just below Option B** in the auto-pick tree (Order 4). The Workflow tool has **no inter-agent messaging** — workers cannot talk to each other; data flows only through `pipeline()`/`parallel()` return values. So when the task needs live cross-agent messaging, prefer B; otherwise H wins on determinism, schema returns, and resume.

---

## Invocation

The reprompted task is compiled to a script (the Workflow preflight lane writes `rpt-{taskname}.workflow.js`). Run it:

```text
Workflow({ scriptPath: "/tmp/reprompter-workflow/rpt-{taskname}.workflow.js",
           args: { taskname: "{taskname}", runId: "{taskname}" } })
```

Resume an interrupted run — the longest unchanged prefix of `agent()` calls returns cached results instantly, and only edited/new calls re-run:

```text
Workflow({ scriptPath: "/tmp/reprompter-workflow/rpt-{taskname}.workflow.js",
           resumeFromRunId: "<runId from the prior run>" })
```

`args` carries everything the script must NOT generate itself — `taskname`, `runId`, the agent roster, and `interviewContext`. The tool returns a `runId` immediately and notifies on completion; watch live progress with `/workflows`.

---

## Deep dive

### Concurrency

Concurrent `agent()` calls are capped at `min(16, cores - 2)`; excess calls queue and run as slots free. The lifetime cap is 1000 agents per run (a runaway backstop, far above any real team). You can still pass a large roster to `parallel()`/`pipeline()` — only the in-flight count is bounded.

### Status Line

The Workflow tool renders its own live progress tree (`/workflows`) grouped by `phase()`, plus `log()` narrator lines. RePrompter's file-based artifacts are written **parent-side after the workflow returns** (see reconciliation below), so the compact `Agents: ✅ N/T  ⏳ N/T  🔄 N/T` Status Line is derived from the returned per-role results, not from tmp files during the run.

### Retries

The emitted script carries a **bounded delta-retry loop, capped at 2 attempts per role** (anything below the accept bar is re-prompted with the gap). Under ultracode the evaluator escalates to adversarial verification instead (below). Do not respawn the whole team; the retry targets only the low-scoring role.

### Known gotchas

- **No wall-clock or randomness inside the script.** The current-time `Date` now() call, the `Math` random() call, and argless `Date` construction all throw inside a workflow (they would break resume). Source `runId`/`taskname` from `args`, and stamp any timestamp **parent-side after the run returns**.
- **`meta` must be a pure literal** — no variables, function calls, or spreads. Every `phase()` title must match a `meta.phases[].title` exactly, or progress grouping drifts.
- **Omit `model`.** Agents inherit the main-loop model (latest-model canon), and omitting it also keeps the skill's model-pin linter green. Only set a bare alias (`opus`/`sonnet`/`haiku`) when a tier is genuinely required — never a pinned version string.
- **`filter(Boolean)` after `parallel()`/`pipeline()`.** A thrown thunk/stage resolves to `null` (the call never rejects), so always filter before using results.
- **`pipeline()` has no barrier between stages**; `parallel()` is a barrier. Use `parallel()` only when you genuinely need all results together (e.g., a synthesis step), which is the common Repromptverse shape.

### Schema returns vs file artifacts (reconciliation)

**Schema-validated `agent()` returns are the single source of truth for in-run data flow.** The workflow body NEVER reads the `/tmp/rpt-{taskname}-{role}.md` files back as a handoff — data moves only through `pipeline()`/`parallel()` return values and the final `return`.

The script returns a `reprompter.workflow_outcome.v1` payload (`runId`, `results`, `missing`, per-role `scores`, retries/gaps). The **parent** then writes the `/tmp/rpt-{taskname}-{role}.md` compatibility mirror from that payload — so the existing Status Line count, Phase-4 evaluation, and `outcome-record.js --role` flywheel path keep working unchanged, and the throwing wall-clock/randomness calls stay out of the sandbox.

---

## Ultracode (first-class)

When ultracode is on, the compiled script defaults to the thorough emission:

- **Adversarial / perspective-diverse verify** — each surviving finding is judged by three *distinct* lenses (`correctness` / `completeness` / `risk`) returning a `{refuted, reason}` verdict; a finding is kept only on **≥2/3 non-refutation**. Verifiers are told to default `refuted=true` when uncertain (conservative kill).
- **Agent-count caps** (the run has a **1000-agent lifetime cap**) — each role's findings are bounded `maxItems: 20`, and the verify panel is capped at `VERIFY_CAP = 24` (≤ 72 verify agents). A broad audit (~334 findings × 3 lenses ≈ 1000) would otherwise exhaust the run before the critic. Truncation beyond the cap is `log()`'d, never silent.
- **Completeness critic** — a final agent asks "what is missing — an un-run angle, an unverified claim, an unread source?", but runs **only with token headroom** (see budget scaling).
- **Budget scaling (H3, as shipped)** — the critic is gated on `!budget.total || budget.remaining() > 30000`, so the extra thoroughness pass dials *off* as the run nears its token ceiling. Note: the emitted script does **not** scale the *fleet size* by budget — the roster is fixed to the reprompted roles; the caps above plus this critic-gate are the actual scaling levers. The script sources `const budgetTotal = budget.total || (args && args.budget) || null`, **preferring the live Workflow `budget` global** (real run-level spend tracking via `budget.remaining()`) over the directive carried in `args.budget`, and returns it in the outcome payload.
- **Budget cues** — `parseBudget` treats only the **`+Nk`** form and the literal **`budget:` / `token budget`** keyword as directives (clamped to 100M). A bare `Nk tokens` is **not** a budget cue — it is ambiguous with token exfiltration (`extract 200k tokens`) and reaches the secret-surface gate instead.

Pattern-library mapping (RePrompter → Workflow):

| RePrompter pattern | Workflow pattern |
|---|---|
| Evaluator loop + delta retry | bounded retry loop / adversarial verify |
| Self-critique checkpoint | completeness critic |
| Constraint-first framing | per-agent `schema` (forced structured output) |
| Uncertainty labeling | "default refuted if uncertain" verify prompts |
| Evidence-strength labeling | perspective-diverse lenses |
| Context-manifest transparency | `log()` + `/workflows` progress, no silent caps |

Success criteria (v1 `rule`/`llm_judge`/`manual`) become `StructuredOutput` schemas for the verify agents.

A lean off-ramp (`REPROMPTER_ULTRACODE=0` or `--no-ultracode`) emits the basic parallel-fan-out + bounded-retry body instead, so low-risk reprompts stay cheap.

---

## What the Workflow tool does NOT provide

- No mid-run cross-agent messaging. Workers cannot talk; data flows only through return values. If continuous messaging is required, use Option B.
- No in-script wall-clock or randomness (they throw). Source non-determinism from `args`; stamp time parent-side.
- No `/goal` surface. The Workflow lane emits a `Workflow({ scriptPath, args })` invocation, not a `/goal` command.
- No automatic file artifacts. The script returns data; the parent writes the tmp mirror.
- `meta` cannot be computed. It must be a static literal authored at compile time.

When these matter, switch to Option B (cross-agent messaging), Option A (visible panes), or Option E (sequential).

---

## Sources

All accessed 2026-05-30:

- Claude Code dynamic Workflow tool contract (in-session tool schema: `agent`/`parallel`/`pipeline`/`phase`/`log`/`args`/`budget`/`workflow`, schema returns, resume, ultracode quality patterns).

---

**End of Claude Dynamic Workflow Runtime Contract**

This document is additive. It does not modify any behavior for users on Codex CLI, OpenClaw, Grok CLI, or Hermes Agent, and it does not change Option A (tmux) or Option B (TeamCreate) on Claude Code.

**Auto-selection:** The central "Runtime auto-pick" decision tree in SKILL.md (Phase 3 Execute lane) includes a check for the Workflow tool surface. When a tool named `Workflow` is present in the current toolset, Repromptverse can route Phase 3 to **Option H** at Order 4 (just below Option B), without manual instruction. Because the Workflow tool has no cross-agent messaging, Option B remains the default for teams that must message mid-run; Option H is preferred for deterministic background fan-out, schema-return handoffs, and resumable runs.
