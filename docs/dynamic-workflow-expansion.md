# Dynamic Workflow Expansion: Option H and the Workflow Preflight Lane

Reprompter's Repromptverse plane today routes Phase 3 ("Execute") to seven file-based backends. The Claude dynamic Workflow tool is a different animal: a deterministic, background, plain-JS orchestrator where data flows through schema-validated return values rather than `/tmp` files. This document specifies how to graft that runtime onto reprompter as **Option H** (a new Phase 3 runtime) and a fifth top-level **Workflow preflight** output lane, additively, on the existing `feat/dynamic-workflow-lane` branch, with ultracode as a first-class compiler default.

The recommendation throughout is built from the workflow-native shape (highest judge score), with the parent-side file mirror grafted in for flywheel compatibility. Both surfaces are additive; nothing changes for users on Options A-G.

---

## 1. Gap analysis: what reprompter has vs what the Workflow tool needs

Reprompter today routes Phase 3 execution to seven file-based backends (Options A-G) via a single three-column auto-pick table at `SKILL.md:644-652`. Every backend obeys one file artifact contract: each agent writes `/tmp/rpt-{taskname}-{role}.md`, the parent reads those files, then synthesizes. The contract is the data channel. The Status Line counts files, Phase 4 evaluates files, and the flywheel records outcomes per role from files.

The Workflow tool's native idiom is the opposite. An `agent` call with a `schema` returns a validated object, and data flows through `pipeline` and `parallel` return values — not files. This is the central tension to reconcile: a file-handoff control plane meeting a return-value control plane.

The code layer models runtimes only abstractly. `scripts/runtime-adapter.js` implements concrete adapters for only `openclaw` and `sequential`; Options A-G have no code adapter at all. Option H is therefore **doc-plus-compiler-only**, consistent with every other lettered option — no `createWorkflowAdapter` is added, and `runtime-adapter.test.js` is left untouched.

Reprompter has four output lanes (Single, `/goal` preflight, Repromptverse, Reverse) declared at `SKILL.md:24-31` and mirrored in the frontmatter `description` (line 5) and `compatibility` block (lines 9-12). The Workflow preflight lane is a **fifth lane**, modeled field-for-field on the `/goal` preflight lane at `SKILL.md:48-197`.

A hard environment constraint dominates code generation. `scripts/repromptverse-runtime.js` lines 56-57 and `scripts/outcome-record.js` line 30 use wall-clock and randomness calls that all throw inside a Workflow sandbox. Flywheel timestamping and recipe-id generation must therefore move to the **parent**, run after the `runId` returns — they cannot live inside the workflow script.

Verified facts the rest of this document respects:

| Fact | Detail |
|---|---|
| Auto-pick table size | The table is Orders **1 through 7**, not 1 through 8. Adding Option H makes it 1 through 8. |
| `goal-command.js` exports | Only `buildGoalCommand`, `buildCompressedSummary`, `buildExpandedPrompt`, `inferRisk`. `hasBoundaryMarkerNear` is **private at line 87** and must be exported for reuse. |
| `validate-templates.sh` scope | Scans `references/*.md` **non-recursively**, so `references/runtime/*.md` is never scanned. It has a two-entry exception allowlist. |
| Check chain tail | The check chain at `package.json` line 38 ends with the benchmark scripts, so a new test must be inserted **before** the benchmarks. |

---

## 2. The Claude dynamic Workflow tool: a primer

A workflow is a plain-JS script (never TypeScript) run via the Workflow tool. It runs in the background, returns a `runId` immediately, notifies on completion, and shows live progress via the `/workflows` view.

**Required header.** A pure-literal `meta` with `name`, `description`, a `phases` array of `{title, detail?}`, an optional `whenToUse`, and an optional `model`. No variables, calls, or spreads. The `phases` titles must match the `phase()` call strings exactly.

**Body hooks:**

| Hook | Shape | Behavior |
|---|---|---|
| `agent(prompt, opts)` | `opts: {label?, phase?, schema?, model?, isolation?, agentType?}` | No schema returns final text; a schema forces structured output and returns the validated object (model retries on mismatch). Returns `null` if the user skips — always filter `Boolean`. |
| `pipeline(items, stage1, ...)` | default, no barrier | Each stage callback gets `(prevResult, originalItem, index)`. A throwing stage drops that item to `null`. |
| `parallel(thunks)` | barrier, awaits all | A throwing thunk resolves to `null` (never rejects). |
| `log(message)` | narrator line | Human-facing progress one-liner. |
| `phase(title)` | starts a phase | Subsequent `agent` calls group under it. |
| `args` | verbatim input | The value passed as the Workflow `args` input. |
| `budget` | `{total, spent(), remaining()}` | `total` is `null` with no `+Nk` directive. Hard ceiling. |
| `workflow(nameOrRef, args?)` | one level deep | Runs another workflow inline. |

`agent` with no schema returns the final text; with a schema it forces structured output and returns the validated object, retrying on mismatch. It returns `null` if the user skips the agent, so always `.filter(Boolean)`.

**Hard limits.** Concurrency cap is `min(16, cores - 2)` with excess queued. Lifetime cap is 1000 agents. Wall-clock and randomness calls, plus argless date construction, all throw and break resume. Standard built-ins (`JSON`, `Array`, `Math.floor`) are fine.

**Resume** uses `scriptPath` plus `resumeFromRunId`: the unchanged prefix of `agent` calls returns cached, and the same script plus the same args gives a full cache hit. This is exactly why determinism matters — no wall-clock, no randomness, ids sourced from `args`.

**The `model` option** is omitted by default so it inherits the main-loop model. Omitting it also keeps the script clean of the hardcoded-model-pin linter ban.

---

## 3. Concept mapping: reprompter Repromptverse to Workflow primitives

| Reprompter concept | Workflow primitive | Notes |
|---|---|---|
| Phase 2 per-agent XML prompt scored 8+ | one `agent` call | `label` is the role, `phase` is the active stage (`Execute`/`Verify`), and the full reprompted XML string is the `prompt` argument. |
| Phase 1 sequential pipeline-with-dependencies (`SKILL.md:449`) | `pipeline` over items | A generate stage plus a verify stage; default, no barrier. |
| Phase 1 parallel independent-agents | `parallel` over thunks then `.filter(Boolean)` | A barrier — used only for genuine all-together synthesis, dedup, or early exit on zero. |
| Artifact contract: one writer per `/tmp/rpt` file | schema returns as source of truth | Files become a parent-written compatibility mirror. |
| Phase 4 evaluator loop (accept 8+, delta-retry 4-6, rewrite <4, max 2 retries) | dedicated pipeline verify stage + bounded JS delta-retry loop | Loop `while retries < 2 && score < 8`. |
| success_criteria v1 (rule / llm_judge / manual) | structured-output schema on the verify agent | `rule` criteria checked deterministically in JS against the returned object; `llm_judge` criteria become capped judge sub-agents (max 2); `manual` criteria surfaced as "needs human", never auto-passed. |
| Termination policy (max turns, wall time, no progress) | `budget.remaining()` loops + loop-until-dry | K consecutive empty rounds, deduped against a `seen` set. |
| Routing / selector policy | deterministic JS control flow | `if`, `switch`, or array selection on intent baked into the meta and prompt strings. No agent decides routing; no randomness. |
| Capability-tier model routing (`SKILL.md:1281-1286`) | `model` option omitted by default | The provider-diversity fallback chain has no Workflow analog, so it is dropped — Anthropic-only. |
| Status Line and Agent Cards (`SKILL.md:523-590`) | `phase` + `log` + `/workflows` live progress | The parent writes `/tmp` artifacts post-run, so the agents emoji count keeps working. |
| Flywheel outcome record (`SKILL.md:611`) | workflow returns the raw outcome payload | Cannot stamp inside the workflow. The parent runs `outcome-record` per role plus `evaluate-outcome` after the `runId` returns. |

---

## 4. Option H spec: Claude dynamic Workflow tool as a Phase 3 runtime

### Detection signal (distinct from B)

The capability cell reads **exactly**: `Workflow` is present in the current toolset (Claude dynamic Workflow runtime). This is a single primitive — **not** the "primary plus at least two of" pattern that other tool-detected rows use, because the Workflow tool has no documented companion-tool signature.

### Placement

Insert Option H as **Order 4**, directly below Option B. Renumber the Order column 1 through 8; letters stay stable:

| Order | Letter |
|---|---|
| 1 | F |
| 2 | G |
| 3 | B |
| 4 | **H** |
| 5 | C |
| 6 | A |
| 7 | D |
| 8 | E |

### Exact auto-pick row (render verbatim)

| Order | Capability check | If true, use |
|---|---|---|
| 4 | `Workflow` is present in the current toolset (Claude dynamic Workflow runtime). | **Option H** — Claude dynamic Workflow tool; deterministic background fan-out via `pipeline`/`parallel` with schema-return handoffs and resumable runs, and no mid-run cross-agent messaging. Full contract and gotchas in `references/runtime/claude-workflow-runtime.md`. |

### Why H sits just below B (render verbatim after the table, mirroring 658-660)

Why H sits just below B: both run on Claude Code surfaces, but B keeps continuous cross-agent `SendMessage`, which is its stated advantage at `SKILL.md:830` and `648`, whereas the Workflow tool trades messaging for determinism, schema-validated returns, and resume. Pick H by default when the work is a deterministic background fan-out that synthesizes from returned objects with no live agent-to-agent chatter; keep B when teammates must message each other mid-run. H still outranks C, A, D, and E on Claude surfaces because schema returns plus resume make it the most reliable, cache-correct execution substrate available.

### Override-hint line (`SKILL.md:656`)

The override-hint line gains the H token so it reads: override by saying "use Option B", "use Option H (Workflow tool)", "use Option A (tmux)", "use Option D", "use Option G (Hermes)", or "use Option E" (sequential).

### TL;DR and runtime-list prose

The Phase 3 TL;DR runtime list at `SKILL.md:415` and the Phase 3 intro gain `Workflow` so the published launch-runtimes line does not go stale: "Launch agents (tmux, TeamCreate, Workflow, sessions_spawn, Codex, Grok, Hermes, or sequential)."

### Option H subsection (mirrors Option G's H1/H2/H3 pattern table)

| Pattern | When to use | Mechanism |
|---|---|---|
| **H1: `pipeline` (default)** | Multi-stage generate-to-verify with no barrier | `pipeline(prompts, gen => agent(gen, {schema}), f => agent(verify(f), {schema}))` |
| **H2: `parallel` barrier** | All-together dedup, merge, or early exit | `parallel(thunks)` then `.filter(Boolean)` over the full set |
| **H3: budget-loop / loop-until-dry** | Termination as a bounded loop | `while (budget.total && budget.remaining() > THRESHOLD) {...}` deduped against a `seen` set |

See `references/runtime/claude-workflow-runtime.md` for the full runtime contract (invocation, schema-return reconciliation, budget loops, resume, and known gotchas). Ultracode-on: the generated workflow defaults to adversarial verify, a completeness critic, and budget-scaled fleets — see the contract doc for the full pattern catalog.

### agent / parallel / pipeline mapping

Each Phase 2 reprompted XML prompt scored 8+ becomes one `agent` `prompt` argument. The `phase` option is pinned to the active stage so the agent groups under the right progress bucket and never races the global `phase()` call.

---

## 5. Option H example: a full workflow script

A complete skeleton named `rpt-auth-audit` — a Repromptverse security plus test-coverage audit. The `meta` is a pure literal; both schemas are plain JSON-schema literals; `runId` and `taskname` come from `args`; the workflow itself writes no files.

```js
export const meta = {
  name: "rpt-auth-audit",
  description: "Repromptverse fan-out audit + adversarial verify, schema-return handoff",
  phases: [{ title: "Plan" }, { title: "Execute" }, { title: "Verify" }, { title: "Synthesize" }]
};

// Plain JSON-schema literals — no type annotations, no helpers that touch the clock.
const FINDING_SCHEMA = {
  type: "object",
  required: ["findings", "decisions", "risks", "next_actions", "score"],
  properties: {
    findings: { type: "array", items: { type: "string" } },
    decisions: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    next_actions: { type: "array", items: { type: "string" } },
    score: { type: "number" }
  }
};
const VERDICT_SCHEMA = {
  type: "object",
  required: ["refuted", "reason", "survives"],
  properties: {
    refuted: { type: "boolean" },
    reason: { type: "string" },
    survives: { type: "boolean" }
  }
};

export default async function () {
  phase("Plan");
  // runId + taskname are passed in by the PARENT. Never generate them here:
  // the wall-clock and randomness APIs both THROW inside a workflow sandbox.
  const taskname = args.taskname;
  const roster = args.agents; // [{ role, prompt }] — reprompted XML baked in by the compiler.
  const fleet = budget.total ? Math.floor(budget.total / 100000) : roster.length;
  log("Auto-picked Option H (Workflow) — schema-return fan-out, " + Math.min(fleet, roster.length) + " agents.");

  phase("Execute");
  // pipeline() by default: generate -> bounded delta-retry, no barrier between items.
  const generated = await pipeline(
    roster.slice(0, Math.min(fleet, roster.length)),
    (a) => agent(a.prompt, { label: a.role, phase: "Execute", schema: FINDING_SCHEMA }),
    async (finding, a) => {
      if (!finding) return null;
      let retries = 0;
      let res = finding;
      while (retries < 2 && res.score < 8) {
        retries++;
        log("Delta-retry " + a.role + " attempt " + retries + " (scored " + res.score + ")");
        res = await agent(deltaPrompt(a, res), { label: a.role + "-retry" + retries, phase: "Execute", schema: FINDING_SCHEMA });
        if (!res) break;
      }
      return res;
    }
  );
  const live = generated.filter(Boolean);

  phase("Verify");
  // Adversarial verify: 3 skeptics per finding, kill on majority refute.
  const survivors = [];
  for (const f of live) {
    const skeptics = await parallel([0, 1, 2].map((i) => () =>
      agent(refutePrompt(f, i), { label: "skeptic" + i, phase: "Verify", schema: VERDICT_SCHEMA })));
    const refutes = skeptics.filter(Boolean).filter((v) => v.refuted).length;
    if (refutes >= 2) {
      log("Killed finding on majority refute (" + refutes + "/3): " + (f.decisions[0] || "n/a"));
      continue;
    }
    survivors.push(f);
  }

  phase("Synthesize");
  const critic = await agent(completenessPrompt(survivors), { label: "completeness-critic", phase: "Synthesize", schema: FINDING_SCHEMA });

  // The returned object is the source of truth the PARENT consumes.
  // The workflow writes NO files; the parent mirrors /tmp artifacts and stamps the flywheel after the runId returns.
  return {
    schema_version: "reprompter.workflow_outcome.v1",
    taskname: taskname,
    runId: args.runId,
    survivors: survivors,
    dropped: live.length - survivors.length,
    missing: critic.next_actions
  };
}

// Pure string-builders — deterministic, no clock, no randomness.
function deltaPrompt(a, prev) {
  return "Previous " + a.role + " attempt scored " + prev.score + "/10.\n" +
    "Good: keep the verified findings.\n" +
    "Missing: address the gaps below.\n" +
    "This retry: raise coverage and verifiability.\n" + JSON.stringify(prev);
}
function refutePrompt(finding, i) {
  return "Skeptic " + i + ": adversarially REFUTE the weakest claim in this finding. " +
    "Return a verdict { refuted, reason, survives }.\n" + JSON.stringify(finding);
}
function completenessPrompt(survivors) {
  return "What is missing across these findings — a modality not run, a claim unverified, a source unread?\n" +
    JSON.stringify(survivors);
}
```

**Conventions called out beside the example:**

- Omit `model` everywhere (inherits the main loop; dodges the pin linter).
- Match `phase()` titles to the `meta.phases` array exactly.
- `.filter(Boolean)` on every `parallel` and `pipeline` result.
- Source `runId` and `taskname` from `args`; never generate them.
- Bound every loop (fixed roster slice, max-2 delta retries, fixed 3 skeptics).

---

## 6. Workflow preflight lane spec

A fifth top-level lane named **Lane: Workflow preflight**, placed immediately after the `/goal` preflight lane (following `SKILL.md:197`) so the two preflight lanes sit together.

### Triggers (kept in sync between frontmatter line 5 and the lanes-table trigger column)

Exactly how `/goal` mirrors line 5 to line 29:

- "workflow preflight"
- "compile to workflow"
- "make a workflow"
- "build a workflow script"
- "run via Workflow tool"
- "dynamic workflow"

### Exact lanes-table row (render verbatim)

Bump **Four output lanes** to **Five output lanes** at the header on line 24 and the tagline on line 20.

| Lane | Trigger | What happens |
|---|---|---|
| **Workflow preflight** | "workflow preflight", "compile to workflow", "make a workflow", "build a workflow script", "run via Workflow tool", "dynamic workflow" | Reprompt the task, build the expanded prompt, and compile into a runnable workflow script with a pure-literal `meta` header plus a schema-return `pipeline`/`parallel` body with adversarial verify that the user runs via `Workflow({scriptPath, args})`. |

### Lane structure (mirrors `/goal` field-for-field)

1. An opener "When the user mentions ..." sentence.
2. A compatibility paragraph stating it works only where the Workflow tool is present (a single Claude-native surface).
3. A runtime-detection table collapsed to one row asking "Is the `Workflow` tool available?".
4. A numbered Process list.
5. The Workflow Command Card.
6. The workflow script in a `javascript` block.
7. The expanded-prompt XML basis with eight tags.
8. A setup-check `bash` block.

### Exact Workflow Command Card (Field + Content, all twelve rows verbatim, rendered before the script)

| Field | Content |
|---|---|
| Workflow Script | The `.workflow.js` script path, or `inline below`. |
| Compiled From | Expanded RePrompter prompt. |
| Objective | One sentence naming the reprompted intent. |
| Meta | The `name` plus phase count from the `meta` header. |
| Mode | Workflow preflight. |
| Run With | `Workflow({scriptPath, args})` (the analog of `/goal`'s "Paste Into"). |
| Orchestration | `pipeline` (default), `parallel`, or single-stage `agent` fan-out. |
| Budget | The `+Nk` budget directive, or `inherit` / `none`. |
| Verify | Adversarial verify with three skeptics, killing on majority, by default — or the chosen pattern. |
| Risk Level | `low`, `medium`, or `high`. |
| Missing Inputs | Up to three, or `none`. |
| Quality | Before score → after score, with the weakest dimension. |

### meta and phases construction

The `meta` is a pure literal the compiler templates from the plan. The `phase()` call strings are emitted from the same `phases` array, so they cannot drift. Each Phase 2 reprompted XML prompt is injected into the args agents' `prompt`, so the heavy prompt strings live in `args` and the script body stays generic and cache-stable.

### The pipeline-vs-parallel heuristic (baked into the Process step and the compiler)

- Default to `pipeline` for multi-stage work because it has no barrier — item A can verify while item B generates.
- Use `parallel` only when all results are genuinely needed together: adversarial skeptics over one finding, cross-agent dedup or merge, or early exit on zero.
- Always `.filter(Boolean)`.
- Use `isolation: 'worktree'` only when parallel agents mutate the same repo files, since it is expensive and not the default.

### Where the human gate lives

The background workflow cannot surface an interactive question mid-run, so the Dimension Interview and the plan-approval gate run in the **parent before launch**. The resolved interview context, plus `runId` and `taskname`, are threaded via `args`.

### Exact setup-check block

```bash
# 1. Availability probe — confirm the Workflow tool is in the current toolset.
#    (If it is exposed only as a CLI subcommand, probe its presence the way
#     Option A probes the tmux+claude version instead.)

# 2. Run the compiled workflow:
#    Workflow({ scriptPath: "/tmp/reprompter-workflow/rpt-auth-audit.workflow.js",
#               args: { taskname, runId, agents, interviewContext } })

# 3. Resume an interrupted run (unchanged agent-call prefix is cached):
#    Workflow({ scriptPath: "/tmp/reprompter-workflow/rpt-auth-audit.workflow.js",
#               resumeFromRunId: "<runId>" })
```

---

## 7. Workflow preflight example: full lane render

### Workflow Command Card (all twelve rows populated for `rpt-auth-audit`)

| Field | Content |
|---|---|
| Workflow Script | `/tmp/reprompter-workflow/rpt-auth-audit.workflow.js` |
| Compiled From | Expanded RePrompter prompt |
| Objective | Audit the auth module for security gaps and missing test coverage, then adversarially verify each finding. |
| Meta | `rpt-auth-audit`, 4 phases (Plan, Execute, Verify, Synthesize) |
| Mode | Workflow preflight |
| Run With | `Workflow({scriptPath, args})` |
| Orchestration | `pipeline` (default), generate → bounded delta-retry, then `parallel` skeptics per finding |
| Budget | `+500k` → fleet of 5 (`Math.floor(500000 / 100000)`) |
| Verify | Adversarial verify — 3 skeptics per finding, kill on majority refute |
| Risk Level | medium (read-only audit; no prod mutation) |
| Missing Inputs | none |
| Quality | 6/10 → 9/10, weakest dimension was verifiability |

### Compiled workflow script

The compiled script is the same skeleton as the Option H example in section 5 — a single source of truth shared between Option H and the Workflow preflight lane. It is rendered in a `javascript` block in the lane (identical to the script above); it is not duplicated or forked.

### Expanded-prompt XML basis (eight required tags)

```xml
<role>You are a senior application-security and test-coverage auditor.</role>
<context>The auth module handles login, session issuance, and password reset. The audit runs as a background Workflow; each agent returns a validated object, not files.</context>
<task>Find security weaknesses and test-coverage gaps in the auth module, then survive adversarial refutation of each finding.</task>
<motivation>Auth defects are high blast-radius; unverified findings waste reviewer time, so every claim must carry evidence and survive a skeptic panel.</motivation>
<requirements>
  - Enumerate findings with claim, evidence, and confidence.
  - List decisions, risks, and next_actions.
  - Return a numeric self-score for the artifact gate.
</requirements>
<constraints>
  - Read-only: do not propose or perform any production deploy.
  - Plain JS workflow only; no wall-clock or randomness in the script body.
  - Source taskname and runId from args; never generate them.
</constraints>
<output_format>A validated object matching FINDING_SCHEMA (findings, decisions, risks, next_actions, score). The compiled workflow skeleton is shown in the javascript block above.</output_format>
<execution_notes>
  - Run the verification checks listed in the Workflow Command Card.
  - Default verify is adversarial: 3 skeptics per finding, kill on majority.
  - The parent writes /tmp/rpt artifacts and stamps the flywheel after the runId returns.
</execution_notes>
<success_criteria schema_version="1">
  <criterion id="findings-have-evidence" verification_method="rule">Every finding has a non-empty evidence field.</criterion>
  <criterion id="survives-skeptic-panel" verification_method="llm_judge">Each surviving finding was refuted by fewer than two of three skeptics.</criterion>
  <criterion id="no-prod-mutation" verification_method="manual">A human confirms the run performed no production-affecting action.</criterion>
</success_criteria>
```

### Args payload shape the parent must pass

```text
{
  taskname: "auth-audit",
  runId: "<generated by the PARENT before launch>",
  agents: [
    { role: "security", prompt: "<reprompted XML for the security auditor>" },
    { role: "test-coverage", prompt: "<reprompted XML for the coverage auditor>" }
  ],
  interviewContext: { /* resolved Dimension Interview answers */ }
}
```

`taskname`, `runId`, and the per-agent prompts are **never** generated inside the script — the wall-clock and randomness APIs throw inside the sandbox, so the parent resolves them before launch and threads them through `args`.

### Compiler CLI that produces these artifacts

Run the workflow-command compiler with `--input` and `--out-dir` to write four files: `workflow-command.json`, the `.workflow.js` script, `workflow-command-card.json`, and `reprompter-expanded-prompt.md`.

```bash
node scripts/workflow-command.js \
  --input "audit the auth module for security + test coverage, adversarially verify findings" \
  --out-dir /tmp/reprompter-workflow \
  --format json
# writes: workflow-command.json, rpt-auth-audit.workflow.js,
#         workflow-command-card.json, reprompter-expanded-prompt.md
```

---

## 8. Ultracode as first-class

Ultracode is a standing opt-in that flips the compiler defaults via a single toggle — an env variable (`REPROMPTER_ULTRACODE=1`) or a flag (`--ultracode`), mirroring the existing `REPROMPTER_FLYWHEEL_BIAS` convention. The toggle selects between a lean linear-pipeline template and a full-thoroughness template. The lean off-ramp is kept so trivial reprompts do not fan out.

**Ultracode-off (default emit):** a linear `pipeline` of generate then verify, with a single self-critique verify stage at the 8-or-above accept gate, a fixed fleet equal to the number of Phase 1 roles, and a bounded delta-retry capped at two.

**Ultracode-on flips these:**

- Author and run a workflow for every substantive task, so the lane becomes the default execution path.
- The verify stage becomes adversarial verify with N skeptics prompted to refute (kill on majority), or perspective-diverse verify across correctness, security, performance, and reproduction lenses.
- A completeness-critic final agent is appended.
- Fleets are budget-scaled to `Math.floor(budget.total / 100000)` or 5, with loop-until-dry finder rounds widened toward thoroughness.
- Verify rigor is raised above the bare 8-or-above gate, requiring survival of the skeptic panel rather than a self-reported score.

**Budget-scaled fleet ceiling.** Document an explicit cap so a wide audit of N findings times three skeptics does not approach the 1000-agent lifetime cap or the `min(16, cores - 2)` concurrency cap. The emitted skeleton bakes in `Math.min(fleet, roster.length)` for the generate fan-out and a fixed 3 skeptics per finding; the compiler caps the total emitted agent count well under both ceilings (e.g. clamp `fleet * (1 + retries) + survivors * 3 + 1` against a documented budget).

**Six-pattern-library to Workflow mapping** (named patterns reused verbatim so users recognize them):

| Pattern | Workflow mapping |
|---|---|
| constraint-first-framing | Bake constraints into the prompt plus a strict `schema` that forces shape up front. |
| uncertainty-labeling | A `confidence` enum field in the structured-output schema. |
| self-critique-checkpoint | An extra pipeline verify stage or completeness critic. |
| delta-retry-scaffold | The bounded retry loop with the previous-attempt-scored delta prompt from `SKILL.md:768-774`. |
| evidence-strength-labeling | Perspective-diverse verify plus a `strength` enum. |
| context-manifest-transparency | `log()` every dropped, truncated, or deduped entry — no silent caps. |

**Evaluator-loop to adversarial-verify.** The Phase 4 thresholds (accept 8+, delta-retry 4-6, rewrite <4, max 2 retries) map to the JS-controlled verify pipeline stage returning the verdict schema. Ultracode replaces the single verifier with N refuters whose majority verdict gates the finding.

The ultracode deep pattern catalog lives in `references/runtime/claude-workflow-runtime.md`, so `SKILL.md` gains only one sentence in the Option H subsection and the published surface stays small.

---

## 9. Artifact-contract decision: schema returns as source of truth

**DECISION (stated verbatim):** Schema returns are the source of truth for in-run data flow; the `/tmp/rpt-*.md` markdown files are a Phase 4, flywheel, and Status-Line compatibility mirror written by the parent **after** the workflow returns, and **never read back as a handoff**.

**WHY schema returns.** Reading files back would reintroduce the file-system race the one-writer rule exists to avoid, break resume and cache determinism (the same script plus args must give a full cache hit), and make the script a thin wrapper over the file contract instead of idiomatic Workflow code. The subagent's final object is the return value — raw data, not prose.

**WHY parent-side file writes (grafted over an in-script synthesis-agent seam).** The in-script synthesis-agent mirror is best-effort and can skip a role file, which silently under-reports the Status-Line count and the flywheel per-role bucketing. Writing files in the parent from the returned objects is deterministic and keeps the throwing wall-clock and randomness calls out of the sandbox entirely.

**FLYWHEEL BRIDGE.** `outcome-record.js` line 30 and `repromptverse-runtime.js` lines 56-57 use wall-clock and randomness in the run-id generation that throw inside a workflow. So the workflow returns the raw outcome payload — `taskname`, `survivors`/`results`, `dropped`, `missing`, per-role scores and retry counts, and the applied recommendation — and the parent runs `outcome-record` per role plus `evaluate-outcome` after the run, supplying the wall-clock timestamp and `runId` at that point. No new flywheel schema-ingestion path is needed, no `createWorkflowAdapter` is added, and `runtime-adapter.test.js` is untouched.

**MIGRATION and COMPAT.** Options A-G stay file-based and unchanged. Option H and the Workflow lane are purely additive Claude-Code-surface options alongside A and B. One writer per file is preserved as documentation, since one role's returned object maps to one parent-written file. The additive disclaimer states this verbatim: this document is additive and does not modify any behavior for users on Claude Code TeamCreate, Codex, OpenClaw, Grok, or Hermes; the Workflow runtime is an additional Claude-Code-surface option alongside Options A and B.

---

## 10. Phased rollout

- **Phase 0** — Add the `hasBoundaryMarkerNear` export to `goal-command.js`, since the in-flight branch boundary-marker edits are the shared substrate. Confirm `test:goal-command` stays green.
- **Phase 1** — Land the compiler plus tests in `workflow-command.js` and `workflow-command.test.js`, and wire `test:workflow-command` into the `package.json` scripts and the check chain **before** the benchmark tail. Self-contained; gates immediately.
- **Phase 2** — Land the docs in `references/runtime/claude-workflow-runtime.md` and `references/workflow-template.md`. Additive with no behavior change; pass both validators.
- **Phase 3** — Land the `SKILL.md` edits: the auto-pick Order 4 row plus renumber, the Why-H note, the override-hint, the TL;DR, the Option H subsection, the fifth lane, the frontmatter triggers, and the compatibility block — plus the README parallel docs.
- **Phase 4 (optional, gated on the open decision)** — The intent-router `mode: "workflow"` route plus the test block. Dropped if the orchestrator prefers lane-only detection.

Each phase keeps `npm run check` green, and nothing in a later phase is required for an earlier phase to be valid — docs can land before or after the compiler. The version bump from **12.5.1 to 12.6.0** lands with the `SKILL.md`, README, and `package.json` surface changes.

---

## 11. Linter and test plan

`validate-tool-refs.js` is a **blocklist, not a schema validator**. The workflow hooks (`agent`, `pipeline`, `parallel`, `phase`, `log`) plus `model: "opus"` and `model: "sonnet"` all pass clean against all five CHECKS regexes, as verified by the readers, so **no new CHECKS entry is added**. This grafts Proposal 1's verified stance and drops Proposal 2's proactive wall-clock-and-randomness regex, which would self-trip on the contract doc.

The only trip risk is the **pinned-model regex** (the `claude-(opus|sonnet|haiku)-N-N` pattern, which also scans `scripts/`). The compiler and skeleton omit the `model` option by default, so they stay green with no new check.

The contract doc discusses the forbidden wall-clock and randomness calls using **broken-token prose** (e.g. "the now() API on Date", "the random() API on Math") so it never trips even a hypothetical future check. This is verified with a grep confirming no literal wall-clock or randomness call tokens appear in the doc.

`validate-templates.sh`: `references/workflow-template.md` is **dual-block** — an XML block carrying all eight required tags plus a JavaScript skeleton — so it passes the eight-tag grep with **no exception entry**. `references/runtime/claude-workflow-runtime.md` lives in a subdirectory the non-recursive `references/*.md` scan never reaches (per the codex, hermes, and grok precedent), so it needs no exception either.

The new test `scripts/workflow-command.test.js` mirrors `goal-command.test.js`:

- The exact header: `"use strict"; const test = require("node:test"); const assert = require("node:assert/strict");`.
- Asserts `schema_version` is `reprompter.workflow_command.v1`.
- Asserts `blocked: true` plus `script: null` on high-risk forbidden hits.
- Asserts a boundary-only input ("no prod deploy") stays executable, reusing the shared `inferRisk` and `hasBoundaryMarkerNear`.
- Asserts `meta` and phase-title no drift (every `phase()` title appears in `meta.phases`).
- Asserts no wall-clock or randomness in the emitted script.
- Asserts the CLI artifact-file writes (all four files).

**Check-gate wiring.** Add a `test:workflow-command` script to the `package.json` scripts after the `test:goal-command` line, and append a chained call to it in the `check` script after `test:goal-command` and before the benchmark tail — declaring the script alone does not gate it.

**intent-router (if the mode route is added).** A new `WORKFLOW_LANE_TRIGGERS` array of multi-word phrases only (avoiding the bare words "workflow" and "parallel", since "parallel" is already a complexity trigger), a branch after `reverse` and before `multi-agent` returning `mode: "workflow"`, an exported symbol, and a test block mirroring the reverse-mode block on lines 116-160 plus a no-collision regression assert. The existing tests stay green.

**Final gate.** `npm run check` must pass end-to-end — templates, tool-refs, all test scripts, the new `test:workflow-command`, and the benchmarks.

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The detection-cell wording assumes a literal `Workflow` tool in the toolset, which is an unconfirmed open question. | Confirm the exact tool name before writing. If it is a CLI or version probe, the cell becomes a bash probe like Option A while the placement reasoning still holds. |
| The Order-column renumber from 1-7 to 1-8 touches the Codex and tmux row indices and the load-bearing Why-F / Why-G prose neighborhood at 658-660. | A careful diff so the Why prose still reads correctly with H wedged below B; verify the rendered table has exactly eight numbered rows. |
| The B-vs-H placement is a genuine product decision; recommending H below B honors the messaging bias, but a reviewer valuing resume and determinism may want H above B. | The Why-H note defends the choice explicitly; flipping is a one-row swap. |
| `hasBoundaryMarkerNear` was not exported — a factual error in the source proposals, verified live. | Add the export in this PR in Phase 0 and verify with a `require` smoke test before the compiler imports it. |
| The parent-side file mirror depends on the parent actually writing every `/tmp/rpt` role file from the returned array. | Document the parent synthesis step as load-bearing; have it iterate the full results array rather than a summary, and keep it deterministic JS rather than an agent. |
| Adversarial verify multiplies the agent count (N findings × 3 skeptics), and budget-scaled fleets under ultracode can approach the 1000-agent lifetime and `min(16, cores-2)` concurrency caps. | Bake an explicit fleet and skeptic ceiling into the emitted skeleton and document it. |
| The budget directive parsing is net-new with no existing convention. | A small parser surfacing parse failure as `inherit`/`none` in the Budget card row rather than silently dropping, covered with a test. |
| A new intent-router mode adds a fifth mode any three-mode switch could miss. | Prefer lane-only detection unless the orchestrator needs `routeIntent` to return `mode: "workflow"`; grep the mode-switching call sites before landing. |
| Ultracode-default fan-out for trivial reprompts. | The lean off-ramp toggle selecting a single-stage emission template. |
| Branch coupling: `workflow-command.js` imports risk helpers from `goal-command.js`, which has uncommitted edits on this branch. | Land the `goal-command` export on the same branch in Phase 0 so the compiler never imports a stale risk function. |

---

## Change plan

| # | Action | File | Change | Verify |
|---|---|---|---|---|
| 1 | edit | `/Users/aytuncyildizli/reprompter/scripts/goal-command.js` | Add `hasBoundaryMarkerNear` to `module.exports` (lines 297-302; currently `buildGoalCommand`, `buildCompressedSummary`, `buildExpandedPrompt`, `inferRisk`). Exposes the boundary-marker refinement so the new compiler reuses the same risk logic. Additive export only; do not change `inferRisk` behavior. The in-flight uncommitted boundary-marker edits on this branch are the intended shared substrate. | Require the module in a node one-liner and assert `hasBoundaryMarkerNear` is a function; run `npm run test:goal-command` and confirm green. |
| 2 | create | `/Users/aytuncyildizli/reprompter/scripts/workflow-command.js` | New compiler mirroring `goal-command.js`. Import `inferRisk`, `hasBoundaryMarkerNear`, `buildExpandedPrompt`; reuse rather than re-implement risk. Export `buildWorkflowCommand`, `buildWorkflowScript`, `parseBudget`. Packet sets `schema_version` `reprompter.workflow_command.v1`, sets `blocked: true` + `script: null` on high-risk forbidden hits (as `goal-command.js` does at 206-207), and includes the emitted script string, `expanded_prompt`, `success_criteria`, a `quality_score` via `evaluateArtifact` at threshold 7, a `workflow_command_card` object, a `recipe_fingerprint`, and a `non_actions` list. `buildWorkflowScript` emits a pure-literal `meta` header (`name: rpt-{taskname}`, description, `phases: [Plan, Execute, Evaluate]`), a default async function reading `args`/`budget`, a `pipeline` default body with `parallel` only when the all-together heuristic applies, `agent` calls carrying schema/label/phase with `model` omitted, `runId`/`taskname` from `args`, `.filter(Boolean)`, and a bounded delta-retry loop capped at two. `parseBudget` reads a `+Nk` token into a total and returns `inherit`/`none` on parse failure. Ultracode toggle via env or flag selects lean or thorough emission. CLI flags mirror `goal-command`. Artifact writer emits the four files. Bare model aliases only if ever set. | Run the CLI on a sample message to a tmp out-dir in JSON; assert output `schema_version` is `reprompter.workflow_command.v1`, the script contains the `meta` export, and the script contains no wall-clock or randomness tokens. |
| 3 | create | `/Users/aytuncyildizli/reprompter/scripts/workflow-command.test.js` | Mirror the `goal-command.test.js` header exactly (`"use strict"`, `node:test`, `node:assert/strict`), require the module. Assert `schema_version` equals `reprompter.workflow_command.v1`; high-risk forbidden input gives `blocked: true` + `script: null` (as lines 49-55 do); boundary-only input ("no prod deploy") stays executable with `blocked: false`, reusing shared `inferRisk`/`hasBoundaryMarkerNear` (as lines 37-47 do); emitted script contains the `meta` export and every phase title appears in `meta.phases` with no drift; emitted script has no wall-clock/randomness; CLI writes the four artifact files (as lines 57-74 do). | Run `node --test scripts/workflow-command.test.js`; all asserts pass. |
| 4 | edit | `/Users/aytuncyildizli/reprompter/package.json` | Add `test:workflow-command` running `node --test scripts/workflow-command.test.js` right after the `test:goal-command` line (line 18). Append a chained `&& npm run test:workflow-command` to the `check` script (line 38) right after `test:goal-command` and before the benchmark tail. Bump version 12.5.1 → 12.6.0 (line 3). | Load `package.json` in node; assert the `test:workflow-command` script exists, the `check` string contains `test:workflow-command`, and the version is `12.6.0`. |
| 5 | create | `/Users/aytuncyildizli/reprompter/references/runtime/claude-workflow-runtime.md` | New runtime contract doc following the hermes/codex skeleton: title, intro naming Phase 3 Option H, a `**Target:**` line describing the Workflow tool by capability (no version pin), omitting the `/goal` section (like grok). Sections in order: when-to-pick pipeline-vs-parallel table; Invocation (run by `scriptPath`+`args`, resume by `scriptPath`+`resumeFromRunId`); deep-dive (Concurrency cap+lifetime; Status Line auto progress + parent writes tmp artifacts post-run; Retries bounded delta-retry max 2; Known gotchas — wall-clock/randomness throw, written in broken-token prose; meta pure literal; phase titles match; model omitted; filter Boolean); schema-vs-file reconciliation stating verbatim that schema returns are the source of truth and tmp files are a parent-written mirror never read back; ultracode section (adversarial-verify default, completeness critic, budget-scaled fleets, six-pattern mapping, evaluator-loop to adversarial-verify, success criteria to StructuredOutput); a what-it-does-not-provide list; Sources with an accessed date; end-of-contract line; an additive disclaimer; and an Auto-selection paragraph stating the detection signal and Option H routing at Order 4 below B. | Grep for the end-of-contract line and the Auto-selection paragraph; grep to confirm no literal wall-clock/randomness tokens; run `npm run validate:tool-refs` and confirm it passes. |
| 6 | create | `/Users/aytuncyildizli/reprompter/references/workflow-template.md` | New dual-block template: title, one-line intro, a `## Template` section with first an `xml` block carrying all eight required opening tags (`role`, `context`, `task`, `motivation`, `requirements`, `constraints`, `output_format`, `success_criteria`) — the expanded prompt that authors the workflow — then a `javascript` block with the compiled skeleton (pure-literal `meta`, `pipeline` default, schema returns, `.filter(Boolean)`, `runId` from `args`, no wall-clock/randomness, model omitted); a `## When to Use` bullet list; a `## Notes` section. The eight tags must be present so `validate-templates.sh` passes with no exception. Keep the skeleton free of literal model pins. | Grep each of the eight required opening tags; run `npm run validate:templates` and `npm run validate:tool-refs`; confirm both pass. |
| 7 | edit | `/Users/aytuncyildizli/reprompter/SKILL.md` | Insert Option H as Order 4 in the auto-pick table (644-652) and renumber 1-8 (1F 2G 3B 4H 5C 6A 7D 8E, letters stable); H capability cell `Workflow is present in the current toolset (Claude dynamic Workflow runtime)`; H if-true cell as in section 4. Add the Why-H note after the table (near 658-660). Add `use Option H (Workflow tool)` to the override-hint line (656). Add `Workflow` to the Phase 3 TL;DR list (415) and the Phase 3 intro. Add an Option H subsection mirroring Option G (near 975-985) opening with the H1/H2/H3 pattern table, then the references pointer line plus one ultracode sentence. Change "Four output lanes" → "Five output lanes" at line 24 and the tagline at line 20; add the Workflow preflight row to the lanes table (24-31) with triggers synced to frontmatter. Add the six workflow trigger phrases to the frontmatter description (5) and a Workflow-lane sentence to the compatibility block (9-12). Add the `## Lane: Workflow preflight` section after the goal lane (following 197) with opener, compatibility paragraph (single Claude-native surface), one-row runtime-detection, numbered Process, the twelve-row Workflow Command Card, the workflow script in a `javascript` block, the eight-tag expanded-prompt XML, and a setup-check bash block; state the schema-truth/files-parent-written reconciliation in the lane prose. | Run `npm run validate:tool-refs`; grep for `Lane: Workflow preflight`, `Option H`, `use Option H`, `Five output lanes`; grep-count the numbered auto-pick rows to confirm exactly eight. |
| 8 | edit | `/Users/aytuncyildizli/reprompter/scripts/intent-router.js` | Add a `WORKFLOW_LANE_TRIGGERS` const (multi-word phrases only: "workflow preflight", "compile to workflow", "make a workflow", "build a workflow script", "run via workflow tool", "dynamic workflow"; never bare "workflow"/"parallel"). Add a `routeIntent` branch after `reverse` and before `multi-agent` returning `mode: "workflow"` with profile, score, hits, and reason `workflow-lane-trigger`. Export the new symbol (near 351-356). Do not alter existing branch order or trigger arrays. Skip this and step 9 if the open decision resolves to lane-only detection. | Call `routeIntent("compile to workflow this task")` in a node one-liner; assert `mode` is `workflow`; run `npm run test:intent-router`. |
| 9 | edit | `/Users/aytuncyildizli/reprompter/scripts/intent-router.test.js` | Add a workflow-mode block mirroring the reverse-mode block (116-160): assert `routeIntent` returns `mode: "workflow"`, the expected profile, and reason `workflow-lane-trigger` for each new trigger phrase, plus a regression assert that an existing multi-agent phrase ("engineering swarm") and a complexity phrase containing "parallel" still route as before with no collision. Do not modify the existing tests. | Run `npm run test:intent-router`; existing tests plus the new block all pass. |
| 10 | edit | `/Users/aytuncyildizli/reprompter/README.md` | Add an Option H (Claude-Workflow) row and a parallel-path paragraph to the runtime capability matrix and prose (325-339). Add a workflow-command CLI block to the goal CLI doc block (215-228) showing the compiler invoked with `--input` and `--out-dir` plus the artifact-files list. Add a Workflow command row and bump the total in the test-suite table (298-315). Reflect the four-to-five lanes change and the 12.6.0 version where stated. Mention the Workflow preflight lane in the lanes overview. | Grep `README.md` for "workflow" and "12.6.0"; confirm both appear. |
| 11 | edit | `/Users/aytuncyildizli/reprompter/package.json` | Final full-gate verification step; no further edit beyond change #4. This row exists to gate the whole change end-to-end. | Run `npm run check`; confirm it passes including templates, tool-refs, all test scripts with the new `test:workflow-command`, and the benchmarks. |

---

## Open decisions

- **Detection signal (blocks the H capability-cell wording):** Does the live environment expose a tool literally named `Workflow` in a detectable toolset, or is detection only possible via a shell/version probe like Option A's `claude --version` check? The recommended cell text assumes literal tool presence; if it is a CLI subcommand, the cell must become a bash probe. Confirm the exact tool-name string before writing.
- **B-vs-H order:** Recommendation is H at Order 4 below B per the messaging-first bias at `SKILL.md:658-660`. Confirm the product wants B-first by default rather than letting the richer schema-return-and-resume primitive win on Claude surfaces. If flipped, the Why-H note inverts and B demotes to Order 4 — a one-row swap, but a genuine product call.
- **Intent-router mode vs lane-only:** `/goal` is lane-only, not a `routeIntent` mode. Recommendation adds a new `mode: "workflow"` route for clean Command Card routing, but this adds a fifth mode any downstream three-mode switch could miss. Confirm whether the orchestrator wants `routeIntent` to return `mode: "workflow"` or prefers lane-only detection via `SKILL.md` trigger phrases (the smaller change). If lane-only, drop change-plan steps 8 and 9.
- **Ultracode default:** Recommendation makes ultracode the default emit but keeps a lean off-ramp toggle so trivial reprompts do not fan out. Confirm the default polarity: ultracode on by default for thoroughness (matching the standing opt-in canon) versus ultracode off by default with explicit opt-in (safer for a published skill).
- **Budget directive parsing:** There is no existing reprompter convention for a budget token. The compiler adds a small parser into the Budget card row, surfacing parse failure as `inherit`/`none`. Confirm this matches how the Workflow tool itself reads the budget directive so the Card does not misreport.
- **Version bump:** Recommendation bumps 12.5.1 → 12.6.0 as a minor for two new additive surfaces. Confirm the repo's versioned-release convention agrees versus a patch bump or a different scheme.
- **Goal-command export:** The workflow compiler reuses the boundary-marker logic, but `hasBoundaryMarkerNear` is currently private (verified). Recommendation adds it to `module.exports` in this PR since the in-flight branch edits are the intended substrate. Confirm those uncommitted `goal-command.js` edits are meant to land on this same branch rather than separately first.
