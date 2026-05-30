# Workflow Preflight Template

Use this template for the **Workflow preflight** lane (Lane 5) and Repromptverse **Option H**: reprompt a task, then compile it into a runnable Claude dynamic Workflow script. It is **dual-block** — an XML expanded prompt that authors the workflow, plus the compiled `.workflow.js` skeleton the user runs via the `Workflow` tool.

## Template

### Block 1 — Expanded prompt (the reprompted intent that authors the workflow)

```xml
<role>Workflow architect compiling a reprompted task into a deterministic Claude Workflow script.</role>

<context>
- Raw operator request: {raw task}
- Target runtime: Claude dynamic Workflow tool (Phase 3 Option H)
- RePrompter route: {mode}/{profile} ({reason})
- Repository/runtime context: {infer from workspace}
- interviewContext (scope/excludes/success), if gathered
</context>

<task>Compile the request into a runnable .workflow.js that fans out reprompted per-role agents and returns a reprompter.workflow_outcome.v1 payload.</task>

<motivation>{why this matters — priority, blast radius, who consumes the result}</motivation>

<requirements>
- One reprompted agent prompt per role; each owns ONE domain, no overlap.
- Schema-validated returns are the single source of truth; never read tmp files back as a handoff.
- meta is a pure literal; phase() titles match meta.phases exactly.
- runId and taskname come from args; never generate them in-script.
- Bounded delta-retry (max 2 per role); under ultracode, adversarial verify + completeness critic.
</requirements>

<constraints>
- No wall-clock or randomness inside the script (they throw and break resume).
- model omitted on every agent() call (inherit main-loop model; keeps the model-pin linter green).
- filter(Boolean) after every parallel()/pipeline().
- High-risk forbidden surfaces (prod/auth/secret/...) block emission unless explicitly approved.
</constraints>

<output_format>A single .workflow.js script string plus a Workflow Command Card (12 fields).</output_format>

<success_criteria>
- schema-returns-source-of-truth: data flows only through agent() returns.
- deterministic-script: pure-literal meta, args-sourced ids, no wall-clock/randomness, filtered results.
- safety-boundaries-held: no forbidden actions without approval.
- evidence-visible: per-role scores, retries, and missing roles are reported.
</success_criteria>
```

### Block 2 — Compiled workflow skeleton (`rpt-{taskname}.workflow.js`)

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

// runId + taskname come from args — never generated in-script.
const taskname = (args && args.taskname) || "rpt-{taskname}"
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

// One reprompted prompt per role. model omitted -> inherit main-loop model.
const AGENTS = [
  { role: "explorer", label: "explore", prompt: "{reprompted prompt}" },
  { role: "analyst", label: "analyze", prompt: "{reprompted prompt}" },
]

phase("Plan")
log(`Workflow ${runId}: dispatching ${AGENTS.length} reprompted agents`)

// Independent domain agents run concurrently; the barrier is justified because
// the Evaluate step needs all results together.
phase("Execute")
const results = (await parallel(
  AGENTS.map((a) => () => agent(a.prompt, { label: a.label, phase: "Execute", schema: FINDINGS_SCHEMA }))
)).filter(Boolean)

// Bounded delta-retry, max 2 per role (ultracode swaps this for adversarial verify).
phase("Evaluate")
const ACCEPT = 8
const final = []
for (const r of results) {
  let current = r
  let attempts = 0
  while (current && current.self_score < ACCEPT && attempts < 2) {
    attempts += 1
    current = await agent(`Previous ${current.role} attempt scored ${current.self_score}/10 (need ${ACCEPT}). Fix the gaps; return the improved structured result.`,
      { label: `retry:${current.role}`, phase: "Evaluate", schema: FINDINGS_SCHEMA })
  }
  if (current) final.push(current)
}

return {
  schema_version: "reprompter.workflow_outcome.v1",
  runId,
  taskname,
  results: final,
  missing: AGENTS.length - final.length,
  scores: final.map((f) => ({ role: f.role, score: f.self_score })),
}
```

## When to use this template

- The user asks to "compile to workflow", "build a workflow script", "workflow preflight", or run a reprompted team via the Claude `Workflow` tool.
- Repromptverse Phase 3 auto-picks **Option H** (the `Workflow` tool is present and no live cross-agent messaging is needed).
- The task is a fan-out of independent-domain agents whose results are synthesized/evaluated together.

## Notes

- For pipelines with real stage dependencies (fetch → transform → deploy), replace the `parallel()` body with `pipeline(items, stage1, stage2)` — each item flows through stages independently, no barrier.
- The parent writes the `/tmp/rpt-{taskname}-{role}.md` mirror **after** the run returns, so Status Line / Phase-4 / flywheel keep working without the script touching files.
- Full runtime contract: `references/runtime/claude-workflow-runtime.md`.
- Compiler: `the root repository workflow compiler` (`buildWorkflowCommand`, `buildWorkflowScript`, `parseBudget`).
